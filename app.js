/* 模型降智监测 · 前端逻辑
 * 数据三层：GitHub Issues（实时） → data/snapshot.json（降级） → data/records.js（基准存档）
 * 无构建、无依赖、可 file:// 直开。
 */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var REPO = (CFG.repo && CFG.repo.owner + "/" + CFG.repo.name) || "";
  var REPO_URL = "https://github.com/" + REPO;
  var API_URL = "https://api.github.com/repos/" + REPO + "/issues?state=open&per_page=100&labels=" +
    encodeURIComponent(CFG.reportLabel || "report");
  var CACHE_KEY = "mdw_live_cache_v1";

  var STATE = { records: [], filter: "all", source: "archive", staleAt: null };

  // ---------------- utils ----------------
  function $(s) { return document.querySelector(s); }
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
  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function daysAgo(d) {
    if (!d) return Infinity;
    return (Date.now() - d.getTime()) / 86400000;
  }
  function relTime(d) {
    if (!d) return "—";
    var days = daysAgo(d);
    if (days < 1) return "今天";
    if (days < 2) return "昨天";
    if (days < 30) return Math.floor(days) + " 天前";
    return d.toISOString().slice(0, 10);
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function allTests() { return window.MODEL_TESTS || []; }
  function findTest(id) {
    var list = allTests();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // ---------------- 判定 ----------------
  function verdictOf(rec) {
    if (rec.source === "archive") return rec.claim;
    var v = CFG.verdict || {};
    var min = v.minVotes || 3;
    var total = rec.up + rec.down;
    if (total < min) return "pending";
    var ratio = rec.up / total;
    if (ratio >= (v.failRatio || 2 / 3)) return "fail";
    if (ratio <= (v.passRatio || 1 / 3)) return "pass";
    return "suspect";
  }
  var VERDICT_TEXT = { fail: "降智", pass: "正常", suspect: "有争议", pending: "待验证" };
  function badge(v, extra) {
    return '<span class="badge ' + v + '">' + VERDICT_TEXT[v] + (extra || "") + "</span>";
  }

  // ---------------- 存档层 ----------------
  function archiveRecords() {
    return (window.MODEL_RECORDS || []).map(function (r) {
      var d = parseDate(r.date) || parseDate(r.createdAt);
      return {
        key: r.id,
        source: "archive",
        testId: r.testId,
        testTitle: r.testTitle || (findTest(r.testId) || {}).title || r.testId,
        model: r.model,
        channel: r.channel || "",
        date: d,
        claim: r.result === "pending" ? "pending" : r.result,
        link: r.src || "",
        note: r.note || "",
        contributor: "",
        up: 0, down: 0, issueUrl: ""
      };
    });
  }

  // ---------------- Issue 解析 ----------------
  function splitSections(body) {
    var out = {};
    if (!body) return out;
    var re = /^###[ \t]+(.+?)[ \t]*$/gm, m, marks = [];
    while ((m = re.exec(body))) marks.push({ label: m[1].trim(), start: m.index + m[0].length });
    for (var i = 0; i < marks.length; i++) {
      var end = i + 1 < marks.length ? body.lastIndexOf("###", marks[i + 1].start) : body.length;
      var val = body.slice(marks[i].start, end).trim();
      if (/^_no response_$/i.test(val)) val = "";
      out[marks[i].label] = val;
    }
    return out;
  }

  function normTest(raw) {
    if (!raw) return "";
    var inParen = raw.match(/\(([a-z0-9][a-z0-9-]*)\)/i);
    if (inParen && findTest(inParen[1])) return inParen[1];
    var list = allTests();
    for (var i = 0; i < list.length; i++) {
      if (raw === list[i].id || raw.indexOf(list[i].id) >= 0) return list[i].id;
      if (raw.indexOf(list[i].title) >= 0) return list[i].id;
    }
    return raw.trim();
  }

  function normClaim(raw) {
    var s = (raw || "").toLowerCase();
    if (s.indexOf("降智") >= 0 || s.indexOf("fail") >= 0) return "fail";
    if (s.indexOf("存疑") >= 0 || s.indexOf("争议") >= 0 || s.indexOf("suspect") >= 0) return "suspect";
    if (s.indexOf("正常") >= 0 || s.indexOf("pass") >= 0) return "pass";
    return "pending";
  }

  function parseIssue(issue) {
    if (!issue || issue.pull_request) return null;
    var L = CFG.labels || {};
    var sec = splitSections(issue.body);
    var testId = normTest(sec[L.test]);
    var model = (sec[L.model] || "").split("\n")[0].trim();
    if (!testId || !model) return null;

    var linkRaw = sec[L.link] || "";
    var urlMatch = linkRaw.match(/https?:\/\/\S+/);
    var dateRaw = (sec[L.date] || "").match(/\d{4}-\d{1,2}-\d{1,2}/);
    var rx = issue.reactions || {};

    return {
      key: "gh-" + issue.number,
      source: "live",
      testId: testId,
      testTitle: (findTest(testId) || {}).title || testId,
      model: model,
      channel: (sec[L.channel] || "").split("\n")[0].trim(),
      date: parseDate(dateRaw ? dateRaw[0] : issue.created_at),
      claim: normClaim(sec[L.claim]),
      link: urlMatch ? urlMatch[0] : "",
      note: sec[L.note] || "",
      contributor: (issue.user && issue.user.login) || "",
      up: rx["+1"] || 0,
      down: rx["-1"] || 0,
      issueUrl: issue.html_url
    };
  }

  // ---------------- 实时层 ----------------
  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (Date.now() - o.at > (CFG.cacheTtlMs || 300000)) return null;
      return o;
    } catch (e) { return null; }
  }
  function writeCache(issues) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), issues: issues })); } catch (e) {}
  }

  function fetchJSON(url) {
    if (typeof fetch !== "function") return Promise.reject(new Error("no fetch"));
    return fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function loadLive() {
    var cached = readCache();
    if (cached) return Promise.resolve({ issues: cached.issues, source: "live", at: cached.at });

    return fetchJSON(API_URL).then(function (issues) {
      writeCache(issues);
      return { issues: issues, source: "live", at: Date.now() };
    }).catch(function () {
      return fetchJSON(CFG.snapshotUrl || "data/snapshot.json").then(function (snap) {
        var issues = snap.issues || [];
        if (!issues.length) return { issues: [], source: "archive", at: null };
        return { issues: issues, source: "snapshot", at: parseDate(snap.generatedAt) };
      }).catch(function () {
        return { issues: [], source: "archive", at: null };
      });
    });
  }

  // ---------------- 渲染：脉搏 ----------------
  function renderPulse() {
    var recs = STATE.records;
    var recent = recs.filter(function (r) { return daysAgo(r.date) <= 7; });
    var judged = recent.filter(function (r) { return verdictOf(r) !== "pending"; });
    var fails = judged.filter(function (r) { return verdictOf(r) === "fail"; });

    var cls, title, sub;
    if (!judged.length) {
      cls = "idle"; title = "暂无近期判定";
      sub = "最近 7 天还没有形成结论的战报。跑一道题，提交第一条。";
    } else if (!fails.length) {
      cls = "ok"; title = "近期未见降智";
      sub = "最近 7 天的 " + judged.length + " 条已判定战报全部正常或有争议，没有被判为降智的模型。";
    } else if (fails.length / judged.length >= 0.5 && fails.length >= 3) {
      cls = "bad"; title = "多个模型正在降智";
      sub = "最近 7 天 " + judged.length + " 条已判定战报中有 " + fails.length + " 条被判为降智，涉及 " +
        uniq(fails.map(function (r) { return r.model; })).join("、") + "。";
    } else {
      cls = "warn"; title = "局部模型疑似降智";
      sub = "最近 7 天有 " + fails.length + " 条战报被判为降智：" +
        uniq(fails.map(function (r) { return r.model; })).join("、") + "。其余模型表现正常。";
    }

    var el = $("#pulse-status");
    el.className = "pulse-status " + cls;
    el.textContent = title;
    $("#pulse-sub").textContent = sub;

    var last24 = recs.filter(function (r) { return daysAgo(r.date) <= 1; }).length;
    var votes = recs.reduce(function (n, r) { return n + r.up + r.down; }, 0);
    $("#pulse-stats").innerHTML = [
      stat(last24, "24 小时新增"),
      stat(recent.length, "近 7 天战报"),
      stat(recs.length, "累计战报"),
      stat(votes, "累计票数")
    ].join("");
  }
  function stat(k, l) {
    return '<div><div class="stat-k num">' + k + '</div><div class="stat-l">' + l + "</div></div>";
  }
  function uniq(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function renderNotice() {
    var el = $("#data-notice");
    if (STATE.source === "live") { el.className = "notice hidden"; return; }
    el.className = "notice";
    if (STATE.source === "snapshot") {
      el.textContent = "GitHub 实时数据读取失败（可能触发了 60 次/小时的 API 限流），当前显示仓库快照" +
        (STATE.staleAt ? "（生成于 " + STATE.staleAt.toISOString().slice(0, 10) + "）" : "") + "，票数可能滞后。";
    } else {
      el.textContent = "当前离线或无法访问 GitHub，仅显示仓库内的基准存档记录，社区战报与票数不可用。";
    }
  }

  // ---------------- 渲染：模型状态 ----------------
  function renderModels() {
    var byModel = {};
    STATE.records.forEach(function (r) {
      var m = byModel[r.model] || (byModel[r.model] = { model: r.model, recs: [] });
      m.recs.push(r);
    });
    var rows = Object.keys(byModel).map(function (k) {
      var m = byModel[k];
      m.recs.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
      var latest = m.recs[0];
      return {
        model: m.model,
        verdict: verdictOf(latest),
        isArchive: latest.source === "archive",
        up: m.recs.reduce(function (n, r) { return n + r.up; }, 0),
        down: m.recs.reduce(function (n, r) { return n + r.down; }, 0),
        count: m.recs.length,
        date: latest.date
      };
    }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); });

    $("#model-rows").innerHTML = rows.length ? rows.map(function (r) {
      return "<tr>" +
        '<td class="model-name">' + esc(r.model) + "</td>" +
        "<td>" + badge(r.verdict) + (r.isArchive ? ' <span class="self-claim">基准</span>' : "") + "</td>" +
        '<td class="hide-sm num">' + (r.up + r.down ? "👍 " + r.up + " · 👎 " + r.down : "—") + "</td>" +
        '<td class="hide-sm num">' + r.count + "</td>" +
        '<td class="t-right">' + relTime(r.date) + "</td>" +
        "</tr>";
    }).join("") : '<tr><td colspan="5" class="empty">暂无数据</td></tr>';
  }

  // ---------------- 渲染：战报 ----------------
  function renderFilters() {
    var ids = uniq(STATE.records.map(function (r) { return r.testId; }));
    var html = ['<button class="chip' + (STATE.filter === "all" ? " on" : "") + '" data-f="all">全部</button>'];
    html.push('<button class="chip' + (STATE.filter === "fail" ? " on" : "") + '" data-f="fail">仅降智</button>');
    ids.forEach(function (id) {
      var t = findTest(id);
      html.push('<button class="chip' + (STATE.filter === id ? " on" : "") + '" data-f="' + esc(id) + '">' +
        esc(t ? t.title : id) + "</button>");
    });
    $("#report-filters").innerHTML = html.join("");
  }

  function visibleRecords() {
    var f = STATE.filter;
    return STATE.records.filter(function (r) {
      if (f === "all") return true;
      if (f === "fail") return verdictOf(r) === "fail";
      return r.testId === f;
    }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  }

  function renderReports() {
    var list = visibleRecords();
    $("#reports-count").textContent = list.length + " 条";
    $("#report-list").innerHTML = list.length ? list.map(reportHtml).join("")
      : '<div class="empty">没有符合条件的战报。</div>';
  }

  function reportHtml(r) {
    var v = verdictOf(r);
    var meta = [esc(r.testTitle)];
    if (r.channel) meta.push(esc(r.channel));
    meta.push(relTime(r.date));
    if (r.contributor) meta.push("@" + esc(r.contributor));

    var actions = [];
    if (r.link) {
      actions.push('<a class="link-btn" href="' + esc(r.link) + '" target="_blank" rel="noopener">查看作品 ↗</a>');
    }
    if (r.source === "live") {
      actions.push('<a class="vote" href="' + esc(r.issueUrl) + '" target="_blank" rel="noopener" ' +
        'title="在 GitHub 上用 👍 表示同样复现降智">👍 复现降智 <span class="c">' + r.up + "</span></a>");
      actions.push('<a class="vote" href="' + esc(r.issueUrl) + '" target="_blank" rel="noopener" ' +
        'title="在 GitHub 上用 👎 表示我测是正常的">👎 我测正常 <span class="c">' + r.down + "</span></a>");
      if (v === "pending") {
        actions.push('<span class="self-claim">提交者自报：' + VERDICT_TEXT[r.claim] + "</span>");
      }
    } else {
      actions.push('<span class="self-claim">维护者按 checklist 判定的基准存档，不参与投票</span>');
    }

    return '<article class="report">' +
      '<div class="r-top">' + badge(v) + '<span class="r-model">' + esc(r.model) + "</span></div>" +
      '<div class="r-meta">' + meta.join('<span class="sep">/</span>') + "</div>" +
      (r.note ? '<p class="r-note clamp">' + esc(r.note) + "</p>" : "") +
      '<div class="r-actions">' + actions.join("") + "</div>" +
      "</article>";
  }

  // ---------------- 渲染：题库 ----------------
  function renderTests() {
    $("#test-list").innerHTML = allTests().map(function (t) {
      var ref = t.reference || {};
      var block = function (title, arr) {
        if (!arr || !arr.length) return "";
        return '<div class="check-title">' + title + '</div><ul class="check">' +
          arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      };
      return '<details class="test"><summary>' + esc(t.title) +
        '<span class="test-tags">' + esc((t.tags || []).join(" · ")) + "</span></summary>" +
        '<div class="test-body">' +
        '<pre class="prompt">' + esc(t.prompt) + "</pre>" +
        '<button class="ghost" data-copy="' + esc(t.id) + '">复制 prompt</button>' +
        block("通过标准", ref.checklist) +
        block("降智特征", ref.failSigns) +
        (t.source && t.source.url
          ? '<div class="check-title">来源：<a href="' + esc(t.source.url) + '" target="_blank" rel="noopener">' +
            esc(t.source.author || t.source.handle || "原帖") + " ↗</a></div>"
          : "") +
        "</div></details>";
    }).join("");
  }

  // ---------------- 提交 ----------------
  function renderForm() {
    $("#f-test").innerHTML = allTests().map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.title) + "</option>";
    }).join("");
    $("#f-date").value = todayStr();
  }

  function buildIssueUrl() {
    var t = findTest($("#f-test").value);
    var model = $("#f-model").value.trim();
    if (!model) { toast("请填写模型名称"); return null; }
    var claimSel = $("#f-claim");
    var F = CFG.fields || {};

    var q = {};
    q.template = CFG.issueTemplate || "report.yml";
    q.labels = CFG.reportLabel || "report";
    q.title = "[report] " + model + " · " + (t ? t.title : "");
    q[F.test] = t ? t.title + " (" + t.id + ")" : "";
    q[F.model] = model;
    q[F.channel] = $("#f-channel").value.trim();
    q[F.date] = $("#f-date").value || todayStr();
    q[F.claim] = claimSel.options[claimSel.selectedIndex].text;
    q[F.link] = $("#f-link").value.trim();
    q[F.note] = $("#f-note").value.trim();

    var parts = Object.keys(q).filter(function (k) { return q[k]; }).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(q[k]);
    });
    return REPO_URL + "/issues/new?" + parts.join("&");
  }

  // ---------------- 启动 ----------------
  function refresh(live) {
    var recs = archiveRecords();
    if (live && live.issues.length) {
      live.issues.forEach(function (i) {
        var r = parseIssue(i);
        if (r) recs.push(r);
      });
    }
    STATE.records = recs;
    STATE.source = live ? live.source : "archive";
    STATE.staleAt = live && live.at ? new Date(live.at) : null;

    renderPulse();
    renderNotice();
    renderModels();
    renderFilters();
    renderReports();
  }

  function bind() {
    $("#report-filters").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-f]");
      if (!b) return;
      STATE.filter = b.getAttribute("data-f");
      renderFilters();
      renderReports();
    });

    $("#test-list").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-copy]");
      if (!b) return;
      var t = findTest(b.getAttribute("data-copy"));
      if (!t) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t.prompt).then(function () { toast("prompt 已复制"); },
          function () { toast("复制失败，请手动选中"); });
      } else {
        toast("当前环境不支持自动复制");
      }
    });

    $("#btn-submit").addEventListener("click", function () {
      var url = buildIssueUrl();
      if (!url) return;
      window.open(url, "_blank", "noopener");
    });
  }

  function init() {
    $("#tagline").textContent = CFG.tagline || "";
    $("#repo-link").href = REPO_URL;
    $("#foot-minvotes").textContent = (CFG.verdict && CFG.verdict.minVotes) || 3;
    $("#foot-repo").innerHTML = '源码与全部战报：<a href="' + REPO_URL + '" target="_blank" rel="noopener">' +
      esc(REPO) + "</a>";

    renderTests();
    renderForm();
    bind();
    refresh(null);

    loadLive().then(refresh).catch(function () { /* 已降级到存档层 */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
