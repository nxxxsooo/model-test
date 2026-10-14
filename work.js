/* Standalone viewer. Only registered sample paths can enter the sandbox. */
(function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var sample = (window.SAMPLES || []).filter(function (s) {
    return params.has("sample") ? s.id === params.get("sample") : s.src === params.get("src");
  })[0];
  var test = sample && (window.MODEL_TESTS || []).filter(function (t) { return t.id === sample.testId; })[0];
  var status = document.getElementById("work-status");
  if (!sample || !test || !sample.src || !/^results\/[^?#]+\.html$/.test(sample.src)) {
    status.textContent = "没有找到这件作品。请返回题目集选择其他样例。";
    document.getElementById("work-back").querySelector("span").textContent = "返回题目集";
    return;
  }

  var testUrl = "./#/t/" + encodeURIComponent(test.id);
  var dialog = document.getElementById("prompt-dialog");
  var open = document.getElementById("prompt-open");
  var copyStatus = document.getElementById("copy-status");
  document.title = sample.model + " · " + test.title + " · 降智测试题集";
  document.getElementById("work-back").href = testUrl;
  document.getElementById("prompt-related").href = testUrl;
  document.getElementById("work-model").textContent = sample.model;
  document.getElementById("work-meta").textContent = [test.title, sample.channel].filter(Boolean).join(" · ");
  document.getElementById("prompt-context").textContent = test.title;
  document.getElementById("work-prompt").textContent = test.prompt;
  open.disabled = false;
  open.addEventListener("click", function () {
    copyStatus.textContent = "";
    dialog.showModal();
  });
  document.getElementById("prompt-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    var rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", function () { open.focus(); });
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
    navigator.clipboard.writeText(test.prompt).then(function () {
      copyStatus.textContent = "已复制，可粘贴到模型对话中。";
    }, failed);
  });

  var frame = document.createElement("iframe");
  frame.title = sample.model + " 的原始作品";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("allow", "autoplay 'none'");
  var timer = setTimeout(function () {
    status.textContent = "作品载入较慢，可刷新重试，或返回题目查看其他样例。";
  }, 12000);
  frame.addEventListener("load", function () {
    clearTimeout(timer);
    status.hidden = true;
  });
  frame.addEventListener("error", function () {
    clearTimeout(timer);
    status.textContent = "作品未能载入，请刷新重试或返回题目。";
  });
  // raw=1 bypasses the standalone-link redirect, including in gallery previews.
  frame.src = sample.src + "?raw=1";
  document.getElementById("work-stage").appendChild(frame);
})();
