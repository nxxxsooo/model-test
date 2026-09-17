/* 降智测试题集 · 纯静态画廊
 * 数据全部来自仓库：data/tests.js + data/samples.js + results/**
 * 无运行时接口、无投票、无结论。
 */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var REPO = (CFG.repo && CFG.repo.owner + "/" + CFG.repo.name) || "";
  var REPO_URL = "https://github.com/" + REPO;
  var OBS = CFG.observation || {};
  var THUMB_W = 1200;

  function $(s, r) { return (r || document).querySelector(s); }
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
  function samplesOf(id) {
    return samples().filter(function (s) { return s.testId === id; })
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
  }

  // ---------- 缩略图 ----------
  var io = null;
  function observer() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var box = e.target;
        io.unobserve(box);
        var src = box.getAttribute("data-src");
        if (!src) return;
        var f = document.createElement("iframe");
        f.setAttribute("sandbox", "allow-scripts");
        f.setAttribute("loading", "lazy");
        f.setAttribute("tabindex", "-1");
        f.setAttribute("aria-hidden", "true");
        f.src = src;
        f.addEventListener("load", function () {
          var ph = $(".ph", box);
          if (ph) ph.remove();
        });
        box.appendChild(f);
        scaleThumb(box);
      });
    }, { rootMargin: "300px" });
    return io;
  }

  function scaleThumb(box) {
    var f = box.querySelector("iframe");
    if (!f) return;
    var k = box.clientWidth / THUMB_W;
    f.style.transform = "scale(" + k + ")";
    f.style.height = Math.round(box.clientHeight / k) + "px";
  }

  function scaleAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".thumb"), scaleThumb);
  }

  function thumbHtml(src, label) {
    return '<div class="thumb" data-src="' + esc(src) + '">' +
      '<div class="ph">' + esc(label || "载入中") + "</div></div>";
  }

  function mountThumbs(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll(".thumb[data-src]"), function (b) {
      observer().observe(b);
    });
  }

  // ---------- 列表视图 ----------
  function renderList() {
    var list = tests();
    $("#tests-aside").textContent = list.length + " 道题 · " + samples().length + " 个样例";

    $("#test-list").innerHTML = list.map(function (t) {
      var ss = samplesOf(t.id);
      var strip = ss.length
        ? ss.slice(0, 4).map(function (s) { return thumbHtml(s.src, s.model); }).join("")
        : '<div class="tc-empty" style="grid-column:1/-1">还没有样例<br>等你来投第一个</div>';
      return '<article class="test-card" data-id="' + esc(t.id) + '">' +
        "<div>" +
          '<h3 class="tc-title">' + esc(t.title) + "</h3>" +
          '<div class="tc-meta">' + esc((t.tags || []).join(" · ")) +
            '<span class="dot">·</span><span class="num">' + ss.length + "</span> 个样例</div>" +
          '<div class="tc-prompt">' + esc(t.prompt) + "</div>" +
        "</div>" +
        '<div class="tc-strip">' + strip + "</div>" +
        "</article>";
    }).join("");

    mountThumbs($("#test-list"));
  }

  // ---------- 详情视图 ----------
  var detailState = { id: null, filter: "all" };

  function renderDetail(id) {
    var t = findTest(id);
    if (!t) { location.hash = "#/"; return; }
    detailState.id = id;

    $("#d-title").textContent = t.title;

    var src = t.source || {};
    $("#d-src").innerHTML = src.url
      ? "题目来源：" + esc(src.author || src.handle || "原帖") +
        ' <a href="' + esc(src.url) + '" target="_blank" rel="noopener">查看原帖 ↗</a>' +
        (src.note ? "<br>" + esc(src.note) : "")
      : "";

    $("#d-prompt").textContent = t.prompt;

    $("#d-refs").innerHTML = refsHtml(t.reference || {});

    $("#btn-submit-this").href = issueUrl(t);

    renderSamples();
  }

  function bullets(arr) {
    return '<ul class="pts">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }

  function refsHtml(ref) {
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
        '<div class="col-title">可以看什么</div>' + bullets(ref.checklist) + "</div>");
    }

    if (ref.failSigns && ref.failSigns.length) {
      cols.push("<div>" +
        '<div class="col-title">常见的崩法</div>' + bullets(ref.failSigns) + "</div>");
    }

    return cols.join("");
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

    $("#d-count").textContent = all.length ? all.length + " 个样例" : "";

    if (!all.length) {
      $("#d-samples").innerHTML = '<div class="empty">这道题还没有任何样例。<br>' +
        '<a class="btn" href="' + esc(issueUrl(findTest(detailState.id))) +
        '" target="_blank" rel="noopener">投第一个</a></div>';
      return;
    }

    $("#d-samples").innerHTML = '<div class="grid">' + list.map(sampleHtml).join("") + "</div>";
    mountThumbs($("#d-samples"));
  }

  function sampleHtml(s) {
    var meta = [];
    if (s.channel) meta.push(esc(s.channel));
    if (s.date) meta.push(esc(s.date));
    if (s.contributor) meta.push("@" + esc(s.contributor));

    var hasWork = !!s.src;
    return '<article class="sample' + (hasWork ? "" : " text") + '">' +
      (hasWork ? thumbHtml(s.src, s.model) : "") +
      '<div class="body">' +
        (s.answer ? '<div class="s-answer">' + esc(s.answer) + "</div>" : "") +
        '<div class="s-model">' + esc(s.model) + "</div>" +
        '<div class="s-meta">' + meta.join(" · ") + "</div>" +
        (s.note ? '<p class="s-note" data-toggle>' + esc(s.note) + "</p>" : "") +
        '<div class="s-foot">' +
          '<span class="tag ' + esc(s.observation) + '">' + esc(OBS[s.observation] || "未评价") + "</span>" +
          (hasWork
            ? '<a class="s-open" href="' + esc(s.src) + '" target="_blank" rel="noopener">打开完整作品 ↗</a>'
            : "") +
        "</div>" +
      "</div></article>";
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
    $("#test-list").addEventListener("click", function (e) {
      var card = e.target.closest(".test-card");
      if (card) location.hash = "#/t/" + encodeURIComponent(card.getAttribute("data-id"));
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
