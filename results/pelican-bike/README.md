# 鹈鹕骑自行车 SVG 动画 — 多模型对照

`Tuning/pelican-bike-test/`：同一提示、不同模型的生成结果归档。

| 目录 | 模型 / 来源 | 文件 |
|---|---|---|
| `gemini-3.8-flash/` | Gemini 3.8 Flash (High)（Antigravity 会话） | `index.html` |
| `muse-spark/` | Muse Spark（本会话） | `pelican-bike.html` |
| `mimo-2.5/` | mimo 2.5（原 `Tuning/pelican-bike.html`） | `pelican-bike.html` |
| `qwen-3.7/` | qwen 3.7（原 `Tuning/pelican-on-bike.html`） | `pelican-on-bike.html` |
| `sol-high/` | sol high（`Designs/personal/pelican-bicycle/index.html` 复制，鹈鹕的海边骑行） | `index.html` |
| `astra-low/` | astra low（`Designs/personal/pelican-bicycle/coastal-ride/index.html` 复制，顺风出发） | `index.html` |
| `opus-5/` | opus 5（原 `Tuning/pelican-bicycle.html`） | `pelican-bicycle.html` |
| `seed-2.1-pro/` | seed 2.1 pro（Doubao 对话导出复制） | `index.html` |
| `codem/` | codem 生成，底层模型未知（原 `Tuning/pelican-bicycle.html`） | `pelican-bicycle.html` |
| `gpt-extra/` | GPT-5.6 Sol（本会话，云端奇航 2D SVG 动画） | `index.html` |
| `other/` | 待补充 | — |

## 飞书可贴版

- `pelican-bike.svg`：SMIL 自包含动画 SVG（浏览器打开即动，基于 sol-high 视觉重制）。
- `pelican-bike.gif`：同源渲染的 5s 循环 GIF（20fps，1MB）——飞书不渲染贴入的 SVG 动画，贴飞书用这个（拖入聊天/文档即可）。
- 生成脚本：`make_pelican.py`（会话暂存），同一套几何同时产出 SVG 与 GIF 帧。

## 预览

- 用浏览器直接打开各子目录的 html 即可。
- 或打开本目录 `index.html` 统一跳转。

> Designs 原文件保留，此处为测试对照副本。
