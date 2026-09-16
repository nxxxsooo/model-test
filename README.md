# 模型降智监测

社区实测 AI 模型是否降智，证据公开，结论由投票产生。

站点：https://model-test-blue.vercel.app

## 这是什么

"今天模型变笨了"通常只是体感。这个站把它变成可核对的东西：

- **固定题库** —— 所有人跑同一道题，用同一套 checklist 判定
- **公开证据** —— 每条战报都带作品链接，任何人都能点开看
- **投票定结论** —— 结论不是站长说了算，是社区投票的结果

## 结论怎么来的

每条战报就是一个带 `report` 标签的 GitHub Issue。投票用 issue 的表情：

- 👍 = **我也复现了降智**
- 👎 = **我测是正常的**

| 条件 | 结论 |
|---|---|
| 总票数 < 3 | ⏳ 待验证（只展示提交者自报判定） |
| 降智票占比 ≥ 2/3 | ❌ 降智 |
| 降智票占比 ≤ 1/3 | ✅ 正常 |
| 其余 | ⚠️ 有争议 |

标注「基准」的条目是维护者按 checklist 逐项判定的存档作品，存放在 `results/`，不参与投票。

## 怎么参与

1. 在站上或题库里复制一道题的 prompt
2. 拿你要测的模型跑一遍
3. 把产出传到 Gist / CodePen / 任意可公开访问的地址
4. 在站上填表 → 跳转到已预填好的 Issue 页面 → Submit

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 技术结构

纯静态，无构建，可 `file://` 直接打开。

```
index.html            单页界面
app.js                数据层与渲染
data/config.js        仓库、阈值、缓存等常量
data/tests.js         题库（prompt + checklist + failSigns）
data/records.js       基准存档记录
data/snapshot.json    降级快照
results/**            基准作品页
scripts/update-snapshot.sh   刷新快照
.github/ISSUE_TEMPLATE/report.yml   战报模板
```

数据三层降级：

1. **实时** —— `GET /repos/{owner}/{repo}/issues?labels=report`，单请求同时取回每条 issue 的 👍/👎 计数
2. **快照** —— 实时层失败时读 `data/snapshot.json`，页面提示数据可能滞后
3. **存档** —— 上面两层都不可用时（离线、`file://`），仍能渲染 `data/records.js` 的基准记录

GitHub 未认证 API 限 60 次/小时/IP，页面用 sessionStorage 缓存 5 分钟。

维护者定期刷新快照：

```bash
scripts/update-snapshot.sh
```

## 限制

- 投票需要 GitHub 账号，小号刷票无法根治
- 外链作品会失效，需要定期巡检
- 判定依赖 checklist 的表述，题库口径变化会影响历史可比性
