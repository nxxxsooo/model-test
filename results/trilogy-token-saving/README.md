# 三合一省 token 版（鹈鹕×孙悟空×秦始皇）— 多模型对照

本目录为测试题目 `trilogy-token-saving`（铁锤人三大绘图测试三合一版本）的不同模型生成结果归档。

**题目提示词**：
> 创建一个 HTML，内容是一张精细的SVG图片，画面是鹈鹕骑着自行车在孙悟空开的大型飞机机翼上骑行，鹈鹕展开翅膀，上面托着秦始皇的北极熊，秦始皇骑在熊上打螺丝，做成2D 动画版本

## 模型结果归档

| 目录 | 模型 / 渠道 | 入口文件 | 特色与说明 |
|---|---|---|---|
| `gemini-3.8-flash/` | Gemini 3.8 Flash (High) / Antigravity | `index.html` | 精细 2D SVG 矢量动画：孙悟空驾驶舱+火眼金睛凝视；机翼与巨型涡扇引擎；鹈鹕展翼托举北极熊；秦始皇头戴冕旒与劳保眼镜手持锂电钻打螺丝+火花飞溅；内置 3 款主题背景、Web Audio 引擎与电钻音效、SVG 导出 |
| `codem/` | CodeM (codem-router/auto · 极高) | `index.html` | 鹈鹕航班机翼骑行与打螺丝现场（JS IK 两段腿蹬踏） |
| `codem-flight/` | CodeM (codem-router/auto) / CodeM 会话 | `index.html` | 大圣航空 · 拧螺丝航班 QS-2217（纯 SVG + SMIL + CSS 动画，机头悟空驾驶、机翼骑行、始皇熊背拧螺丝） |
| `muse-spark/` | Muse Spark 1.3 / opencode 2 | `index.html` | 三合一题作品归档 |
| `sol-medium/` | Sol Medium / OpenCode 2 | `index.html` | 云端奇航 2D SVG 动画：鹈鹕翼上骑行、展翼托熊、秦始皇熊背维修、孙悟空驾驶大型飞机 |

## 预览方式

1. 直接用浏览器打开各子目录的 `index.html`。
2. 或打开根目录 [`index.html`](../../index.html) 在项目看板（矩阵与时间线）中统一查看与对比。
