/* Standalone viewer. Only registered sample paths can enter the sandbox. */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var OBS = CFG.observation || { ok: "符合预期", issue: "有明显问题", mixed: "部分退化", unrated: "未评价" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var params = new URLSearchParams(window.location.search);
  var allSamples = window.SAMPLES || [];
  var allTests = window.MODEL_TESTS || [];
  var currentSample = allSamples.filter(function (s) {
    return params.has("sample") ? s.id === params.get("sample") : s.src === params.get("src");
  })[0];
  var currentTest = currentSample && allTests.filter(function (t) { return t.id === currentSample.testId; })[0];
  var status = document.getElementById("work-status");

  if (!currentSample || !currentTest || !currentSample.src || !/^results\/[^?#]+\.html$/.test(currentSample.src)) {
    status.textContent = "没有找到这件作品。请返回题目集选择其他样例。";
    document.getElementById("work-back").querySelector("span").textContent = "返回题目集";
    return;
  }

  var siblings = allSamples.filter(function (s) {
    return s.testId === currentTest.id && s.src && /^results\/[^?#]+\.html$/.test(s.src);
  });

  var promptDialog = document.getElementById("prompt-dialog");
  var noteDialog = document.getElementById("note-dialog");
  var promptOpen = document.getElementById("prompt-open");
  var noteOpen = document.getElementById("note-open");
  var reloadBtn = document.getElementById("work-reload");
  var prevBtn = document.getElementById("work-prev");
  var nextBtn = document.getElementById("work-next");
  var selectEl = document.getElementById("work-select");
  var copyStatus = document.getElementById("copy-status");
  var loadTimer = null;

  function renderNoteBody(sample, test) {
    var obsKey = sample.observation || "unrated";
    var obsLabel = OBS[obsKey] || "未评价";
    var html = '<div class="work-note-card"><p><span class="obs-badge" data-obs="' + esc(obsKey) +
      '"><span class="obs-dot" aria-hidden="true"></span>' + esc(obsLabel) + ' · 贡献者观察</span></p>' +
      '<p>' + esc(sample.note || "该样例暂无详细文字备注。") + "</p></div>";
    var ref = test.reference || {};
    if (ref.checklist && ref.checklist.length) {
      html += '<section class="reference-section"><h3>观察检查点</h3><ol class="checklist-alpha">' +
        ref.checklist.map(function (item, idx) {
          return '<li><span class="check-code" aria-hidden="true">' + String.fromCharCode(65 + idx) +
            '</span><span>' + esc(item) + "</span></li>";
        }).join("") + "</ol></section>";
    }
    if (ref.failSigns && ref.failSigns.length) {
      html += '<section class="reference-section"><h3>常见退化迹象</h3><ul>' +
        ref.failSigns.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") +
        "</ul></section>";
    }
    document.getElementById("work-note-body").innerHTML = html;
  }

  function shortTitle(t) {
    return (t && t.title ? t.title : "").replace(/（.*?）/g, "").trim();
  }

  function mountWork(sample, pushHistory) {
    currentSample = sample;
    var testUrl = "./#/t/" + encodeURIComponent(currentTest.id);
    var idx = siblings.indexOf(sample);
    var posText = siblings.length > 1 ? " (" + (idx + 1) + "/" + siblings.length + ")" : "";
    var tTitle = shortTitle(currentTest);

    if (pushHistory && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "work.html?sample=" + encodeURIComponent(sample.id));
    }

    document.title = sample.model + " · " + tTitle + " · 降智测试题集";
    document.getElementById("work-back").href = testUrl;
    document.getElementById("prompt-related").href = testUrl;
    document.getElementById("work-model").textContent = sample.model;
    var obsText = OBS[sample.observation || "unrated"] || "未评价";
    document.getElementById("work-meta").textContent = [tTitle + posText, sample.channel, sample.date, obsText].filter(Boolean).join(" · ");
    document.getElementById("prompt-context").textContent = currentTest.title;
    document.getElementById("work-prompt").textContent = currentTest.prompt;
    document.getElementById("note-context").textContent = sample.model + " · " + [sample.channel, sample.date].filter(Boolean).join(" · ");
    renderNoteBody(sample, currentTest);

    selectEl.value = sample.id;
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx < 0 || idx >= siblings.length - 1;

    var stage = document.getElementById("work-stage");
    var oldFrame = stage.querySelector("iframe");
    if (oldFrame) oldFrame.remove();
    clearTimeout(loadTimer);
    status.hidden = false;
    status.textContent = "正在载入 " + sample.model + " 的作品…";

    var frame = document.createElement("iframe");
    frame.title = sample.model + " 的原始作品";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("allow", "autoplay 'none'");
    loadTimer = setTimeout(function () {
      status.textContent = "作品载入较慢，可点右上角「↺ 重载」或切换同题其他样例。";
    }, 12000);
    frame.addEventListener("load", function () {
      clearTimeout(loadTimer);
      status.hidden = true;
    });
    frame.addEventListener("error", function () {
      clearTimeout(loadTimer);
      status.textContent = "作品未能载入，请重试或返回题目。";
    });
    frame.src = sample.src + "?raw=1";
    stage.appendChild(frame);
  }

  selectEl.innerHTML = siblings.map(function (s, i) {
    var obs = OBS[s.observation || "unrated"] || "未评价";
    return '<option value="' + esc(s.id) + '">' + (i + 1) + ". " + esc(s.model) + " (" + esc(obs) + ")</option>";
  }).join("");
  selectEl.disabled = siblings.length <= 1;
  promptOpen.disabled = false;
  noteOpen.disabled = false;
  reloadBtn.disabled = false;

  selectEl.addEventListener("change", function () {
    var next = siblings.filter(function (s) { return s.id === selectEl.value; })[0];
    if (next) mountWork(next, true);
  });
  prevBtn.addEventListener("click", function () {
    var idx = siblings.indexOf(currentSample);
    if (idx > 0) mountWork(siblings[idx - 1], true);
  });
  nextBtn.addEventListener("click", function () {
    var idx = siblings.indexOf(currentSample);
    if (idx >= 0 && idx < siblings.length - 1) mountWork(siblings[idx + 1], true);
  });
  reloadBtn.addEventListener("click", function () {
    mountWork(currentSample, false);
  });

  promptOpen.addEventListener("click", function () {
    copyStatus.textContent = "";
    promptDialog.showModal();
  });
  noteOpen.addEventListener("click", function () {
    noteDialog.showModal();
  });
  document.getElementById("prompt-close").addEventListener("click", function () { promptDialog.close(); });
  document.getElementById("note-close").addEventListener("click", function () { noteDialog.close(); });

  [promptDialog, noteDialog].forEach(function (dlg) {
    dlg.addEventListener("click", function (event) {
      var rect = dlg.getBoundingClientRect();
      if (event.target === dlg && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
        dlg.close();
      }
    });
  });
  promptDialog.addEventListener("close", function () { promptOpen.focus(); });
  noteDialog.addEventListener("close", function () { noteOpen.focus(); });

  document.getElementById("prompt-copy").addEventListener("click", function () {
    function failed() {
      var range = document.createRange();
      range.selectNodeContents(document.getElementById("work-prompt"));
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = "自动复制不可用，已选中提示词，请手动复制。";
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { failed(); return; }
    navigator.clipboard.writeText(currentTest.prompt).then(function () {
      copyStatus.textContent = "已复制，可粘贴到模型对话中。";
    }, failed);
  });

  mountWork(currentSample, false);
})();
