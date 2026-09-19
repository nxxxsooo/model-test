/* 降智测试题集 · 纯静态画廊
 * 数据全部来自仓库：data/tests.js + data/samples.js + results/**
 * 无运行时接口、无投票、无结论。
 *
 * iframe 一律点击才挂载，且不带 allow 属性——权限策略默认关闭 autoplay，
 * 作品里的 Web Audio 不会在用户没主动运行时出声。
 */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var REPO = (CFG.repo && CFG.repo.owner + "/" + CFG.repo.name) || "";
  var REPO_URL = "https://github.com/" + REPO;
  var OBS = CFG.observation || {};
  var THUMB_W = 1200;
  var THUMB_H = 800;
  var CMP_MAX = 4;
  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  function tests() { return window.MODEL_TESTS || []; }
  function samples() { return window.SAMPLES || []; }

  function findTest(id) {
    var l = tests();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function findSample(id) {
    var l = samples();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function samplesOf(id) {
    return samples().filter(function (s) { return s.testId === id; })
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
  }

  function typeLabel(t) { return t.type === "logic" ? "逻辑题" : "图形题"; }
  function diffLabel(n) { return "难度 " + (n || 1) + "/3"; }

  // ---------- 缩略图：点击才跑 ----------
  function thumbHtml(src, model, cls) {
    if (!src) return "";
    return '<div class="thumb ' + (cls || "") + '" data-src="' + esc(src) + '">' +
      '<button class="ph" type="button" data-run>' +
        '<span class="mdl">' + esc(model || "") + "</span>" +
        '<span class="run">▶ 运行</span>' +
      "</button></div>";
  }

  function mountThumb(box) {
    if (box.querySelector("iframe")) return;
    var src = box.getAttribute("data-src");
    if (!src) return;
    var f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts");
    f.setAttribute("allow", "");
    f.setAttribute("title", "样例预览");
    f.src = src;
    var ph = box.querySelector(".ph");
    if (ph) ph.remove();
    box.appendChild(f);
    scaleThumb(box);
  }

  function scaleThumb(box) {
    var f = box.querySelector("iframe");
    if (!f) return;
    var k = box.clientWidth / THUMB_W;
    f.style.transform = "scale(" + k + ")";
    f.style.width = THUMB_W + "px";
    f.style.height = Math.max(THUMB_H, Math.round(box.clientHeight / k)) + "px";
  }

  function scaleAll() { $$(".thumb").forEach(scaleThumb); }

  // ---------- 列表视图 ----------
  function renderList() {
    var list = tests();
    var withS = 0;
    list.forEach(function (t) { if (samplesOf(t.id).length) withS++; });

    $("#tests-aside").textContent =
      list.length + " 道题 · " + samples().length + " 个样例 · " + (list.length - withS) + " 道还没有样例";

    $("#test-list").innerHTML = list.map(function (t) {
      var ss = samplesOf(t.id);
      var side = ss.length
        ? thumbHtml(ss[0].src, ss[0].model, "static")
        : '<div class="t-none">还没有样例<br><a href="' + esc(issueUrl(t)) +
          '" target="_blank" rel="noopener">投第一个</a></div>';

      var meta = [typeLabel(t), diffLabel(t.difficulty), ss.length + " 个样例"];
      if (t.source && t.source.author) meta.push("来源 " + t.source.author);

      return '<article class="t-row">' +
        '<div class="t-main">' +
          '<h3 class="t-title"><a href="#/t/' + encodeURIComponent(t.id) + '">' + esc(t.title) + "</a></h3>" +
          '<div class="t-meta">' + meta.map(esc).join('<span class="dot">·</span>') + "</div>" +
          '<div class="t-prompt">' + esc(t.prompt) + "</div>" +
        "</div>" +
        '<div class="t-side">' + side + "</div>" +
        "</article>";
    }).join("");
  }

  // ---------- 详情视图 ----------
  var detailState = { id: null, filter: "all" };
  var picked = [];

  function renderDetail(id) {
    var t = findTest(id);
    if (!t) { location.hash = "#/"; return; }
    detailState.id = id;

    $("#d-title").textContent = t.title;

    var meta = [typeLabel(t), diffLabel(t.difficulty)];
    (t.tags || []).forEach(function (tag) {
      if (meta.indexOf(tag) < 0) meta.push(tag);
    });
    $("#d-meta").innerHTML = meta.map(esc).join('<span class="dot">·</span>');

    var src = t.source || {};
    $("#d-src").innerHTML = src.url
      ? "题目来源：" + esc(src.author || src.handle || "原帖") +
        ' <a href="' + esc(src.url) + '" target="_blank" rel="noopener">查看原帖 ↗</a>' +
        (src.note ? "<br>" + esc(src.note) : "")
      : "";

    $("#d-prompt").textContent = t.prompt;
    $("#btn-submit-this").href = issueUrl(t);

    var ref = t.reference || {};
    $("#d-ref-aside").textContent = ref.mode === "auto" ? "有标准答案，可直接比对" : "逐项对着看，本站不代为判定";

    var cols = refCols(ref);
    var refBox = $("#d-refs");
    refBox.className = "ref-cols" + (cols.length === 2 ? " two-up" : cols.length === 3 ? " three-up" : "");
    refBox.innerHTML = cols.join("");
    $("#d-ref-sec").classList.toggle("hidden", !cols.length);

    renderSamples();
  }

  function bullets(arr) {
    return '<ul class="pts">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }

  // checklist 带 A/B/C 编号：样例备注里的 A❌ / B❌ 指的就是这些条目
  function checklistHtml(arr) {
    return '<ul class="ck">' + arr.map(function (x, i) {
      return '<li><span class="k">' + (LETTERS.charAt(i) || (i + 1)) + "</span><span>" + esc(x) + "</span></li>";
    }).join("") + "</ul>";
  }

  function refCols(ref) {
    var cols = [];

    if (ref.answer) {
      cols.push("<div>" +
        '<div class="col-title">参考答案</div>' +
        '<div class="answer">' + esc(ref.answer) + "</div>" +
        (ref.explanation
          ? '<details class="expl"><summary>为什么是这个答案</summary>' +
            '<div class="txt">' + esc(ref.explanation) + "</div></details>"
          : "") +
        "</div>");
    }

    if (ref.checklist && ref.checklist.length) {
      cols.push("<div>" +
        '<div class="col-title">可以看什么</div>' + checklistHtml(ref.checklist) + "</div>");
    }

    if (ref.failSigns && ref.failSigns.length) {
      cols.push("<div>" +
        '<div class="col-title">常见的崩法</div>' + bullets(ref.failSigns) + "</div>");
    }

    return cols;
  }

  function renderSamples() {
    var all = samplesOf(detailState.id);
    var counts = { all: all.length };
    all.forEach(function (s) { counts[s.observation] = (counts[s.observation] || 0) + 1; });

    var keys = ["all"].concat(Object.keys(OBS).filter(function (k) { return counts[k]; }));
    $("#d-filters").innerHTML = all.length ? keys.map(function (k) {
      var label = k === "all" ? "全部" : OBS[k];
      return '<button class="chip' + (detailState.filter === k ? " on" : "") + '" data-f="' + k + '">' +
        esc(label) + ' <span class="num">' + (counts[k] || 0) + "</span></button>";
    }).join("") : "";

    var list = detailState.filter === "all" ? all
      : all.filter(function (s) { return s.observation === detailState.filter; });

    $("#d-count").textContent = all.length
      ? all.length + " 个样例" + (all.length > 1 ? " · 勾选 2–4 个可并排比" : "")
      : "";

    if (!all.length) {
      $("#d-samples").innerHTML = '<div class="empty">这道题还没有任何样例。<br>' +
        '<a class="btn" href="' + esc(issueUrl(findTest(detailState.id))) +
        '" target="_blank" rel="noopener">投第一个</a></div>';
      return;
    }

    $("#d-samples").innerHTML = '<div class="grid">' + list.map(sampleHtml).join("") + "</div>";
  }

  function metaOf(s) {
    var m = [];
    if (s.channel) m.push(s.channel);
    if (s.date) m.push(s.date);
    if (s.contributor) m.push("@" + s.contributor);
    return m.join(" · ");
  }

  function sampleHtml(s) {
    var hasWork = !!s.src;
    var on = picked.indexOf(s.id) > -1;

    return '<article class="sample' + (on ? " picked" : "") + '" data-sid="' + esc(s.id) + '">' +
      thumbHtml(s.src, s.model) +
      '<div class="body">' +
        '<div class="s-top"><div>' +
          (s.answer ? '<div class="s-answer">' + esc(s.answer) + "</div>" : "") +
          '<div class="s-model">' + esc(s.model) + "</div>" +
          '<div class="s-meta">' + esc(metaOf(s)) + "</div>" +
        "</div>" +
        (hasWork
          ? '<label class="pick"><input type="checkbox" data-pick' + (on ? " checked" : "") +
            '><span>对比</span></label>'
          : "") +
        "</div>" +
        (s.note ? '<p class="s-note" data-toggle>' + esc(s.note) + "</p>" : "") +
        '<div class="s-foot">' +
          '<span class="obs ' + esc(s.observation) + '">' + esc(OBS[s.observation] || "未评价") + "</span>" +
          (hasWork
            ? '<a class="s-open" href="' + esc(s.src) + '" target="_blank" rel="noopener">打开完整作品 ↗</a>'
            : "") +
        "</div>" +
      "</div></article>";
  }

  // ---------- 并排对比 ----------
  function syncBar() {
    var n = picked.length;
    $("#cmp-n").textContent = n;
    $("#cmp-bar").classList.toggle("show", n > 0);
    $("#cmp-open").disabled = n < 2;
    $("#cmp-hint").textContent = n < 2
      ? "再选 1 个就能比"
      : (n >= CMP_MAX ? "已达上限 " + CMP_MAX + " 个" : "最多 " + CMP_MAX + " 个");
  }

  function togglePick(id, want) {
    var i = picked.indexOf(id);
    if (want && i < 0) {
      if (picked.length >= CMP_MAX) { toast("最多同时比 " + CMP_MAX + " 个"); return false; }
      picked.push(id);
    } else if (!want && i > -1) {
      picked.splice(i, 1);
    }
    syncBar();
    return true;
  }

  function clearPicks() {
    picked = [];
    $$("[data-pick]").forEach(function (b) { b.checked = false; });
    $$(".sample.picked").forEach(function (n) { n.classList.remove("picked"); });
    syncBar();
  }

  function openCompare() {
    if (picked.length < 2) return;
    var t = findTest(detailState.id);
    var items = picked.map(findSample).filter(Boolean);

    $("#cmp-sub").textContent = (t ? t.title + " · " : "") + items.length + " 个样例";
    $("#cmp-grid").style.gridTemplateColumns =
      "repeat(" + Math.min(items.length, CMP_MAX) + ", minmax(0, 1fr))";

    $("#cmp-grid").innerHTML = items.map(function (s) {
      return '<div class="cmp-pane">' +
        '<div class="cp-head">' +
          '<div class="cp-model">' + esc(s.model) + "</div>" +
          '<div class="cp-meta">' + esc(metaOf(s)) +
            ' · <span class="obs ' + esc(s.observation) + '">' + esc(OBS[s.observation] || "未评价") + "</span></div>" +
        "</div>" +
        thumbHtml(s.src, s.model) +
        (s.note ? '<div class="cp-note">' + esc(s.note) + "</div>" : "") +
        "</div>";
    }).join("");

    $("#cmp").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(scaleAll);
    $("#cmp-close").focus();
  }

  function closeCompare() {
    $("#cmp").classList.add("hidden");
    $("#cmp-grid").innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---------- 投稿链接 ----------
  function issueUrl(t) {
    var F = CFG.fields || {};
    var q = {};
    q.template = CFG.issueTemplate || "sample.yml";
    q.labels = CFG.sampleLabel || "sample";
    if (t) {
      q.title = "[sample] " + t.title;
      q[F.test] = t.title + " (" + t.id + ")";
    } else {
      q.title = "[sample] ";
    }
    q[F.date] = new Date().toISOString().slice(0, 10);
    return REPO_URL + "/issues/new?" + Object.keys(q).filter(function (k) { return q[k]; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(q[k]); }).join("&");
  }

  // ---------- 路由 ----------
  function route() {
    var h = location.hash || "#/";
    var m = h.match(/^#\/t\/(.+)$/);

    closeCompare();
    picked = [];
    syncBar();

    if (m) {
      $("#view-list").classList.add("hidden");
      $("#view-detail").classList.remove("hidden");
      detailState.filter = "all";
      renderDetail(decodeURIComponent(m[1]));
      window.scrollTo(0, 0);
    } else {
      $("#view-detail").classList.add("hidden");
      $("#view-list").classList.remove("hidden");
      if (h === "#tests" || h === "#submit") {
        var el = $(h === "#tests" ? "#tests" : "#submit");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    }
    requestAnimationFrame(scaleAll);
  }

  // ---------- 事件 ----------
  function bind() {
    // 点击缩略图占位才挂载 iframe
    document.addEventListener("click", function (e) {
      var run = e.target.closest("[data-run]");
      if (!run) return;
      var box = run.closest(".thumb");
      if (box) mountThumb(box);
    });

    $("#d-filters").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-f]");
      if (!b) return;
      detailState.filter = b.getAttribute("data-f");
      renderSamples();
      requestAnimationFrame(scaleAll);
    });

    $("#d-samples").addEventListener("click", function (e) {
      var n = e.target.closest("[data-toggle]");
      if (n) n.classList.toggle("open");
    });

    $("#d-samples").addEventListener("change", function (e) {
      var box = e.target.closest("[data-pick]");
      if (!box) return;
      var card = box.closest(".sample");
      var id = card.getAttribute("data-sid");
      var okd = togglePick(id, box.checked);
      if (!okd) { box.checked = false; return; }
      card.classList.toggle("picked", box.checked);
    });

    $("#cmp-open").addEventListener("click", openCompare);
    $("#cmp-close").addEventListener("click", closeCompare);
    $("#cmp-clear").addEventListener("click", clearPicks);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#cmp").classList.contains("hidden")) closeCompare();
    });

    $("#btn-copy").addEventListener("click", function () {
      var t = findTest(detailState.id);
      if (!t) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t.prompt).then(
          function () { toast("提示词已复制"); },
          function () { toast("复制失败，请手动选中"); });
      } else {
        toast("当前环境不支持自动复制");
      }
    });

    window.addEventListener("hashchange", route);
    window.addEventListener("resize", function () {
      clearTimeout(scaleAll._t);
      scaleAll._t = setTimeout(scaleAll, 120);
    });
  }

  function init() {
    $("#tagline").textContent = CFG.tagline || "";
    $("#repo-link").href = REPO_URL;
    $("#btn-submit").href = issueUrl(null);
    $("#foot-repo").innerHTML = '源码与全部样例：<a href="' + REPO_URL +
      '" target="_blank" rel="noopener">' + esc(REPO) + "</a>";

    renderList();
    bind();
    route();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
