# 降智测试题集

同一道题，不同模型的真实产出。自己看，自己判断。

站点：https://model-test-blue.vercel.app

## 这是什么

一套可以直接复制的模型测试题，加上各个模型跑出来的原始结果。每个产出都托管在本仓库里，在题目页直接可以看。

**本站不给结论，不排名，不投票。** 「降智」没有客观阈值——同一份产出，有人觉得能用，有人觉得崩了。样例上的「符合预期 / 有明显问题 / 部分退化」是提交者自己的观察，用来帮你筛选，不是本站的判定。

## 怎么用

1. 挑一道题，复制提示词（原样发送，改了就失去可比性）
2. 拿你要测的模型跑一遍
3. 和站上已有的样例对着看
4. 勾选同一道题下的 2–4 个样例，进入并排对比；手机端纵向排列

每道题下面有「可以看什么」和「常见的崩法」两栏，是历次观察的沉淀，帮你知道该盯哪里，不是评分表。

## 怎么投稿

开一个 [投稿 issue](../../issues/new?template=sample.yml)，或者在站上点「投个样例」。

产出可以贴 Gist 链接，也可以直接把完整 HTML 贴进 issue。合并后作品会存进 `results/`，从此不依赖外链、不会失效。

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 结构

纯静态，无构建，无运行时接口，可 `file://` 直接打开。

```
index.html          单页入口（题目索引、详情、投稿和原生对比弹窗）
app.css             Swiss Minimalist 样式与响应式布局
app.js              hash 路由、渲染、复制、按需运行与对比
data/config.js      站点常量
data/tests.js       题库：提示词、看什么、常见崩法、来源
data/samples.js     样例索引：模型、渠道、日期、产出路径、提交者观察
data/previews.js    可选静态封面，按样例 ID 映射
assets/previews/    从真实作品截取的 WebP 封面
results/<题目>/<模型>/   作品文件本体
.github/ISSUE_TEMPLATE/sample.yml   投稿模板
```

封面是原始作品在 1200×800 浏览器视口下的静态截图，并不代表动画的全部效果。点击「运行作品」才挂载 `sandbox="allow-scripts"` iframe；「停止预览」、切换题目、切换筛选及关闭对比会卸载相关 iframe。首页不运行任何作品。首页两张题目卡片用 `loading="eager"`（首屏），样例列表用 `loading="lazy"`。

新增封面时，跑 `tools/make-previews.mjs`（需先在仓库根目录起本地服务，依赖 Playwright chromium 与 ImageMagick），它会逐个打开有 `src` 的样例截图、转 sRGB WebP 并补齐 `data/previews.js` 映射；`--all` 全量重截。作品更新后应同步更新封面；没有封面的样例仍可正常运行。CI（`.github/workflows/covers.yml`）会校验每个有 `src` 的样例都有映射和文件。

本地预览：在仓库内运行 `python3 -m http.server 8777`，打开 `http://localhost:8777`。主要入口为 `#/`、`#/t/<题目ID>`、`#submit`；保留 `#tests` 锚点。

## 加一道新题

在 `data/tests.js` 追加一项，并把题目选项同步到 `.github/ISSUE_TEMPLATE/sample.yml` 的说明里。题目需要：

- 完整可直接粘贴的提示词
- 「可以看什么」：具体到部位和行为，不写「效果好不好」
- 「常见的崩法」：见过的具体崩坏形态
- 来源链接

## 限制

- 作品都是自包含 HTML/SVG；依赖外部资源的产出无法离线复现
- 手动运行多个作品时仍会消耗资源；可停止预览，或只打开需要对照的样例
- iframe 限制自动播放权限，但不承诺作品在用户操作后保持静音
- 「可以看什么」本身带着写题人的视角，不是中立标准
