// ============================================================
// 模型降质治理 · 公开共建平台核心逻辑 (Zero-dependency Vanilla JS)
// 包含：
// 1. 全网实时降智脉搏看板 (Codex-Resets Style Live Pulse)
// 2. 社区实测战报 & 题库贡献 (Crowdsource Submission)
// 3. 智能推文/对话一键解析辅助 (Smart Parser)
// 4. 社区复现认同投票机制 (+1 Verification & Upvoting)
// 5. 开放 API 与 MCP Server 配置规范
// 6. 云端 BaaS 同步客户端 (Supabase REST / LocalStorage Fallback)
// ============================================================

(function () {
  "use strict";

  var LS_RECORDS = "mt_records";
  var LS_CUSTOM = "mt_custom_tests";
  var LS_VOTES = "mt_record_votes";
  var LS_CLOUD_CFG = "mt_cloud_config";

  // ---------- DOM 工具函数 ----------
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
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.classList.remove("show"); }, 2000);
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
      if (cb) cb();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(cb, fallback);
    } else { fallback(); }
  }

  // ---------- 数据持久化与获取 ----------
  function allTests() { return (window.MODEL_TESTS || []).concat(getCustomTests()); }
  function getCustomTests() { return loadJSON(LS_CUSTOM, []); }
  function setCustomTests(list) { saveJSON(LS_CUSTOM, list); }
  function getRecords() { return loadJSON(LS_RECORDS, []); }
  function setRecords(list) { saveJSON(LS_RECORDS, list); }
  function getVotes() { return loadJSON(LS_VOTES, {}); }
  function setVotes(obj) { saveJSON(LS_VOTES, obj); }

  function findTest(id) {
    var list = allTests();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var RESULT_LABEL = { pass: "✅ 正常", suspect: "⚠️ 疑似降智", fail: "❌ 失败 / 降智", pending: "⏳ 待判定" };
  var TYPE_LABEL = { graphic: "图形题", logic: "逻辑题" };

  // ---------- 种子记录合入 ----------
  (function seedRecords() {
    var KEY = "mt_seeded_records_v3";
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

  // ============================================================
  // 云端 BaaS 客户端 (Supabase Integration & Fallback)
  // ============================================================
  var CloudClient = {
    getConfig: function () {
      var local = loadJSON(LS_CLOUD_CFG, null);
      if (local && local.url && local.anonKey) return local;
      if (window.APP_CONFIG && window.APP_CONFIG.supabase && window.APP_CONFIG.supabase.url) {
        return window.APP_CONFIG.supabase;
      }
      return null;
    },
    saveConfig: function (url, anonKey) {
      saveJSON(LS_CLOUD_CFG, { url: url.trim(), anonKey: anonKey.trim() });
    },
    isConnected: function () {
      var c = this.getConfig();
      return !!(c && c.url && c.anonKey && c.url.indexOf("http") === 0);
    },
    updateStatusUI: function (state, text) {
      var dot = $("#cloud-dot");
      var txt = $("#cloud-status-text");
      if (!dot || !txt) return;
      dot.className = "cloud-dot" + (state ? " " + state : "");
      txt.textContent = text;
    },
    syncToCloud: function (record, cb) {
      var cfg = this.getConfig();
      if (!this.isConnected()) {
        // 本地模式：无需网络请求，直接模拟成功
        if (cb) cb(null, { local: true });
        return;
      }
      var url = cfg.url.replace(/\/+$/, "") + "/rest/v1/model_records";
      var body = {
        id: record.id,
        test_id: record.testId,
        test_title: record.testTitle,
        test_type: record.testType || "graphic",
        model: record.model,
        channel: record.channel || "",
        date: record.date || today(),
        result: record.result,
        note: record.note || "",
        contributor: record.contributor || "社区成员",
        contributor_url: record.contributorUrl || "",
        html: record.html || "",
        src: record.src || "",
        answer: record.answer || "",
        upvotes: record.upvotes || 0,
        verified_normal: record.verifiedNormal || 0,
        created_at: record.createdAt || new Date().toISOString()
      };

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.anonKey,
          "Authorization": "Bearer " + cfg.anonKey,
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().catch(function () { return {}; });
      }).then(function (data) {
        if (cb) cb(null, data);
      }).catch(function (err) {
        console.warn("Cloud sync failed, saved locally:", err);
        if (cb) cb(err);
      });
    },
    fetchCloudRecords: function (cb) {
      var cfg = this.getConfig();
      if (!this.isConnected()) {
        if (cb) cb(null, getRecords());
        return;
      }
      var url = cfg.url.replace(/\/+$/, "") + "/rest/v1/model_records?select=*&order=created_at.desc&limit=100";
      fetch(url, {
        headers: {
          "apikey": cfg.anonKey,
          "Authorization": "Bearer " + cfg.anonKey
        }
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (data) {
        if (Array.isArray(data) && data.length) {
          // 合并到本地
          var local = getRecords();
          var seen = {};
          local.forEach(function (r) { seen[r.id] = 1; });
          data.forEach(function (item) {
            var rec = {
              id: item.id,
              testId: item.test_id,
              testTitle: item.test_title,
              testType: item.test_type,
              model: item.model,
              channel: item.channel,
              date: item.date,
              result: item.result,
              note: item.note,
              contributor: item.contributor,
              contributorUrl: item.contributor_url,
              html: item.html,
              src: item.src,
              answer: item.answer,
              upvotes: item.upvotes || 0,
              verifiedNormal: item.verified_normal || 0,
              createdAt: item.created_at
            };
            if (!seen[rec.id]) { local.unshift(rec); seen[rec.id] = 1; }
          });
          setRecords(local);
        }
        if (cb) cb(null, getRecords());
      }).catch(function (err) {
        if (cb) cb(err, getRecords());
      });
    }
  };

  // 初始化云端状态标签
  function refreshCloudStatusIndicator() {
    if (CloudClient.isConnected()) {
      CloudClient.updateStatusUI("", "🟢 云端已连接 (实时共享)");
    } else {
      CloudClient.updateStatusUI("offline", "💾 本地就绪 · 点击配云端");
    }
  }

  // ============================================================
  // 全网实时降智脉搏看板 (Codex-Resets Style Live Pulse)
  // ============================================================
  function renderLivePulse() {
    var banner = $("#pulse-banner");
    if (!banner) return;
    var records = getRecords();
    var judged = records.filter(function (r) { return r.result !== "pending"; });

    var degradeCount = judged.filter(function (r) { return r.result === "fail" || r.result === "suspect"; }).length;
    var degradeRate = judged.length ? Math.round((degradeCount / judged.length) * 100) : 0;

    var tag = $("#pulse-tag");
    var headline = $("#pulse-headline");
    var lastTime = $("#pulse-last-time");
    var rateEl = $("#pulse-degrade-rate");
    var totalEl = $("#pulse-total-reports");
    var ticker = $("#ticker-content");

    totalEl.textContent = records.length;
    rateEl.textContent = degradeRate + "%";

    var latest = records.length ? records[0] : null;
    if (latest) {
      lastTime.textContent = (latest.date || "今天") + (latest.contributor ? " (" + latest.contributor + ")" : "");
      ticker.innerHTML = '<b>' + esc(latest.model) + '</b> 在题目 <i>' + esc(latest.testTitle) + '</i> 实测为 ' +
        '<span class="badge res-' + latest.result + '">' + RESULT_LABEL[latest.result] + '</span>' +
        (latest.note ? ' · "' + esc(latest.note).slice(0, 40) + '..."' : '');
    } else {
      lastTime.textContent = "暂无实测";
      ticker.textContent = "点击右上角「我要贡献」成为首位上报者";
    }

    // 根据降智率设置状态外观
    banner.classList.remove("status-yellow", "status-red");
    if (degradeRate > 40) {
      banner.classList.add("status-red");
      tag.textContent = "🔴 突发大面积降智警报";
      headline.textContent = "检测到受检模型近期高频发生结构性退化，建议降低关键产出依赖";
    } else if (degradeRate > 15) {
      banner.classList.add("status-yellow");
      tag.textContent = "🟡 局部模型疑似降智";
      headline.textContent = "部分模型在多关节空间与长链推理上出现退化现象，请对照 Checklist 验证";
    } else {
      tag.textContent = "🟢 全网模型总体稳定";
      headline.textContent = "受检主流模型整体表现平稳，基准回归测试多数正常";
    }
  }

  // ============================================================
  // 导航 Tabs 切换
  // ============================================================
  $("#tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    $all("#tabs button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    $all(".view").forEach(function (v) { v.classList.remove("active"); });
    var v = $("#view-" + btn.dataset.view);
    if (v) v.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function gotoView(name) {
    var btn = $('#tabs button[data-view="' + name + '"]');
    if (btn) btn.click();
  }

  // 顶栏快捷按钮跳转
  $("#pulse-btn-submit").addEventListener("click", function () { gotoView("contribute"); });
  $("#pulse-btn-mcp").addEventListener("click", function () { gotoView("api"); });
  $("#cloud-status-btn").addEventListener("click", function () { gotoView("data"); });

  // ============================================================
  // 1. 公开题库 (Library)
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
      html += "<div><b>通过要点 (Checklist)</b></div><ul>" +
        r.checklist.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
    }
    if (r.failSigns && r.failSigns.length) {
      html += "<div style='margin-top:6px'><b>典型降智特征 (Fail Signs)</b></div><ul>" +
        r.failSigns.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
    }
    if (r.explanation) {
      html += '<div class="expl">' + esc(r.explanation).replace(/\n/g, "<br>") + "</div>";
    }
    return html || "<div class='meta'>暂无参考标准</div>";
  }

  function renderLibrary() {
    renderChips();
    var list = allTests().filter(function (t) { return libFilter === "all" || t.type === libFilter; });
    $("#library-cards").innerHTML = list.map(function (t) {
      var src = t.source || {};
      var srcLine = "";
      if (src.url) {
        srcLine = '出处：<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' +
          esc(src.author || src.handle || "来源推文") + (src.date ? " · " + esc(src.date) : "") + "</a>";
      } else if (src.author) {
        srcLine = "出处：" + esc(src.author);
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
        '<button class="btn btn-ghost btn-sm" data-goto-submit="' + esc(t.id) + '">上传我的实测 →</button>' +
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
        toast("提示词已复制到剪贴板，请粘贴给模型作答");
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
      if (!confirm("确定删除该自定义题目？")) return;
      setCustomTests(getCustomTests().filter(function (t) { return t.id !== delBtn.dataset.delTest; }));
      refreshAll();
      toast("题目已删除");
    }
  });

  $("#btn-goto-add-test").addEventListener("click", function () {
    gotoView("contribute");
    $("#tab-sub-test").click();
  });

  // ============================================================
  // 2. 贡献与上传中心 (Contribution Center)
  // ============================================================
  var currentContribMode = "report"; // 'report' | 'test'

  $("#tab-sub-report").addEventListener("click", function () {
    currentContribMode = "report";
    this.classList.add("active");
    $("#tab-sub-test").classList.remove("active");
    $("#form-wrap-report").style.display = "";
    $("#form-wrap-test").style.display = "none";
  });

  $("#tab-sub-test").addEventListener("click", function () {
    currentContribMode = "test";
    this.classList.add("active");
    $("#tab-sub-report").classList.remove("active");
    $("#form-wrap-report").style.display = "none";
    $("#form-wrap-test").style.display = "";
  });

  $("#n-type").addEventListener("change", function () {
    $("#n-logic-answer-wrap").style.display = this.value === "logic" ? "" : "none";
  });

  // 智能推文/对话一键解析辅助 (Smart Parser)
  $("#btn-smart-parse").addEventListener("click", function () {
    var raw = $("#smart-parse-input").value.trim();
    if (!raw) { toast("请先粘贴推文或讨论文本"); return; }

    var models = ["Claude 3.7", "Claude 3.5 Sonnet", "GPT-5 Astra", "GPT-5.6 Sol", "GPT-5.5", "GPT-4o", "DeepSeek V4 Pro", "DeepSeek V4 Flash", "DeepSeek V3", "Qwen 3.8 max", "Qwen 3.7", "Kimi K3", "GLM 5.3", "Opus 5", "Muse Spark 1.3", "Muse Spark", "CodeM"];
    var matchedModel = "";
    for (var i = 0; i < models.length; i++) {
      if (new RegExp(models[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i").test(raw)) {
        matchedModel = models[i];
        break;
      }
    }

    var tests = allTests();
    var matchedTest = null;
    for (var j = 0; j < tests.length; j++) {
      var t = tests[j];
      if (raw.indexOf(t.title) >= 0 || (t.tags && t.tags.some(function (tg) { return raw.indexOf(tg) >= 0; }))) {
        matchedTest = t;
        break;
      }
      if (t.id.indexOf("pelican") >= 0 && (raw.indexOf("鹈鹕") >= 0 || raw.indexOf("骑车") >= 0 || raw.indexOf("自行车") >= 0)) { matchedTest = t; break; }
      if (t.id.indexOf("wukong") >= 0 && (raw.indexOf("悟空") >= 0 || raw.indexOf("飞机") >= 0)) { matchedTest = t; break; }
      if (t.id.indexOf("qinshihuang") >= 0 && (raw.indexOf("秦始皇") >= 0 || raw.indexOf("北极熊") >= 0)) { matchedTest = t; break; }
      if (t.id.indexOf("trilogy") >= 0 && raw.indexOf("三合一") >= 0) { matchedTest = t; break; }
    }

    var matchedResult = "fail";
    if (/(成功|完美|通过|很稳|满分|正常|pass)/i.test(raw)) matchedResult = "pass";
    else if (/(疑似|欠佳|略差|勉强|suspect)/i.test(raw)) matchedResult = "suspect";
    else if (/(降智|失败|崩坏|穿模|错位|不会|不行|fail)/i.test(raw)) matchedResult = "fail";

    if (matchedModel) $("#f-model").value = matchedModel;
    if (matchedTest) {
      $("#f-test").value = matchedTest.id;
      syncSubmitFields();
    }
    setRadio(matchedResult);
    if (!$("#f-note").value) $("#f-note").value = raw;

    toast("已智能识别：模型「" + (matchedModel || "未明") + "」· 题目「" + (matchedTest ? matchedTest.title : "未明") + "」· 判定「" + RESULT_LABEL[matchedResult] + "」");
  });

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

  // 逻辑题快速自动对答案
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
      ? '<span style="color:var(--green)">✓ 检测到标准答案 ' + esc(expect) + "，自动判定为「正常」</span>"
      : '<span style="color:var(--red)">✗ 未检测到标准答案（应为 ' + esc(expect) + "），自动判定为「失败 / 降智」</span>";
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
    gotoView("contribute");
    $("#tab-sub-report").click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 提交实测战报发布
  $("#btn-save").addEventListener("click", function () {
    var t = currentSelectedTest();
    if (!t) { toast("请选择题目"); return; }
    var model = $("#f-model").value.trim();
    if (!model) { toast("请填写模型名称"); $("#f-model").focus(); return; }
    var resultInput = document.querySelector('#f-result input[name="result"]:checked');
    if (!resultInput) { toast("请选择判定结果"); return; }

    var contributor = $("#f-contributor").value.trim() || "社区极客";
    var contributorUrl = $("#f-contributor-url").value.trim();

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
      contributor: contributor,
      contributorUrl: contributorUrl,
      upvotes: 0,
      verifiedNormal: 0,
      createdAt: new Date().toISOString()
    };

    if (t.type === "logic") {
      rec.answer = $("#f-answer").value.trim();
    } else {
      var html = $("#f-html").value;
      var src = $("#f-src").value.trim();
      if (!html.trim() && !src) { toast("图形题请粘贴作品 HTML，或填写文件路径"); return; }
      if (html.trim()) rec.html = html;
      if (src) rec.src = src;
    }

    var records = getRecords();
    records.unshift(rec);
    setRecords(records);

    // 云端同步尝试
    CloudClient.syncToCloud(rec);

    // 清空表单
    $("#f-html").value = "";
    $("#f-src").value = "";
    $("#f-answer").value = "";
    $("#f-verdict").textContent = "";
    $("#f-note").value = "";
    $("#submit-preview").style.display = "none";
    $all("#f-result label").forEach(function (l) { l.classList.remove("checked"); });
    $all('#f-result input').forEach(function (i) { i.checked = false; });

    refreshAll();
    toast("🎉 实测战报已公开发布！");
    gotoView("dashboard");
  });

  // 贡献新题
  $("#btn-add-test").addEventListener("click", function () {
    var title = $("#n-title").value.trim();
    var prompt = $("#n-prompt").value.trim();
    var type = $("#n-type").value;
    var author = $("#n-author").value.trim() || "社区出题人";
    var url = $("#n-url").value.trim();
    var answer = $("#n-answer").value.trim();
    var checklist = $("#n-checklist").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var failSigns = $("#n-failsigns").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);

    if (!title) { toast("请填写题目名称"); return; }
    if (!prompt) { toast("请填写提示词"); return; }
    if (type === "logic" && !answer) { toast("逻辑题请填写标准答案"); return; }

    var test = {
      id: "test-" + Date.now(),
      title: title,
      type: type,
      tags: ["社区贡献", type === "graphic" ? "图形题" : "逻辑题"],
      difficulty: 2,
      source: { author: author, url: url, date: today() },
      prompt: prompt,
      reference: type === "logic"
        ? { mode: "auto", answer: answer, checklist: checklist, failSigns: failSigns }
        : { mode: "manual", checklist: checklist, failSigns: failSigns },
      _custom: true
    };

    var customs = getCustomTests();
    customs.push(test);
    setCustomTests(customs);

    $("#n-title").value = ""; $("#n-prompt").value = ""; $("#n-answer").value = "";
    $("#n-checklist").value = ""; $("#n-failsigns").value = "";

    refreshAll();
    toast("✨ 新题目已收录进公开题库！");
    gotoView("library");
  });

  // ============================================================
  // 3. 回归看板与时间线 (Dashboard & Community Verification)
  // ============================================================
  function renderDashboard() {
    var records = getRecords();

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
        '<div class="model-card mc-' + m.latestResult + '" data-model="' + esc(m.model) + '" title="点击筛选该模型的全部评测">' +
        '<div class="mc-top">' +
        '<span class="mc-name">' + esc(m.model) + "</span>" +
        '<span class="badge res-' + m.latestResult + '">' + ICON[m.latestResult] + " 最近</span>" +
        "</div>" +
        (channels ? '<div class="mc-channel">' + esc(channels) + "</div>" : "") +
        '<div class="mc-mid">' +
        '<span class="mc-cell"><b>' + pct(m.pass) + '%</b><i>通过率' + (judged && judged < total ? "（已判）" : "") + "</i></span>" +
        '<span class="mc-cell"><b>' + total + "</b><i>次实测</i></span>" +
        '<span class="mc-cell"><b>' + esc((m.latest || "—").slice(5)) + "</b><i>最近测试</i></span>" +
        "</div>" +
        '<div class="rate-bar">' +
        '<div class="p-pass" style="width:' + pct(m.pass) + '%"></div>' +
        '<div class="p-suspect" style="width:' + pct(m.suspect) + '%"></div>' +
        '<div class="p-fail" style="width:' + pct(m.fail) + '%"></div>' +
        "</div>" +
        '<div class="mc-nums">✅ ' + m.pass + " · ⚠️ " + m.suspect + " · ❌ " + m.fail +
        (m.pending ? " · ⏳ " + m.pending : "") + "</div>" +
        "</div>"
      );
    }).join("") || '<div class="empty">还没有评测战报，点击上方「我要贡献」录入第一条吧</div>';

    // 筛选下拉
    var prevModel = $("#filter-model").value;
    $("#filter-model").innerHTML = '<option value="">全部模型</option>' +
      models.map(function (m) { return '<option value="' + esc(m.model) + '">' + esc(m.model) + "</option>"; }).join("");
    if (prevModel) $("#filter-model").value = prevModel;

    var prevTest = $("#filter-test") ? $("#filter-test").value : "";
    if ($("#filter-test")) {
      $("#filter-test").innerHTML = '<option value="">全部题目</option>' +
        allTests().map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(TYPE_LABEL[t.type]) + " · " + esc(t.title) + "</option>"; }).join("");
      if (prevTest) $("#filter-test").value = prevTest;
    }

    renderHealth(records);
    renderMatrix(models);
    renderTimeline();
    renderLivePulse();
  }

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
    var trendTxt = series.length < 2 ? "平稳运行" : (trend > 0.02 ? "↗ 表现回升" : trend < -0.02 ? "↘ 降智退化" : "→ 波动较小");
    var d = sparkPath(series, 120, 26);
    el.innerHTML =
      '<div class="kpi"><div class="k">全网模型健康分</div><div class="v">' + (n ? (hs * 100).toFixed(0) : "—") + '<span style=\'font-size:12px;color:var(--ink-2)\'> / 100</span></div><div class="sub">' + trendTxt + '</div><svg class="spark" viewBox="0 0 120 26" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<div class="kpi"><div class="k">整体降智率</div><div class="v">' + (n ? (degrade * 100).toFixed(0) + "%" : "—") + '</div><div class="sub">非 pass 战报占比 · ' + n + ' 份</div></div>' +
      '<div class="kpi"><div class="k">基准题覆盖</div><div class="v">' + Object.keys(covered).length + " / " + allTests().length + '</div><div class="sub">已实测 / 题库总数</div></div>' +
      '<div class="kpi"><div class="k">社区活跃度</div><div class="v" style="font-size:16px;margin-top:8px">开放共建中</div><div class="sub">' + (days.length ? days[0] + " 至今" : "今日更新") + '</div></div>';
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
    if (!tests.length || !models.length) { el.innerHTML = ""; el.style.display = "none"; return; }
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
        '<span class="meta">' + TYPE_LABEL[t.type] + " · 战报 " + tested + " 份</span></div>" +
        (chips ? '<div class="mx-chips">' + chips + "</div>" : '<div class="meta" style="padding:2px 0">尚无实测战报</div>') +
        "</div>"
      );
    }).join("");
  }

  // 渲染实测战报时间线（包含社区认同投票）
  function renderTimeline() {
    var fm = $("#filter-model").value;
    var ft = $("#filter-test") ? $("#filter-test").value : "";
    var fr = $("#filter-result").value;
    var votes = getVotes();

    var records = getRecords().filter(function (r) {
      return (!fm || r.model === fm) && (!ft || r.testId === ft) && (!fr || r.result === fr);
    });

    $("#timeline").innerHTML = records.map(function (r) {
      var hasHtml = !!(r.html || r.src);
      var userVote = votes[r.id] || "";
      var upvotes = (r.upvotes || 0) + (userVote === "fail" ? 1 : 0);
      var normals = (r.verifiedNormal || 0) + (userVote === "pass" ? 1 : 0);

      var authorTag = r.contributorUrl
        ? '<a href="' + esc(r.contributorUrl) + '" target="_blank" rel="noopener" class="rec-contributor">by ' + esc(r.contributor || "社区极客") + ' ↗</a>'
        : (r.contributor ? '<span class="rec-contributor">by ' + esc(r.contributor) + '</span>' : '');

      return (
        '<div class="record rec-' + r.result + '">' +
        '<div class="record-head">' +
        '<div class="rec-id">' +
        '<div class="rec-model">' + esc(r.model) +
        (r.channel ? '<span class="rec-channel">' + esc(r.channel) + "</span>" : "") +
        authorTag +
        "</div>" +
        '<div class="rec-sub">' + esc(r.testTitle) + " · " + esc(r.date) +
        ' <span class="badge ' + r.testType + '">' + TYPE_LABEL[r.testType] + "</span></div>" +
        "</div>" +
        '<span class="right"><span class="badge res-' + r.result + '">' + RESULT_LABEL[r.result] + "</span></span>" +
        "</div>" +

        '<div class="record-body">' +
        (r.answer ? '<div style="margin-top:4px"><b>模型答案：</b>' + esc(r.answer) + "</div>" : "") +
        (r.note ? '<div class="rec-note">' + esc(r.note) + "</div>" : "") +

        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">' +
        (hasHtml ? '<button class="btn btn-ghost btn-sm" data-toggle="' + r.id + '">展开作品渲染预览</button>' : "") +
        (r.src ? ' <a class="btn btn-ghost btn-sm" style="text-decoration:none" href="' + esc(r.src) + '" target="_blank" rel="noopener">↗ 独立页面</a>' : "") +
        (r.contributorUrl ? ' <a class="btn btn-ghost btn-sm" style="text-decoration:none" href="' + esc(r.contributorUrl) + '" target="_blank" rel="noopener">🔗 推特证据原帖</a>' : "") +
        '</div>' +

        (hasHtml ? '<div class="preview-wrap" id="pv-' + r.id + '" style="display:none">' +
          '<iframe sandbox="allow-scripts allow-popups"></iframe></div>' : "") +

        '<div class="record-footer">' +
        '<div class="vote-group">' +
        '<button class="btn-vote' + (userVote === "fail" ? " voted-fail" : "") + '" data-vote-fail="' + r.id + '">🔥 +1 同样复现降智 (' + upvotes + ')</button>' +
        '<button class="btn-vote' + (userVote === "pass" ? " voted" : "") + '" data-vote-pass="' + r.id + '">🟢 我测正常 (' + normals + ')</button>' +
        '</div>' +
        '<div style="margin-left:auto">' +
        '<button class="btn btn-ghost btn-sm" data-share="' + r.id + '" title="复制本条战报引用">分享</button>' +
        '<button class="btn btn-danger btn-sm" data-del="' + r.id + '">删除</button>' +
        '</div>' +
        '</div>' +

        "</div></div>"
      );
    }).join("") || '<div class="empty">没有匹配的实测战报</div>';
  }

  // 投票、预览与分享交互
  $("#timeline").addEventListener("click", function (e) {
    var tog = e.target.closest("[data-toggle]");
    if (tog) {
      var wrap = $("#pv-" + tog.dataset.toggle);
      if (!wrap) return;
      var show = wrap.style.display === "none";
      wrap.style.display = show ? "" : "none";
      tog.textContent = show ? "收起作品预览" : "展开作品渲染预览";
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

    // 社区验证投票：同样复现
    var vf = e.target.closest("[data-vote-fail]");
    if (vf) {
      var id = vf.dataset.voteFail;
      var votes = getVotes();
      if (votes[id] === "fail") { delete votes[id]; } else { votes[id] = "fail"; }
      setVotes(votes);
      renderTimeline();
      toast(votes[id] === "fail" ? "已记录您的复现反馈！" : "已取消复现标记");
      return;
    }

    // 社区验证投票：我测正常
    var vp = e.target.closest("[data-vote-pass]");
    if (vp) {
      var id = vp.dataset.votePass;
      var votes = getVotes();
      if (votes[id] === "pass") { delete votes[id]; } else { votes[id] = "pass"; }
      setVotes(votes);
      renderTimeline();
      toast(votes[id] === "pass" ? "已记录您的正常测试反馈！" : "已取消正常标记");
      return;
    }

    // 复制分享
    var share = e.target.closest("[data-share]");
    if (share) {
      var rec = getRecords().filter(function (r) { return r.id === share.dataset.share; })[0];
      if (rec) {
        var text = "【模型降智实测】" + rec.model + " 在「" + rec.testTitle + "」实测结果为 " + RESULT_LABEL[rec.result] + "\n详情见公开看板：https://model-test.vercel.app";
        copyText(text, function () { toast("已复制分享卡片文案"); });
      }
      return;
    }

    var del = e.target.closest("[data-del]");
    if (del && confirm("确定删除这条实测战报？")) {
      setRecords(getRecords().filter(function (r) { return r.id !== del.dataset.del; }));
      refreshAll();
      toast("战报已移除");
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
    $("#timeline").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#model-cards").addEventListener("click", function (e) {
    var card = e.target.closest(".model-card[data-model]");
    if (!card) return;
    $("#filter-model").value = card.dataset.model;
    $("#filter-test").value = "";
    $("#filter-result").value = "";
    renderTimeline();
    $("#timeline").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ============================================================
  // 4. 提交历史
  // ============================================================
  function renderSubmitHistory() {
    var el = $("#submit-history");
    if (!el) return;
    var recs = getRecords().slice(0, 15);
    el.innerHTML = recs.map(function (r) {
      return (
        '<div class="sh-item rec-' + r.result + '">' +
        '<div class="sh-line">' +
        '<span class="badge res-' + r.result + '">' + RESULT_LABEL[r.result] + "</span>" +
        "<b>" + esc(r.model) + "</b>" +
        (r.channel ? '<span class="rec-channel">' + esc(r.channel) + "</span>" : "") +
        (r.contributor ? '<span class="rec-contributor">by ' + esc(r.contributor) + "</span>" : "") +
        '<span class="meta">' + esc(r.testTitle) + " · " + esc(r.date) + "</span>" +
        (r.src ? '<a class="btn btn-ghost btn-sm" style="text-decoration:none;margin-left:auto" href="' + esc(r.src) + '" target="_blank" rel="noopener">↗ 作品</a>' : "") +
        "</div>" +
        (r.note ? '<div class="sh-note">' + esc(r.note) + "</div>" : "") +
        "</div>"
      );
    }).join("") || '<div class="empty">还没有提交记录</div>';
  }

  // ============================================================
  // 5. 开放 API 与 MCP 配置
  // ============================================================
  $("#btn-copy-mcp").addEventListener("click", function () {
    var snippet = $("#mcp-config-snippet").textContent;
    copyText(snippet, function () {
      toast("已复制 MCP Server 配置代码！");
    });
  });

  // ============================================================
  // 6. 云端 BaaS 与数据管理
  // ============================================================
  function loadCloudConfigForm() {
    var cfg = CloudClient.getConfig();
    if (cfg) {
      $("#cfg-supabase-url").value = cfg.url || "";
      $("#cfg-supabase-key").value = cfg.anonKey || "";
    }
  }

  $("#btn-save-cloud-config").addEventListener("click", function () {
    var url = $("#cfg-supabase-url").value.trim();
    var key = $("#cfg-supabase-key").value.trim();
    CloudClient.saveConfig(url, key);
    refreshCloudStatusIndicator();
    toast("云端配置已保存！正在尝试同步...");
    CloudClient.fetchCloudRecords(function (err) {
      if (err) {
        toast("云端连接测试失败，请检查 URL 与 Key");
      } else {
        toast("✅ 云端连接成功！已同步最新记录");
        refreshAll();
      }
    });
  });

  $("#btn-sync-now").addEventListener("click", function () {
    toast("正在双向同步中...");
    CloudClient.fetchCloudRecords(function (err) {
      if (err) toast("同步失败，请检查网络或配置");
      else {
        refreshAll();
        toast("✅ 双向数据同步完成");
      }
    });
  });

  // SQL 弹窗查看
  $("#btn-show-sql").addEventListener("click", function () {
    $("#sql-snippet").textContent = window.APP_CONFIG ? window.APP_CONFIG.supabaseInitSQL : "-- 请参考 data/config.js";
    $("#sql-modal").classList.add("open");
  });
  $("#btn-close-sql").addEventListener("click", function () { $("#sql-modal").classList.remove("open"); });
  $("#btn-done-sql").addEventListener("click", function () { $("#sql-modal").classList.remove("open"); });
  $("#btn-copy-sql").addEventListener("click", function () {
    copyText($("#sql-snippet").textContent, function () { toast("SQL 初始化语句已复制"); });
  });

  // 本地导出 / 导入 / 清空
  $("#btn-export").addEventListener("click", function () {
    var payload = {
      exportedAt: new Date().toISOString(),
      platform: "model-degradation-watch",
      version: "2.0.0",
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
        toast("导入完成，新增 " + added + " 条实测记录");
      } catch (err) {
        alert("导入失败：文件不是有效的战报 JSON");
      }
    };
    reader.readAsText(file);
  });

  $("#btn-clear").addEventListener("click", function () {
    if (!confirm("确定清空全部本机实测记录？此操作不可恢复。")) return;
    setRecords([]);
    refreshAll();
    toast("已清空测试记录");
  });

  // ============================================================
  // 7. 总刷新与初始化
  // ============================================================
  function renderStats() {
    var records = getRecords();
    $("#stat-tests").textContent = allTests().length;
    $("#stat-records").textContent = records.length;
    var tDay = today();
    var todayCount = records.filter(function (r) { return (r.date || "").slice(0, 10) === tDay; }).length;
    $("#stat-today").textContent = todayCount;
  }

  function refreshAll() {
    renderLivePulse();
    renderLibrary();
    renderTestSelect();
    syncSubmitFields();
    renderDashboard();
    renderSubmitHistory();
    renderStats();
    refreshCloudStatusIndicator();
  }

  // Hero 收起/展开折叠逻辑
  (function () {
    var KEY = "mt_hero_collapsed";
    var hero = $("#hero"), grid = $("#hero-grid"), btn = $("#hero-toggle");
    if (!hero || !btn) return;
    function apply(collapsed) {
      grid.style.display = collapsed ? "none" : "";
      hero.style.padding = collapsed ? "10px 24px" : "";
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

  // 启动初始化
  $("#f-date").value = today();
  loadCloudConfigForm();
  refreshAll();

  // 尝试拉取一次云端（若已配置）
  CloudClient.fetchCloudRecords(function () {
    refreshAll();
  });
})();
