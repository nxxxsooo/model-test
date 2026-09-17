// ============================================================
// 站点常量。纯静态，无运行时接口。
// ============================================================

window.APP_CONFIG = {
  siteName: "降智测试题集",
  tagline: "同一道题，不同模型的真实产出。自己看，自己判断。",

  repo: { owner: "nxxxsooo", name: "model-test" },
  issueTemplate: "sample.yml",
  sampleLabel: "sample",

  // 提交表单字段 id，与 .github/ISSUE_TEMPLATE/sample.yml 一致
  fields: {
    test: "test",
    model: "model",
    channel: "channel",
    date: "date",
    link: "link",
    note: "note"
  },

  // 提交者自评的中性标签，只用于筛选，不代表站点结论
  observation: {
    ok: "符合预期",
    issue: "有明显问题",
    mixed: "部分退化",
    unrated: "未评价"
  }
};
