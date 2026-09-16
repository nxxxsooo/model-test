// ============================================================
// 模型降质治理测试集与工具 — 页面逻辑（零依赖）
// 数据：内置题库 data/tests.js（window.MODEL_TESTS）
//       自定义题目 + 测试记录 → localStorage（仅本机）
// ============================================================
(function () {
  "use strict";

  var LS_RECORDS = "mt_records";
  var LS_CUSTOM = "mt_custom_tests";

  // ---------- utils ----------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }
  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1); if (m.length < 2) m = "0" + m;
    var day = String(d.getDate()); if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function copyText(text, cb) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      cb();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(cb, fallback);
    } else { fallback(); }
  }

  // ---------- data ----------
  function allTests() { return (window.MODEL_TESTS || []).concat(getCustomTests()); }
  function getCustomTests() { return loadJSON(LS_CUSTOM, []); }
  function setCustomTests(list) { saveJSON(LS_CUSTOM, list); }
  function getRecords() { return loadJSON(LS_RECORDS, []); }
  function setRecords(list) { saveJSON(LS_RECORDS, list); }

  // ---------- 种子录入：data/records.js 预置记录合入并同步本机 ----------
  // 已存在的种子记录随 data/records.js 更新同步（页面无记录编辑功能，覆盖安全）；
    // 被手动删除的种子不复活；新增种子只在首次打开时录入。
    (function seedRecords() {
    var KEY = "mt_seeded_records_v1";
    var first = !localStorage.getItem(KEY);
      var seeds = window.MODEL_RECORDS || [];
      if (seeds.length) {
      var recs = getRecords();
        var idx = {}; recs.forEach(function (r, i) { idx[r.id] = i; });
      var changed = false;
      seeds.forEach(function (r) {
      if (!r || !r.id) return;
    if (idx[r.id] != null) {
    if (JSON.stringify(recs[idx[r.id]]) !== JSON.stringify(r)) {
  recs[idx[r.id]] = r; changed = true;
          }
        } else if (first) {
          recs.push(r); idx[r.id] = recs.length - 1; changed = true;
        }
      });
      if (changed) {
        recs.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
        setRecords(recs);
      }
    }
    localStorage.setItem(KEY, "1");
  })();
  function findTest(id) {
    var list = allTests();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var RESULT_LABEL = { pass: "✅ 正常", suspect: "⚠️ 疑似降智", fail: "❌ 失败 / 降智", pending: "⏳ 待判定" };
  var TYPE_LABEL = { graphic: "图形题", logic: "逻辑题" };

  // ---------- tabs ----------
  $("#tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    $all("#tabs button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    $all(".view").forEach(function (v) { v.classList.remove("active"); });
    var v = $("#view-" + btn.dataset.view);
    if (v) v.classList.add("active");
  });
  function gotoView(name) {
    var btn = $('#tabs button[data-view="' + name + '"]');
    if (btn) btn.click();
  }

  // ============================================================
  // 题库
  // ============================================================
  var libFilter = "all";

  function renderChips() {
    var counts = { all: allTests().length, graphic: 0, logic: 0 };
    allTests().forEach(function (t) { if (counts[t.type] != null) counts[t.type]++; });
    var defs = [
      ["all", "全部 " + counts.all],
      ["graphic", "图形题 " + counts.graphic],
      ["logic", "逻辑题 " + counts.logic]
    ];
    $("#library-chips").innerHTML = defs.map(function (d) {
      return '<button class="chip' + (libFilter === d[0] ? " active" : "") + '" data-f="' + d[0] + '">' + d[1] + "</button>";
    }).join("");
  }

  function refHtml(test) {
    var r = test.reference || {};
    var html = "";
    if (test.type === "logic" && r.answer != null) {
      html += '<div class="answer-line">标准答案：' + esc(r.answer) + "</div>";
    }
    if (r.checklist && r.checklist.length) {
      html += "<div><b>通过要点</b></div><ul>" +
        r.checklist.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
    }
    if (r.failSigns && r.failSigns.length) {
      html += "<div style='margin-top:6px'><b>降智信号</b></div><ul>" +
        r.failSigns.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
    }
    if (r.explanation) {
      html += '<div class="expl">' + esc(r.explanation).replace(/\n/g, "<br>") + "</div>";
    }
    return html || "<div class='meta'>暂无参考</div>";
  }

  function renderLibrary() {
    renderChips();
    var list = allTests().filter(function (t) { return libFilter === "all" || t.type === libFilter; });
    $("#library-cards").innerHTML = list.map(function (t) {
      var src = t.source || {};
      var srcLine = "";
      if (src.url) {
        srcLine = '来源：<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' +
          esc(src.author || src.handle || "链接") + (src.date ? " · " + esc(src.date) : "") + "</a>";
      } else if (src.author) {
        srcLine = "来源：" + esc(src.author);
      }
      if (src.note) srcLine += '<div class="meta" style="margin-top:2px">' + esc(src.note) + "</div>";
      var tags = (t.tags || []).map(function (g) { return '<span class="badge tag">' + esc(g) + "</span>"; }).join("");
      return (
        '<div class="card">' +
        '<h3>' + esc(t.title) + ' <span class="badge ' + t.type + '">' + TYPE_LABEL[t.type] + "</span>" + tags + "</h3>" +
        (srcLine ? '<div class="meta">' + srcLine + "</div>" : "") +
        '<div class="prompt-box">' + esc(t.prompt) + "</div>" +
        '<details class="ref"><summary>📖 标准参考与判定要点</summary><div class="ref-body">' + refHtml(t) + "</div></details>" +
        '<div class="card-actions">' +
        '<button class="btn btn-primary btn-sm" data-copy="' + esc(t.id) + '">复制提示词</button>' +
        '<button class="btn btn-ghost btn-sm" data-goto-submit="' + esc(t.id) + '">提交作品 →</button>' +
        (t._custom ? '<button class="btn btn-danger btn-sm" data-del-test="' + esc(t.id) + '">删除</button>' : "") +
        "</div></div>"
      );
    }).join("") || '<div class="empty">该分类下暂无题目</div>';
  }

  $("#library-chips").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    libFilter = chip.dataset.f;
    renderLibrary();
  });

  $("#library-cards").addEventListener("click", function (e) {
    var copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      var t = findTest(copyBtn.dataset.copy);
      if (!t) return;
      copyText(t.prompt, function () {
        var old = copyBtn.textContent;
        copyBtn.textContent = "已复制 ✓";
        toast("提示词已复制到剪贴板");
        setTimeout(function () { copyBtn.textContent = old; }, 1500);
      });
      return;
    }
    var goBtn = e.target.closest("[data-goto-submit]");
    if (goBtn) {
      openSubmitFor(goBtn.dataset.gotoSubmit);
      return;
    }
    var delBtn = e.target.closest("[data-del-test]");
    if (delBtn) {
      if (!confirm("确定删除该自定义题目？（不影响已有测试记录）")) return;
      setCustomTests(getCustomTests().filter(function (t) { return t.id !== delBtn.dataset.delTest; }));
      refreshAll();
      toast("题目已删除");
    }
  });

  // ============================================================
  // 提交作品
  // ============================================================
  function renderTestSelect() {
    var list = allTests();
    var prev = $("#f-test").value;
    $("#f-test").innerHTML = list.map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(TYPE_LABEL[t.type]) + " · " + esc(t.title) + "</option>";
    }).join("");
    if (prev && findTest(prev)) $("#f-test").value = prev;

    var models = {};
    getRecords().forEach(function (r) { if (r.model) models[r.model] = 1; });
    $("#model-list").innerHTML = Object.keys(models).map(function (m) {
      return '<option value="' + esc(m) + '">';
    }).join("");
  }

  function currentSelectedTest() { return findTest($("#f-test").value); }

  function syncSubmitFields() {
    var t = currentSelectedTest();
    if (!t) return;
    var isGraphic = t.type !== "logic";
    $("#f-html-wrap").style.display = isGraphic ? "" : "none";
    $("#f-answer-wrap").style.display = isGraphic ? "none" : "";
    $("#f-verdict").textContent = "";
  }

  $("#f-test").addEventListener("change", syncSubmitFields);

  // 逻辑题自动判定
  $("#f-answer").addEventListener("input", function () {
    var t = currentSelectedTest();
    var tip = $("#f-verdict");
    if (!t || t.type !== "logic" || !(t.reference && t.reference.answer != null)) { tip.textContent = ""; return; }
    var raw = String(this.value);
    var nums = raw.match(/-?\d+(?:\.\d+)?/g) || [];
    var expect = String(t.reference.answer);
    var hit = false;
    for (var i = 0; i < nums.length; i++) {
      if (Number(nums[i]) === Number(expect)) { hit = true; break; }
    }
    if (!raw.trim()) { tip.textContent = ""; return; }
    tip.innerHTML = hit
      ? '<span style="color:var(--green)">✓ 检测到答案 ' + esc(expect) + "，已自动判定为「正常」</span>"
      : '<span style="color:var(--red)">✗ 未检测到标准答案（应为 ' + esc(expect) + "），已自动判定为「失败 / 降智」（可手动改判）</span>";
    setRadio(hit ? "pass" : "fail");
  });

  function setRadio(val) {
    var input = $('#f-result input[value="' + val + '"]');
    if (input) {
      input.checked = true;
      $all("#f-result label").forEach(function (l) {
        l.classList.toggle("checked", l.dataset.val === val);
      });
    }
  }
  $("#f-result").addEventListener("change", function (e) {
    if (e.target.name === "result") {
      $all("#f-result label").forEach(function (l) {
        l.classList.toggle("checked", l.dataset.val === e.target.value);
      });
    }
  });

  $("#btn-preview-html").addEventListener("click", function () {
    var html = $("#f-html").value;
    var frame = $("#submit-preview-frame");
    if (!html.trim()) {
    var src = $("#f-src").value.trim();
    if (!src) { toast("请先粘贴作品 HTML 或填写作品文件路径"); return; }
    frame.removeAttribute("srcdoc");
  frame.src = src;
    } else {
      frame.removeAttribute("src");
      frame.srcdoc = html;
    }
    var wrap = $("#submit-preview");
    wrap.style.display = "";
    wrap.scrollIntoView({ behavior: "smooth" });
  });

  function openSubmitFor(testId) {
    renderTestSelect();
    if (testId) $("#f-test").value = testId;
    syncSubmitFields();
    $("#f-date").value = today();
    gotoView("submit");
    window.scrollTo({ top: 0 });
  }

  $("#btn-save").addEventListener("click", function () {
    var t = currentSelectedTest();
    if (!t) { toast("请选择题目"); return; }
    var model = $("#f-model").value.trim();
    if (!model) { toast("请填写模型名称"); $("#f-model").focus(); return; }
    var resultInput = document.querySelector('#f-result input[name="result"]:checked');
    if (!resultInput) { toast("请选择判定结果"); return; }

    var rec = {
      id: "r" + Date.now() + Math.floor(Math.random() * 1000),
      testId: t.id,
      testTitle: t.title,
      testType: t.type,
      model: model,
      channel: $("#f-channel").value.trim(),
      date: $("#f-date").value || today(),
      result: resultInput.value,
      note: $("#f-note").value.trim(),
      createdAt: new Date().toISOString()
    };
    if (t.type === "logic") {
      rec.answer = $("#f-answer").value.trim();
    } else {
      var html = $("#f-html").value;
      var src = $("#f-src").value.trim();
      if (!html.trim() && !src) { toast("图形题请粘贴作品 HTML，或填写作品文件路径"); return; }
    if (html.trim()) rec.html = html;
      if (src) rec.src = src;
    }

    var records = getRecords();
    records.unshift(rec);
    setRecords(records);

    // 清空表单（保留模型名，方便连测）
    $("#f-html").value = "";
    $("#f-src").value = "";
    $("#f-answer").value = "";
    $("#f-verdict").textContent = "";
    $("#f-note").value = "";
    $("#submit-preview").style.display = "none";
    $all("#f-result label").forEach(function (l) { l.classList.remove("checked"); });
    $all('#f-result input').forEach(function (i) { i.checked = false; });

    refreshAll();
    toast("已保存记录，可在回归看板查看");
    gotoView("dashboard");
  });

  // ============================================================
  // 回归看板
  // ============================================================
  function renderDashboard() {
    var records = getRecords();

    // 模型汇总
    var byModel = {};
    records.forEach(function (r) {
      var m = byModel[r.model] || (byModel[r.model] = {
      model: r.model, pass: 0, suspect: 0, fail: 0, pending: 0,
      latest: "", latestKey: "", latestResult: "pending", channels: {}
    });
      m[r.result] = (m[r.result] || 0) + 1;
      if (r.channel) m.channels[r.channel] = 1;
      var key = (r.date || "") + "|" + (r.createdAt || "");
      if (key > m.latestKey) { m.latestKey = key; m.latest = r.date; m.latestResult = r.result; }
    });
    var models = Object.keys(byModel).map(function (k) { return byModel[k]; })
      .sort(function (a, b) { return b.latest.localeCompare(a.latest); });

    var ICON = { pass: "✅", suspect: "⚠️", fail: "❌", pending: "⏳" };
      $("#model-cards").innerHTML = models.map(function (m) {
      var total = m.pass + m.suspect + m.fail + (m.pending || 0);
      var judged = m.pass + m.suspect + m.fail;
      var pct = function (n) { return judged ? Math.round(n / judged * 100) : 0; };
        var channels = Object.keys(m.channels).join(" / ");
        return (
        '<div class="model-card mc-' + m.latestResult + '" data-model="' + esc(m.model) + '" title="点击查看该模型的时间线">' +
        '<div class="mc-top">' +
        '<span class="mc-name">' + esc(m.model) + "</span>" +
        '<span class="badge res-' + m.latestResult + '">' + ICON[m.latestResult] + " 最近</span>" +
        "</div>" +
        (channels ? '<div class="mc-channel">' + esc(channels) + "</div>" : "") +
        '<div class="mc-mid">' +
        '<span class="mc-cell"><b>' + pct(m.pass) + '%</b><i>通过率' + (judged && judged < total ? "（按已判）" : "") + "</i></span>" +
        '<span class="mc-cell"><b>' + total + "</b><i>次测试</i></span>" +
      '<span class="mc-cell"><b>' + esc((m.latest || "—").slice(5)) + "</b><i>最近测试</i></span>" +
    "</div>" +
        '<div class="rate-bar">' +
        '<div class="p-pass" style="width:' + pct(m.pass) + '%"></div>' +
        '<div class="p-suspect" style="width:' + pct(m.suspect) + '%"></div>' +
        '<div class="p-fail" style="width:' + pct(m.fail) + '%"></div>' +
        "</div>" +
        '<div class="mc-nums">✅ ' + m.pass + " · ⚠️ " + m.suspect + " · ❌ " + m.fail +
        (m.pending ? " · ⏳ " + m.pending : "") + (judged ? "" : "（未判定）") + "</div>" +
        "</div>"
      );
    }).join("") || '<div class="empty">还没有测试记录，先去「提交作品」录一条吧</div>';

    // 模型筛选下拉
    var prevModel = $("#filter-model").value;
    $("#filter-model").innerHTML = '<option value="">全部模型</option>' +
      models.map(function (m) { return '<option value="' + esc(m.model) + '">' + esc(m.model) + "</option>"; }).join("");
    if (prevModel) $("#filter-model").value = prevModel;

    // 题目筛选下拉
    var prevTest = $("#filter-test") ? $("#filter-test").value : "";
    if ($("#filter-test")) {
      $("#filter-test").innerHTML = '<option value="">全部题目</option>' +
        allTests().map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(TYPE_LABEL[t.type]) + " · " + esc(t.title) + "</option>"; }).join("");
      if (prevTest) $("#filter-test").value = prevTest;
    }

    renderHealth(records);
    renderMatrix(models);
    renderTimeline();
  }

  function recKey(r) { return (r.createdAt || r.date || ""); }
  function judgedOnly(records) { return records.filter(function (r) { return r.result !== "pending"; }); }
    function healthScore(records) {
    records = judgedOnly(records);
    if (!records.length) return 0;
  var s = 0; records.forEach(function (r) { s += r.result === "pass" ? 1 : r.result === "suspect" ? 0.4 : 0; });
    return s / records.length;
  }
  function sparkPath(values, w, h) {
    if (!values.length) return "";
    var n = values.length, min = Math.min.apply(null, values), max = Math.max.apply(null, values), span = (max - min) || 1;
    var d = "";
    values.forEach(function (v, i) {
      var x = n === 1 ? w / 2 : (i / (n - 1)) * (w - 4) + 2;
      var y = h - 4 - ((v - min) / span) * (h - 8);
      d += (i === 0 ? "M" : " L") + x.toFixed(1) + " " + y.toFixed(1);
    });
    return d;
  }
  function renderHealth(records) {
    var el = $("#health-row"); if (!el) return;
    var n = records.length;
    var judged = judgedOnly(records);
    var hs = healthScore(records);
    var degrade = judged.length ? judged.filter(function (r) { return r.result !== "pass"; }).length / judged.length : 0;
    var covered = {};
    records.forEach(function (r) { covered[r.testId] = 1; });
    var byDay = {};
    records.forEach(function (r) {
      if (r.result === "pending") return;
      var k = (r.date || "").slice(0, 10);
      if (!k) return;
      byDay[k] = byDay[k] || [];
    byDay[k].push(r);
    });
    var days = Object.keys(byDay).sort().slice(-14);
    var series = days.map(function (k) { return healthScore(byDay[k]); });
    var trend = series.length >= 2 ? (series[series.length - 1] - series[0]) : 0;
    var trendTxt = series.length < 2 ? "数据不足" : (trend > 0.02 ? "↗ 回升" : trend < -0.02 ? "↘ 下降" : "→ 平稳");
    var d = sparkPath(series, 120, 28);
    el.innerHTML =
      '<div class="kpi"><div class="k">健康分</div><div class="v">' + (n ? (hs * 100).toFixed(0) : "—") + (n ? "<span style=\'font-size:13px;color:var(--ink-2)\'> / 100</span>" : "") + '</div><div class="sub">(pass×1 + suspect×0.4) / 总数' + (series.length ? ' · ' + trendTxt : "") + '</div><svg class="spark" viewBox="0 0 120 28" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="#2f62ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<div class="kpi"><div class="k">降智率</div><div class="v">' + (n ? (degrade * 100).toFixed(0) + "%" : "—") + '</div><div class="sub">非 pass 占比 · 共 ' + n + " 条记录</div></div>" +
      '<div class="kpi"><div class="k">题目覆盖</div><div class="v">' + Object.keys(covered).length + " / " + allTests().length + '</div><div class="sub">已测题目 / 题库总量</div></div>' +
      '<div class="kpi"><div class="k">最近趋势</div><div class="v" style="font-size:14px;margin-top:10px">' + trendTxt + '</div><div class="sub">' + (days.length ? days[0] + " → " + days[days.length - 1] : "暂无按日数据") + "</div></div>";
  }

  var CELL_LABEL = { pass: "✅", suspect: "⚠️", fail: "❌", pending: "⏳" };

  function latestRecordFor(testId, model) {
    var best = null, bestKey = "", bestPend = null, pendKey = "";
    getRecords().forEach(function (r) {
      if (r.testId !== testId || r.model !== model) return;
      var key = (r.date || "") + "|" + (r.createdAt || "");
      if (r.result === "pending") {
    if (!bestPend || key >= pendKey) { bestPend = r; pendKey = key; }
    } else if (!best || key >= bestKey) { best = r; bestKey = key; }
  });
    return best || bestPend;
  }

  function renderMatrix(models) {
    var el = $("#matrix");
    if (!el) return;
    var tests = allTests();
    if (!tests.length || !models.length) {
      el.innerHTML = "";
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    var records = getRecords();
      el.innerHTML = tests.map(function (t) {
    var tested = records.filter(function (r) { return r.testId === t.id; }).length;
      var chips = models.map(function (m) {
      var r = latestRecordFor(t.id, m.model);
        if (!r) return "";
        var name = m.model.split("(")[0].trim();
          return '<button class="mx-chip c-' + r.result + '" data-m="' + esc(m.model) + '" data-t="' + esc(t.id) + '" ' +
        'title="' + esc(m.model + " · " + r.date) + '">' +
          "<i>" + CELL_LABEL[r.result] + "</i>" + esc(name) + "</button>";
            }).join("");
        return (
      '<div class="mx-panel">' +
      '<div class="mx-head"><b>' + esc(t.title) + "</b>" +
    '<span class="meta">' + TYPE_LABEL[t.type] + " · 已测 " + tested + " 条</span></div>" +
    (chips ? '<div class="mx-chips">' + chips + "</div>"
  : '<div class="meta" style="padding:2px 0">尚无作品</div>') +
        "</div>"
      );
    }).join("");
  }

  function renderTimeline() {
    var fm = $("#filter-model").value;
    var ft = $("#filter-test") ? $("#filter-test").value : "";
    var fr = $("#filter-result").value;
    var records = getRecords().filter(function (r) {
      return (!fm || r.model === fm) && (!ft || r.testId === ft) && (!fr || r.result === fr);
    });

    $("#timeline").innerHTML = records.map(function (r) {
      var hasHtml = !!(r.html || r.src);
      return (
        '<div class="record rec-' + r.result + '">' +
        '<div class="record-head">' +
        '<div class="rec-id">' +
        '<div class="rec-model">' + esc(r.model) +
        (r.channel ? '<span class="rec-channel">' + esc(r.channel) + "</span>" : "") + "</div>" +
        '<div class="rec-sub">' + esc(r.testTitle) + " · " + esc(r.date) +
        ' <span class="badge ' + r.testType + '">' + TYPE_LABEL[r.testType] + "</span></div>" +
        "</div>" +
        '<span class="right"><span class="badge res-' + r.result + '">' + RESULT_LABEL[r.result] + "</span></span>" +
        "</div>" +
        '<div class="record-body">' +
        (r.answer ? "<div>模型答案：" + esc(r.answer) + "</div>" : "") +
          (r.note ? '<div class="rec-note">' + esc(r.note) + "</div>" : "") +
            (hasHtml ? '<button class="btn btn-ghost btn-sm" data-toggle="' + r.id + '">展开作品预览</button>' : "") +
        (r.src ? ' <a class="btn btn-ghost btn-sm" style="text-decoration:none" href="' + esc(r.src) + '" target="_blank" rel="noopener">↗ 单独页面</a>' : "") +
        (hasHtml ? '<div class="preview-wrap" id="pv-' + r.id + '" style="display:none">' +
      '<iframe sandbox="allow-scripts allow-popups"></iframe></div>' : "") +
    '<div style="margin-top:8px"><button class="btn btn-danger btn-sm" data-del="' + r.id + '">删除</button></div>' +
        "</div></div>"
      );
    }).join("") || '<div class="empty">没有匹配的记录</div>';
  }

  $("#timeline").addEventListener("click", function (e) {
    var tog = e.target.closest("[data-toggle]");
    if (tog) {
      var wrap = $("#pv-" + tog.dataset.toggle);
      if (!wrap) return;
      var show = wrap.style.display === "none";
      wrap.style.display = show ? "" : "none";
      tog.textContent = show ? "收起作品预览" : "展开作品预览";
      if (show) {
        var rec = getRecords().filter(function (r) { return r.id === tog.dataset.toggle; })[0];
        if (rec) {
          var frame = wrap.querySelector("iframe");
          if (rec.src) { frame.removeAttribute("srcdoc"); frame.src = rec.src; }
          else frame.srcdoc = rec.html;
        }
      }
      return;
    }
    var del = e.target.closest("[data-del]");
    if (del && confirm("确定删除这条测试记录？")) {
      setRecords(getRecords().filter(function (r) { return r.id !== del.dataset.del; }));
      refreshAll();
      toast("记录已删除");
    }
  });
  $("#filter-model").addEventListener("change", renderTimeline);
  $("#filter-test").addEventListener("change", renderTimeline);
  $("#filter-result").addEventListener("change", renderTimeline);

  var matrixEl = $("#matrix");
  if (matrixEl) matrixEl.addEventListener("click", function (e) {
    var c = e.target.closest(".mx-chip[data-m]");
    if (!c) return;
    $("#filter-model").value = c.dataset.m;
    $("#filter-test").value = c.dataset.t;
    renderTimeline();
    $("#timeline-filter").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  $("#model-cards").addEventListener("click", function (e) {
    var card = e.target.closest(".model-card[data-model]");
    if (!card) return;
    $("#filter-model").value = card.dataset.model;
    $("#filter-test").value = "";
    $("#filter-result").value = "";
    renderTimeline();
    $("#timeline-filter").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ============================================================
  // 数据管理
  // ============================================================
  $("#btn-export").addEventListener("click", function () {
    var payload = {
      exportedAt: new Date().toISOString(),
      records: getRecords(),
      customTests: getCustomTests()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "model-test-records-" + today() + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  });

  $("#btn-import").addEventListener("click", function () { $("#import-file").click(); });
  $("#import-file").addEventListener("change", function () {
    var file = this.files[0];
    this.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var recs = Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : null);
        if (!recs) throw new Error("格式不符");
        var existing = getRecords();
        var seen = {};
        existing.forEach(function (r) { seen[r.id] = 1; });
        var added = 0;
        recs.forEach(function (r) {
          if (r && r.id && !seen[r.id]) { existing.push(r); seen[r.id] = 1; added++; }
        });
        existing.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
        setRecords(existing);
        if (Array.isArray(data.customTests)) {
          var customs = getCustomTests();
          var cSeen = {};
          customs.forEach(function (t) { cSeen[t.id] = 1; });
          data.customTests.forEach(function (t) {
            if (t && t.id && !cSeen[t.id]) { customs.push(t); cSeen[t.id] = 1; }
          });
          setCustomTests(customs);
        }
        refreshAll();
        toast("导入完成，新增 " + added + " 条记录");
      } catch (err) {
        alert("导入失败：文件不是有效的导出 JSON");
      }
    };
    reader.readAsText(file);
  });

  $("#btn-clear").addEventListener("click", function () {
    if (!confirm("确定清空全部测试记录？此操作不可恢复（自定义题目不受影响）。")) return;
    if (!confirm("再次确认：真的要清空全部测试记录吗？")) return;
    setRecords([]);
    refreshAll();
    toast("已清空全部测试记录");
  });

  $("#btn-add-test").addEventListener("click", function () {
    var title = $("#n-title").value.trim();
    var prompt = $("#n-prompt").value.trim();
    var type = $("#n-type").value;
    var answer = $("#n-answer").value.trim();
    var url = $("#n-url").value.trim();
    if (!title) { toast("请填写标题"); return; }
    if (!prompt) { toast("请填写提示词"); return; }
    if (type === "logic" && !answer) { toast("逻辑题请填写标准答案"); return; }

    var test = {
      id: "custom-" + Date.now(),
      title: title,
      type: type,
      tags: ["自定义"],
      difficulty: 2,
      source: url ? { author: "手动添加", url: url } : null,
      prompt: prompt,
      reference: type === "logic"
        ? { mode: "auto", answer: answer, explanation: "" }
        : { mode: "manual", checklist: [], failSigns: [] },
      _custom: true
    };
    var customs = getCustomTests();
    customs.push(test);
    setCustomTests(customs);
    $("#n-title").value = ""; $("#n-prompt").value = ""; $("#n-answer").value = ""; $("#n-url").value = "";
    refreshAll();
    toast("题目已添加（本机保存）");
  });

  function renderCustomList() {
    var customs = getCustomTests();
    $("#custom-tests-list").innerHTML = customs.length
      ? customs.map(function (t) {
          return '<div class="meta" style="margin-bottom:4px">• ' + esc(t.title) +
            "（" + TYPE_LABEL[t.type] + (t.type === "logic" ? "，答案 " + esc(t.reference && t.reference.answer) : "") + "）</div>";
        }).join("")
      : '<div class="meta">暂无自定义题目</div>';
  }

  // ============================================================
  // 提交历史（提交作品页）
  // ============================================================
  function renderSubmitHistory() {
    var el = $("#submit-history");
    if (!el) return;
    var recs = getRecords().slice().sort(function (a, b) {
      return ((b.date || "") + "|" + (b.createdAt || "")).localeCompare((a.date || "") + "|" + (a.createdAt || ""));
    });
    el.innerHTML = recs.map(function (r) {
      return (
        '<div class="sh-item rec-' + r.result + '">' +
        '<div class="sh-line">' +
        '<span class="badge res-' + r.result + '">' + RESULT_LABEL[r.result] + "</span>" +
        "<b>" + esc(r.model) + "</b>" +
        (r.channel ? '<span class="rec-channel">' + esc(r.channel) + "</span>" : "") +
        '<span class="meta">' + esc(r.testTitle) + " · " + esc(r.date) + "</span>" +
        (r.src ? '<a class="btn btn-ghost btn-sm" style="text-decoration:none;margin-left:auto" href="' + esc(r.src) + '" target="_blank" rel="noopener">↗ 作品</a>' : "") +
        "</div>" +
        (r.note ? '<div class="sh-note">' + esc(r.note) + "</div>" : "") +
        "</div>"
      );
    }).join("") || '<div class="empty">还没有提交记录</div>';
  }

  // ============================================================
  // header 统计 + 总刷新
  // ============================================================
  function renderStats() {
    var records = getRecords();
    $("#stat-tests").textContent = allTests().length;
    $("#stat-records").textContent = records.length;
    $("#stat-latest").textContent = records.length
      ? records.reduce(function (a, b) { return (a.date || "") > (b.date || "") ? a : b; }).date
      : "—";
  }

  function refreshAll() {
    renderLibrary();
    renderTestSelect();
    syncSubmitFields();
    renderDashboard();
    renderSubmitHistory();
    renderCustomList();
  renderStats();
  }

  // hero collapse (persisted)
  (function () {
    var KEY = "mt_hero_collapsed";
    var hero = $("#hero"), grid = $("#hero-grid"), btn = $("#hero-toggle");
    if (!hero || !btn) return;
    function apply(collapsed) {
      grid.style.display = collapsed ? "none" : "";
      hero.style.padding = collapsed ? "10px 28px" : "";
      btn.textContent = collapsed ? "展开" : "收起";
      btn.setAttribute("aria-expanded", String(!collapsed));
    }
    var collapsed = localStorage.getItem(KEY) === "1";
    apply(collapsed);
    btn.addEventListener("click", function () {
      collapsed = !collapsed;
      localStorage.setItem(KEY, collapsed ? "1" : "0");
      apply(collapsed);
    });
  })();

  // init
  $("#f-date").value = today();
  refreshAll();
})();
