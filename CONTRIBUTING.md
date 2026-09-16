# 参与方式

## 提交一条战报

1. 从[站点](https://model-test-blue.vercel.app)的「公共题库」复制一道题的 prompt，**原样**发给要测的模型——改了 prompt 就失去可比性。
2. 把产出保存成可公开访问的链接：[GitHub Gist](https://gist.github.com/)、CodePen、或任何你自己的地址。本站不托管他人文件。
3. 在站上「提交你的实测」填表，点按钮跳到已预填好的 Issue 页面，确认后 Submit。

也可以直接[新建 Issue](../../issues/new?template=report.yml)。

### 说明怎么写

有用的说明指向 checklist 的具体某一条：

> 腿为单段直线、无膝盖折点（通过标准第 4 条未过），脚与踏板脱节、悬空。

没用的说明：

> 感觉不如以前了。

## 投票

在任意一条战报 issue 上点表情：

- 👍 = **我也复现了降智**（不是"点赞"）
- 👎 = **我测是正常的**

请只在你**实际跑过同一道题**之后投票。凭印象投票会污染结论。

## 贡献一道新题

开一个 issue 说明：

- prompt 原文（必须是能直接粘贴发送的完整文本）
- 通过标准（checklist）：逐条可判定，不要写"效果好"这种主观项
- 降智特征（failSigns）：具体的崩坏形态
- 来源链接

合并后会进入 `data/tests.js`，并需要同步更新 `.github/ISSUE_TEMPLATE/report.yml` 的题目下拉选项。

## 本地开发

```bash
python3 -m http.server 3000
```

然后打开 http://localhost:3000 。直接双击 `index.html` 也能用，只是实时层会降级到基准存档。
