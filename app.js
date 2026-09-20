/* 题目 → 原始样例 → 同题对照。无运行时 API、无构建依赖。
 * 封面是静态截图；只有点击“运行作品”才创建 sandbox iframe。
 * 运行后的声音由作品本身控制；停止、切换题目和关闭对比都会卸载 iframe。
 */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var OBS = CFG.observation || {};
  var PREVIEWS = window.SAMPLE_PREVIEWS || {};
  var REPO = CFG.repo ? CFG.repo.owner + "/" + CFG.repo.name : "";
  var REPO_URL = "https://github.com/" + REPO;
  var VIEW_W = 1200;
  var VIEW_H = 800;
  var MAX_COMPARE = 4;
  var TITLE = "降智测试题集";
  var state = { testId: null, filter: "all", picked: [], compare: false };
  var guideMedia = window.matchMedia("(min-width: 1200px)");
  var guideDesktop = guideMedia.matches;
  var returnFocus = null;

  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tests() { return window.MODEL_TESTS || []; }
  function samples() { return window.SAMPLES || []; }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function findTest(id) { return find(tests(), id); }
  function findSample(id) { return find(samples(), id); }
  function testUrl(id) { return "#/t/" + encodeURIComponent(id); }
  function shortTitle(t) { return t.title.replace(/（.*?）/g, "").trim(); }
  function typeLabel(t) { return t.type === "logic" ? "逻辑题" : "图形题"; }
  function observation(s) { return OBS[s.observation] || "未评价"; }
  function samplesOf(id) {
    return samples().filter(function (s) { return s.testId === id; }).sort(function (a, b) {
      // 同一天先展示有封面的样例；不按贡献者观察或模型质量排序。
      return (b.date || "").localeCompare(a.date || "") ||
        Number(!!PREVIEWS[b.id]) - Number(!!PREVIEWS[a.id]) || samples().indexOf(a) - samples().indexOf(b);
    });
  }
  function toast(message) {
    var el = $("#toast");
    (state.compare ? $("#cmp") : document.body).appendChild(el);
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function issueUrl(t) {
    var fields = CFG.fields || {};
    var query = { template: CFG.issueTemplate || "sample.yml", labels: CFG.sampleLabel || "sample" };
    query.title = "[sample] " + (t ? t.title : "");
    if (t) query[fields.test || "test"] = t.title + " (" + t.id + ")";
    query[fields.date || "date"] = new Date().toISOString().slice(0, 10);
    return REPO_URL + "/issues/new?" + Object.keys(query).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(query[key]);
    }).join("&");
  }

  function copyPrompt(id) {
    var t = findTest(id);
    if (!t) return;
    function fallback() {
      var focus = document.activeElement;
      var field = document.createElement("textarea");
      field.value = t.prompt;
      field.setAttribute("readonly", "");
      field.setAttribute("aria-label", "待复制的提示词");
      field.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0";
      (state.compare ? $("#cmp") : document.body).appendChild(field);
      field.select();
      var copied = false;
      try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
      field.remove();
      if (focus && document.contains(focus)) focus.focus({ preventScroll: true });
      toast(copied ? "提示词已复制" : "复制失败，请选中提示词手动复制");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t.prompt).then(function () { toast("提示词已复制"); }, fallback);
    } else fallback();
  }

  function renderNav() {
    var ordered = tests().map(function (t, index) { return { test: t, index: index, count: samplesOf(t.id).length }; });
    ordered.sort(function (a, b) { return Number(b.count > 0) - Number(a.count > 0) || a.index - b.index; });
    $("#test-nav").innerHTML = ordered.map(function (item) {
      var t = item.test;
      return '<a href="' + testUrl(t.id) + '" data-test-nav="' + esc(t.id) + '">' +
        '<span>' + esc(shortTitle(t)) + '</span><span class="num">' + item.count + "</span></a>";
    }).join("");
    $("#sidebar-count").textContent = tests().length + " 道题 · " + samples().length + " 个样例";
  }

  function coverHtml(s) {
    if (!s || !PREVIEWS[s.id]) return '<span class="cover-fallback">查看这道题的原始样例</span>';
    return '<img data-cover src="' + esc(PREVIEWS[s.id]) + '" alt="' + esc(s.model) +
      ' 的原始作品截图" width="1200" height="800" loading="eager" fetchpriority="high">' +
      '<span class="cover-fallback" hidden>封面暂不可用，仍可查看原始样例</span>';
  }

  function renderList() {
    var populated = tests().filter(function (t) { return samplesOf(t.id).length; });
    var pending = tests().filter(function (t) { return !samplesOf(t.id).length; });
    $("#tests-aside").textContent = tests().length + " 道题 · " + samples().length + " 个样例";
    $("#test-list").innerHTML = populated.map(function (t) {
      var list = samplesOf(t.id);
      return '<article class="test-card"><a class="test-preview" href="' + testUrl(t.id) +
        '" aria-label="查看' + esc(shortTitle(t)) + '的样例">' + coverHtml(list[0]) + "</a>" +
        '<div class="test-body"><div class="test-title-row"><h2><a href="' + testUrl(t.id) + '">' +
        esc(shortTitle(t)) + '</a></h2><span class="meta num">' + list.length + " 个样例</span></div>" +
        '<p class="meta">' + typeLabel(t) + " · 难度 " + (t.difficulty || 1) + "/3</p>" +
        '<p class="test-description">' + esc(t.prompt) + '</p><div class="test-actions">' +
        '<a class="btn" href="' + testUrl(t.id) + '">查看样例</a>' +
        '<button type="button" class="btn secondary" data-copy="' + esc(t.id) + '">复制提示词</button>' +
        "</div></div></article>";
    }).join("");
    $("#pending-tests").innerHTML = pending.map(function (t) {
      return '<article class="pending-row"><h3><a href="' + testUrl(t.id) + '">' + esc(shortTitle(t)) +
        '</a></h3><span class="meta">' + typeLabel(t) + '</span><div class="pending-actions">' +
        '<a class="btn secondary" href="' + testUrl(t.id) + '">查看提示词</a>' +
        '<a class="text-link" href="' + esc(issueUrl(t)) + '" target="_blank" rel="noopener">投第一个样例 ↗</a>' +
        "</div></article>";
    }).join("");
    $("#pending-section").hidden = !pending.length;
    if (!tests().length) $("#test-list").innerHTML = '<p class="muted">题库暂未载入，请刷新页面。</p>';
  }

  function listHtml(items, ordered) {
    var tag = ordered ? "ol" : "ul";
    return "<" + tag + ">" + items.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") + "</" + tag + ">";
  }
  function refsHtml(ref) {
    var sections = [];
    if (ref.answer != null) {
      sections.push('<section class="reference-section"><h3>参考答案</h3><p class="answer">' + esc(ref.answer) +
        "</p>" + (ref.explanation ? '<details><summary>为什么是这个答案 ＋</summary><p>' + esc(ref.explanation) + "</p></details>" : "") + "</section>");
    }
    if (ref.checklist && ref.checklist.length) {
      // 这是题目检查项；不推断原始备注里 A/B/D 等标记与数组序号的对应关系。
      sections.push('<section class="reference-section"><h3>可以看什么</h3>' + listHtml(ref.checklist, true) + "</section>");
    }
    if (ref.failSigns && ref.failSigns.length) {
      sections.push('<section class="reference-section"><h3>常见的问题</h3>' + listHtml(ref.failSigns, false) + "</section>");
    }
    return sections.join("");
  }

  function renderDetail(t) {
    $("#d-title").textContent = shortTitle(t);
    var meta = [typeLabel(t), "难度 " + (t.difficulty || 1) + "/3"];
    (t.tags || []).forEach(function (tag) { if (meta.indexOf(tag) < 0) meta.push(tag); });
    $("#d-meta").textContent = meta.join(" · ");
    var source = t.source || {};
    $("#d-src").innerHTML = (source.url ? '来源：<a href="' + esc(source.url) + '" target="_blank" rel="noopener">' +
      esc(source.author || source.handle || "原帖") + " ↗</a>" : "") +
      (source.note ? '<details class="source-note"><summary>题目出处说明</summary><p>' + esc(source.note) + "</p></details>" : "");
    $("#d-prompt").textContent = t.prompt;
    $("#btn-copy").setAttribute("data-copy", t.id);
    $("#btn-submit-this").href = issueUrl(t);
    var ref = t.reference || {};
    $("#d-ref-aside").textContent = ref.answer != null ? "参考答案与解释供你核对。" : "检查点帮助观察，不代表本站裁决。";
    $("#d-refs").innerHTML = refsHtml(ref);
    $("#d-guide").hidden = !$("#d-refs").children.length;
    $("#guide-details").open = guideMedia.matches;
    renderSamples();
  }

  function metaOf(s) {
    return [s.channel, s.date, s.contributor ? "@" + s.contributor : ""].filter(Boolean).join(" · ");
  }
  function previewHtml(s) {
    return '<figure class="preview" data-sample="' + esc(s.id) + '">' +
      (PREVIEWS[s.id] ? '<img data-preview src="' + esc(PREVIEWS[s.id]) + '" alt="' + esc(s.model) +
        ' 的作品截图，动画可按需运行" width="1200" height="800" loading="lazy">' : "") +
      '<div class="preview-placeholder"' + (PREVIEWS[s.id] ? " hidden" : "") + '><strong>按需运行原始作品</strong>' +
      '<span>点击下方「运行作品」查看动画</span></div></figure>';
  }
  function workActions(s) {
    return '<div class="sample-actions"><button type="button" class="btn secondary" data-run aria-pressed="false" aria-label="运行 ' +
      esc(s.model) + ' 的作品">▷ 运行作品</button><a href="' + esc(s.src) +
      '" target="_blank" rel="noopener">完整作品 ↗</a></div>';
  }
  function sampleHtml(s) {
    var selected = state.picked.indexOf(s.id) !== -1;
    return '<article class="sample work' + (selected ? " picked" : "") + '" data-sid="' + esc(s.id) + '">' +
      (s.src ? previewHtml(s) : "") + '<div class="sample-body"><div class="sample-title-row"><h3 class="sample-model">' +
      esc(s.model) + "</h3>" + (s.src ? '<label class="pick"><input type="checkbox" data-pick aria-label="选择 ' + esc(s.model) +
      ' 进行对比"' + (selected ? " checked" : "") + '>对比</label>' : "") + "</div>" +
      '<p class="meta">' + esc(metaOf(s)) + "</p>" +
      (s.answer ? '<p class="sample-answer">' + esc(s.answer) + "</p>" : "") +
      (s.src ? workActions(s) : "") + '<p class="observation">' + esc(observation(s)) + " · 贡献者观察</p>" +
      (s.note ? '<details class="sample-note"><summary>查看完整观察</summary><p>' + esc(s.note) + '</p></details><p class="note-preview" aria-hidden="true">' + esc(s.note) + "</p>" : "") +
      "</div></article>";
  }
  function renderSamples() {
    disposePreviews($("#d-samples"));
    var all = samplesOf(state.testId);
    var counts = { all: all.length };
    all.forEach(function (s) { counts[s.observation] = (counts[s.observation] || 0) + 1; });
    var keys = ["all"].concat(Object.keys(OBS).filter(function (key) { return counts[key]; }));
    $("#d-filters").innerHTML = all.length ? keys.map(function (key) {
      return '<button type="button" class="chip" data-filter="' + esc(key) + '" aria-pressed="' +
        (state.filter === key ? "true" : "false") + '">' + esc(key === "all" ? "全部" : OBS[key]) +
        ' <span class="num">' + counts[key] + "</span></button>";
    }).join("") : "";
    $("#d-count").textContent = all.length;
    var visible = state.filter === "all" ? all : all.filter(function (s) { return s.observation === state.filter; });
    if (!all.length) {
      $("#d-samples").innerHTML = '<div class="empty-state"><h3>还没有人留下这道题的产出。</h3>' +
        '<p>复制上面的提示词，发给你想测的模型，再把原始结果分享给大家。</p>' +
        '<a class="btn" href="' + esc(issueUrl(findTest(state.testId))) + '" target="_blank" rel="noopener">投第一个样例 ↗</a>' +
        '<p class="meta">通过 GitHub issue 投稿，需要 GitHub 账号。</p><div class="empty-steps"><h3>怎么投稿</h3><ol>' +
        '<li>原样复制提示词，保留模型名与测试日期。</li><li>保存 HTML 或完整回答，留下你的观察。</li>' +
        '<li>提交 issue；收录后，样例会出现在题目页。</li></ol></div></div>';
    } else {
      $("#d-samples").innerHTML = '<div class="sample-grid">' + visible.map(sampleHtml).join("") + "</div>";
    }
  }

  // Stop means unload: sandboxed, independently generated pages have no shared pause API.
  function scalePreview(box) {
    var frame = $("iframe", box);
    if (!frame || !box.clientWidth) return;
    var scale = box.clientWidth / VIEW_W;
    frame.style.transform = "scale(" + scale + ")";
    frame.style.height = Math.round(box.clientHeight / scale) + "px";
  }
  function scaleAll() { $$(".preview").forEach(scalePreview); }
  function stopPreview(work, restore) {
    var box = $(".preview", work);
    if (!box) return;
    clearTimeout(box.loadTimer);
    var frame = $("iframe", box);
    if (frame) frame.remove();
    var loading = $(".preview-loading", box);
    if (loading) loading.remove();
    box.removeAttribute("aria-busy");
    if (restore) {
      var img = $("img", box);
      if (img && !img.getAttribute("data-failed")) img.hidden = false;
      $(".preview-placeholder", box).hidden = !!(img && !img.getAttribute("data-failed"));
      var button = $("[data-run]", work);
      button.textContent = "▷ 运行作品";
      button.setAttribute("aria-pressed", "false");
      var sample = findSample(work.getAttribute("data-sid"));
      button.setAttribute("aria-label", "运行 " + (sample ? sample.model : "") + " 的作品");
    }
  }
  function disposePreviews(root) {
    $$(".work", root).forEach(function (work) { stopPreview(work, true); });
  }
  function togglePreview(button) {
    var work = button.closest(".work");
    var box = $(".preview", work);
    if ($("iframe", box)) { stopPreview(work, true); return; }
    var s = findSample(work.getAttribute("data-sid"));
    if (!s || !s.src) return;
    var img = $("img", box);
    if (img) img.hidden = true;
    $(".preview-placeholder", box).hidden = true;
    box.setAttribute("aria-busy", "true");
    var loading = document.createElement("div");
    loading.className = "preview-loading";
    loading.textContent = "正在载入原始作品…";
    box.appendChild(loading);
    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("allow", "autoplay 'none'");
    frame.setAttribute("title", s.model + " 的原始作品");
    frame.width = VIEW_W;
    frame.height = VIEW_H;
    frame.addEventListener("load", function () {
      clearTimeout(box.loadTimer);
      loading.remove();
      box.removeAttribute("aria-busy");
    });
    frame.addEventListener("error", function () {
      stopPreview(work, true);
      toast("预览未能载入，请重试或打开完整作品");
    });
    frame.src = s.src;
    box.appendChild(frame);
    scalePreview(box);
    button.textContent = "□ 停止预览";
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-label", "停止 " + s.model + " 的作品");
    box.loadTimer = setTimeout(function () {
      loading.textContent = "载入时间较长，可停止重试或打开完整作品";
    }, 12000);
  }

  function syncSelection() {
    var n = state.picked.length;
    $("#cmp-bar").hidden = !n;
    $("#cmp-n").textContent = n;
    $("#cmp-open").disabled = n < 2;
    $("#cmp-names").textContent = state.picked.map(function (id) { return findSample(id).model; }).join("、");
    $("#cmp-hint").textContent = n < 2 ? "再选 1 个就能比" : n === MAX_COMPARE ? "已选满 4 个" : "最多对比 4 个";
    document.body.classList.toggle("has-selection", n > 0);
    $$("[data-pick]").forEach(function (input) {
      var card = input.closest(".sample");
      var selected = state.picked.indexOf(card.getAttribute("data-sid")) !== -1;
      input.checked = selected;
      card.classList.toggle("picked", selected);
    });
  }
  function chooseSample(input) {
    var id = input.closest(".sample").getAttribute("data-sid");
    var position = state.picked.indexOf(id);
    if (input.checked && position === -1) {
      if (state.picked.length >= MAX_COMPARE) {
        input.checked = false;
        toast("最多同时对比 4 个样例，请先取消一个");
        return;
      }
      state.picked.push(id);
    } else if (!input.checked && position !== -1) state.picked.splice(position, 1);
    syncSelection();
  }
  function compareSampleHtml(s) {
    return '<article class="sample work" data-sid="' + esc(s.id) + '"><div class="sample-header"><div><h3>' + esc(s.model) +
      '</h3><p class="meta">' + esc(metaOf(s)) + "</p></div></div>" + previewHtml(s) + workActions(s) +
      '<div class="compare-observation"><p class="observation">' + esc(observation(s)) + " · 贡献者观察</p>" +
      (s.note ? "<p>" + esc(s.note) + "</p>" : "") + "</div></article>";
  }
  function openCompare() {
    if (state.picked.length < 2 || state.compare) return;
    var t = findTest(state.testId);
    if (!t) return;
    disposePreviews($("#d-samples"));
    returnFocus = document.activeElement;
    $("#cmp-title").textContent = shortTitle(t);
    $("#cmp-sub").textContent = "同一提示词 · 已选 " + state.picked.length + " 个样例";
    $("#cmp-prompt").textContent = t.prompt;
    $("#cmp-copy").setAttribute("data-copy", t.id);
    $("#cmp-grid").innerHTML = state.picked.map(function (id) { return compareSampleHtml(findSample(id)); }).join("");
    state.compare = true;
    document.body.style.overflow = "hidden";
    var dialog = $("#cmp");
    if (dialog.showModal) dialog.showModal();
    else { dialog.setAttribute("open", ""); dialog.setAttribute("aria-modal", "true"); $("#site").setAttribute("inert", ""); }
    $("#cmp-close").focus();
    $(".compare-body").scrollTop = 0;
  }
  function closeCompare(restoreFocus) {
    if (!state.compare) return;
    state.compare = false;
    disposePreviews($("#cmp-grid"));
    $("#cmp-grid").innerHTML = "";
    if ($("#cmp").close) $("#cmp").close();
    else $("#cmp").removeAttribute("open");
    $("#site").removeAttribute("inert");
    document.body.style.overflow = "";
    if (restoreFocus !== false && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }

  function route() {
    var hash = location.hash || "#/";
    var match = hash.match(/^#\/t\/(.+)$/);
    var t = null;
    if (match) {
      try { t = findTest(decodeURIComponent(match[1])); } catch (e) { t = null; }
      if (!t) { location.replace("#/"); toast("没有找到这道题，已返回题目索引"); return; }
    }
    closeCompare(false);
    disposePreviews($("#view-detail"));
    state.testId = t ? t.id : null;
    state.filter = "all";
    state.picked = [];
    syncSelection();
    var submit = hash === "#submit";
    $("#view-list").hidden = !!t || submit;
    $("#view-detail").hidden = !t;
    $("#view-submit").hidden = !submit;
    document.title = t ? shortTitle(t) + " · " + TITLE : submit ? "投稿 · " + TITLE : TITLE + " · 同一道题，真实产出";
    $$("[data-test-nav]").forEach(function (a) {
      if (a.getAttribute("data-test-nav") === state.testId) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    [[$("#nav-tests"), !submit], [$("#nav-submit"), submit], [$("#all-tests"), !t && !submit]].forEach(function (entry) {
      if (entry[1]) entry[0].setAttribute("aria-current", "page");
      else entry[0].removeAttribute("aria-current");
    });
    if (t) renderDetail(t);
    window.scrollTo(0, 0);
    if (hash === "#tests") $("#tests").scrollIntoView();
    if (route.ready) $(t ? "#d-title" : submit ? "#submit-title" : "#main").focus({ preventScroll: true });
    route.ready = true;
  }

  function bind() {
    $(".skip-link").addEventListener("click", function (e) { e.preventDefault(); $("#main").focus(); });
    document.addEventListener("click", function (e) {
      var target = e.target.closest ? e.target : e.target.parentElement;
      var copy = target.closest("[data-copy]");
      if (copy) { copyPrompt(copy.getAttribute("data-copy")); return; }
      var run = target.closest("[data-run]");
      if (run) togglePreview(run);
    });
    // Cover failure must not remove access to the original work.
    document.addEventListener("error", function (e) {
      var image = e.target;
      if (!image.matches || !image.matches("img[data-preview], img[data-cover]")) return;
      image.hidden = true;
      image.setAttribute("data-failed", "true");
      var fallback = image.nextElementSibling;
      if (fallback) fallback.hidden = false;
    }, true);
    $("#d-filters").addEventListener("click", function (e) {
      var button = e.target.closest("[data-filter]");
      if (!button) return;
      state.filter = button.getAttribute("data-filter");
      renderSamples();
      var current = $('[data-filter="' + state.filter + '"]', $("#d-filters"));
      if (current) current.focus({ preventScroll: true });
    });
    $("#d-samples").addEventListener("change", function (e) {
      if (e.target.matches("[data-pick]")) chooseSample(e.target);
    });
    $("#cmp-clear").addEventListener("click", function () {
      state.picked = [];
      syncSelection();
      var first = $("[data-pick]", $("#d-samples"));
      if (first) first.focus({ preventScroll: true });
    });
    $("#cmp-open").addEventListener("click", openCompare);
    $("#cmp-close").addEventListener("click", function () { closeCompare(true); });
    $("#cmp-adjust").addEventListener("click", function () { closeCompare(true); });
    $("#cmp").addEventListener("cancel", function (e) { e.preventDefault(); closeCompare(true); });
    document.addEventListener("keydown", function (e) {
      if (state.compare && e.key === "Escape") { e.preventDefault(); closeCompare(true); }
    });
    window.addEventListener("hashchange", route);
    window.addEventListener("resize", function () {
      clearTimeout(scaleAll.timer);
      scaleAll.timer = setTimeout(scaleAll, 100);
      if (guideDesktop !== guideMedia.matches) {
        guideDesktop = guideMedia.matches;
        $("#guide-details").open = guideDesktop;
      }
    });
  }
  function init() {
    $("#repo-link").href = REPO_URL;
    $("#btn-submit").href = issueUrl(null);
    $("#foot-repo").innerHTML = '源码与全部原始样例：<a href="' + esc(REPO_URL) +
      '" target="_blank" rel="noopener">' + esc(REPO) + " ↗</a>";
    renderNav();
    renderList();
    bind();
    route();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
