// ============================================================
// 站点配置
// 战报真源是 GitHub Issues（label = report），票源是 issue 的 👍 / 👎。
// 本文件只放常量，逻辑在 app.js。
// ============================================================

window.APP_CONFIG = {
  siteName: "模型降智监测",
  tagline: "社区实测 · 公开计票 · 结论由投票产生",

  repo: {
    owner: "nxxxsooo",
    name: "model-test"
  },

  // 战报 issue 的筛选标签与 issue 模板文件名
  reportLabel: "report",
  issueTemplate: "report.yml",

  // 投票判定阈值：见 README「结论怎么来的」
  verdict: {
    minVotes: 3,       // 低于此票数一律「待验证」
    failRatio: 2 / 3,  // 降智票占比 ≥ 此值 → 降智
    passRatio: 1 / 3   // 降智票占比 ≤ 此值 → 正常
  },

  // 实时层缓存时长，用于规避 GitHub 未认证 API 的 60 次/小时/IP 限流
  cacheTtlMs: 5 * 60 * 1000,

  // 限流或断网时的降级快照（由 scripts/update-snapshot.sh 生成）
  snapshotUrl: "data/snapshot.json",

  // issue 模板的字段 id，用于站内表单预填 URL
  fields: {
    test: "test",
    model: "model",
    channel: "channel",
    date: "date",
    claim: "claim",
    link: "link",
    note: "note"
  },

  // issue 正文中各字段对应的小标题（必须与 report.yml 的 label 一致）
  labels: {
    test: "题目",
    model: "模型",
    channel: "渠道",
    date: "测试日期",
    claim: "我的判定",
    link: "作品链接",
    note: "说明"
  }
};
