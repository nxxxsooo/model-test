// ============================================================
// 预置测试记录（种子数据，自动同步到本机 localStorage）
// - app.js 启动时合入：已存在的种子记录随本文件更新同步，被手动删除的不复活，
//   新增种子只在首次打开时录入；页面内也可自由删除 / 管理。
// - 判定标准（2026-09-16，鹈鹕骑车题）：真腿（大腿+小腿两段、有膝）+ 脚蹬在踏板上
//   随曲柄正常旋转（双脚相位差约 180°）+ 脚踝姿态正确不反关节。
// - 图形题作品一律保留为单独页面，存放在 results/<题目id>/<目录>/，
//   记录通过 src 字段引用（相对 model-test/index.html 的路径），不整段内嵌 HTML。
// - 新增记录：在数组末尾追加一项，或直接用页面「提交作品」表单录入。
// ============================================================
window.MODEL_RECORDS = [
  // ---------- 题目：鹈鹕骑自行车（pelican-bike） ----------
  {
    id: "seed-pb-muse-spark", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "Muse Spark", channel: "opencode 2",
    date: "2026-09-15", result: "fail",
    src: "results/pelican-bike/muse-spark/pelican-bike.html",
    note: "Muse Spark 生成；判定 fail：腿为髋到踏板的单段直线，无两段腿和膝盖折点（A❌）；脚虽每帧跟随踏板，但腿结构不真",
    createdAt: "2026-09-15T19:37:00.000Z"
  },
  {
    id: "seed-pb-mimo-2-5", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "mimo 2.5", channel: "opencode 2",
    date: "2026-09-15", result: "fail",
    src: "results/pelican-bike/mimo-2.5/pelican-bike.html",
    note: "原 Tuning/pelican-bike.html；判定 fail：腿为静态路径（leg-pump 动画定义了但未挂载），脚为固定椭圆、脱开旋转中的踏板（B❌）",
    createdAt: "2026-09-15T19:37:00.000Z"
  },
  {
    id: "seed-pb-qwen-3-7", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "qwen 3.7", channel: "opencode 2",
    date: "2026-09-15", result: "fail",
    src: "results/pelican-bike/qwen-3.7/pelican-on-bike.html",
    note: "原 Tuning/pelican-on-bike.html；判定 fail：腿为单段 line 绕中轴刚性旋转、无膝盖折点（A❌）；脚虽随踏板转但整体无踝，靠翅膀/手臂辅助",
    createdAt: "2026-09-15T19:37:00.000Z"
  },
  {
    id: "seed-pb-sol-high", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "sol high", channel: "opencode 2",
    date: "2026-09-15", result: "pass",
    src: "results/pelican-bike/sol-high/index.html",
    note: "复制自 Designs/personal/pelican-bicycle/，鹈鹕的海边骑行；判定 pass：JS 每帧 IK 两段腿、膝点绑踏板，双脚对径 180°，脚面随踏板贴合",
    createdAt: "2026-09-15T19:37:00.000Z"
  },
  {
    id: "seed-pb-astra-low", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "astra low", channel: "opencode 2",
    date: "2026-09-15", result: "pass",
    src: "results/pelican-bike/astra-low/index.html",
    note: "复制自 coastal-ride/，顺风出发；判定 pass：IK 两段腿（垂线偏移求膝点），脚随踏板圆轨迹、双脚 180° 相位",
    createdAt: "2026-09-15T19:37:00.000Z"
  },
  {
    id: "seed-pb-opus-5", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "opus 5", channel: "opencode 2",
    date: "2026-09-15", result: "pass",
    src: "results/pelican-bike/opus-5/pelican-bicycle.html",
    note: "原 Tuning/pelican-bicycle.html；判定 pass：polyline 髋膝踝三点，踝点动画与踏板平移逐帧一致，双踏板 180° 绕中轴公转",
    createdAt: "2026-09-15T19:37:00.000Z"
  },
  {
    id: "seed-pb-seed-2-1-pro", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "seed 2.1 pro", channel: "豆包 chat",
    date: "2026-09-15", result: "suspect",
    src: "results/pelican-bike/seed-2.1-pro/index.html",
    note: "Doubao 对话导出，纯内联 SVG + SMIL；判定 suspect：两段腿膝反相蹬踏，但脚悬空（约 y440）未贴踏板轨道（D❌）；另脖颈直接握手把",
    createdAt: "2026-09-15T19:58:00.000Z"
  },
  {
    id: "seed-pb-codem", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "CodeM (codem-router/auto · 极高)", channel: "CodeM 会话",
    date: "2026-09-16", result: "pass",
    src: "results/pelican-bike/codem/pelican-bicycle.html",
    note: "原 Tuning/pelican-bicycle.html，CodeM 生成；判定 pass：JS IK 两段腿蹬踏，脚随踏板旋转、双脚 180° 相位，踝部合理",
    createdAt: "2026-09-16T02:00:00.000Z"
  },
  {
    id: "seed-pb-kimi-k3", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "Kimi K3", channel: "飞书豆包工作伙伴",
    date: "2026-09-16", result: "fail",
    src: "results/pelican-bike/kimi-k3/index.html",
    note: "← Downloads/鹈鹕骑自行车-SVG动画-Kimi-K3.html；判定 fail：脚蹼未绑定踏板运动（B❌）、无踝概念（D❌），腿结构勉强（A⚠️）",
    createdAt: "2026-09-16T05:51:00.000Z"
  },
  {
    id: "seed-pb-glm-5-3", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "GLM 5.3", channel: "飞书豆包工作伙伴",
    date: "2026-09-16", result: "fail",
    src: "results/pelican-bike/glm-5.3/index.html",
    note: "← Downloads/鹈鹕骑自行车-SVG动画-GLM-5.3.html；判定 fail：腿是髋到踏板的单段直线、无膝盖（A❌）；脚端 SMIL 沿踏板圆轨迹 180° 相位",
    createdAt: "2026-09-16T05:51:00.000Z"
  },
  {
    id: "seed-pb-deepseek-v4-pro", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "DeepSeek V4 Pro", channel: "飞书豆包工作伙伴",
    date: "2026-09-16", result: "fail",
    src: "results/pelican-bike/deepseek-v4-pro/index.html",
    note: "← Downloads/鹈鹕骑自行车-SVG动画-DeepSeek-V4-Pro.html；判定 fail：腿绕髋刚体摆动、踏板独立自转脚脱节、仅单曲柄（B❌）",
    createdAt: "2026-09-16T05:51:00.000Z"
  },
  {
    id: "seed-pb-deepseek-v4-flash", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "DeepSeek V4 Flash", channel: "飞书豆包工作伙伴",
    date: "2026-09-16", result: "suspect",
    src: "results/pelican-bike/deepseek-v4-flash/index.html",
    note: "← Downloads/鹈鹕骑自行车-SVG动画-DeepSeek-V4-Flash.html；判定 suspect：腿为平滑曲线带膝弯但随曲柄刚性旋转、双脚 180° 对置，无踝（D❌）",
    createdAt: "2026-09-16T05:51:00.000Z"
  },
  {
    id: "seed-pb-qwen-3-8-max", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "Qwen 3.8 max", channel: "飞书豆包工作伙伴",
    date: "2026-09-16", result: "fail",
    src: "results/pelican-bike/qwen-3.8-max/index.html",
    note: "← Downloads/鹈鹕骑自行车SVG动画.Qwen-3.8-max.html；判定 fail：腿为单根无关节曲线且完全静止（A❌），脚蹼画在曲柄组内随转",
    createdAt: "2026-09-16T03:35:00.000Z"
  },
  {
    id: "seed-pb-gemini-3-8-flash", testId: "pelican-bike",
    testTitle: "鹈鹕骑自行车", testType: "graphic",
    model: "Gemini 3.8 Flash (High)", channel: "Antigravity 会话",
    date: "2026-09-16", result: "pass",
    src: "results/pelican-bike/gemini-3.8-flash/index.html",
    note: "Antigravity 会话生成；判定 pass：真腿 2-Bone 逆运动学（IK）解算，双腿分节（大腿+小腿、膝盖解析折点），双脚 180° 相位对置紧扣脚踏随曲柄真实旋转，脚踝贴合自然无反关节；躯干与头部蹬踏共振微动；大嘴长喙倒钩与半透明弹性喉囊（内含游动小鱼）；多层视差滚动背景与转动风车；内置 Web Audio 原生合成双音车铃与卡通鸣叫，支持昼夜三套主题与踏频调速",
    createdAt: "2026-09-16T08:15:00.000Z"
  },

  // ---------- 题目：三合一省 token 版（trilogy-token-saving） ----------
  {
    id: "seed-tri-codem", testId: "trilogy-token-saving",
    testTitle: "三合一省 token 版（鹈鹕×孙悟空×秦始皇）", testType: "graphic",
    model: "CodeM (codem-router/auto · 极高)", channel: "CodeM 会话",
    date: "2026-09-16", result: "pending",
    src: "results/trilogy-token-saving/codem/index.html",
    note: "孙悟空驾驶舱握操纵杆 + 金箍棒；鹈鹕机翼骑行（IK 蹬踏）+ 展翅托北极熊；秦始皇冕旒骑熊打螺丝，螺丝旋转带火花；腿部判定 ✓（IK 两段腿蹬踏、脚随踏板），其余 checklist 项未逐项判定，整体待判",
    createdAt: "2026-09-16T03:00:00.000Z"
  },
  {
    id: "seed-tri-codem-flight", testId: "trilogy-token-saving",
    testTitle: "三合一省 token 版（鹈鹕×孙悟空×秦始皇）", testType: "graphic",
    model: "CodeM (纯 SMIL+CSS 动画版)", channel: "CodeM 会话",
    date: "2026-09-16", result: "suspect",
    src: "results/trilogy-token-saving/codem-flight/index.html",
    note: "CodeM 会话产出「大圣航空·拧螺丝航班 QS-2217」，纯 SVG + SMIL + CSS 动画；元素全部齐全（机头悟空驾驶+机翼鹈鹕车队展翼托熊+熊背始皇手持螺丝刀拧动）；判定 suspect：腿部采用髋关节固定角度摆动（rotate 16°~-16°），与下方独立 360° 自转的曲柄踏板脱节（B❌/D❌）",
    createdAt: "2026-09-16T08:20:00.000Z"
  },
  {
    id: "seed-tri-muse-spark-1-3", testId: "trilogy-token-saving",
    testTitle: "三合一省 token 版（鹈鹕×孙悟空×秦始皇）", testType: "graphic",
    model: "Muse Spark 1.3", channel: "opencode 2",
    date: "2026-09-16", result: "pending",
    src: "results/trilogy-token-saving/muse-spark/index.html",
    note: "三合一题作品（鹈鹕+悟空+秦始皇，18 处元素命中），原文件放在 muse-spark 目录已归位",
    createdAt: "2026-09-16T07:43:00.000Z"
  },
  {
    id: "seed-tri-gemini-3-8-flash", testId: "trilogy-token-saving",
    testTitle: "三合一省 token 版（鹈鹕×孙悟空×秦始皇）", testType: "graphic",
    model: "Gemini 3.8 Flash (High)", channel: "Antigravity 会话",
    date: "2026-09-16", result: "pass",
    src: "results/trilogy-token-saving/gemini-3.8-flash/index.html",
    note: "高精细度 2D SVG 矢量动画：孙悟空驾驶舱手握操纵杆+火眼金睛闪烁+金箍棒备用；机翼涂装警示条纹与巨型涡扇喷气引擎；鹈鹕蹬踏公路车+平展双翼托举北极熊；秦始皇头戴冕旒与劳保护目镜，手持锂电钻高速旋拧机翼塔螺栓带真实火花；支持三套环境主题、原生 Web Audio 音效模拟与 SVG 导出",
    createdAt: "2026-09-16T08:00:00.000Z"
  },
  {
    id: "seed-tri-sol-medium", testId: "trilogy-token-saving",
    testTitle: "三合一省 token 版（鹈鹕×孙悟空×秦始皇）", testType: "graphic",
    model: "Sol Medium", channel: "OpenCode 2",
    date: "2026-09-16", result: "pending",
    src: "results/trilogy-token-saving/sol-medium/index.html",
    note: "云端奇航 2D SVG 动画：大型飞机与机翼骑行场景；孙悟空在驾驶舱操控飞机；鹈鹕展翼托举北极熊；秦始皇骑熊旋转螺丝刀并产生火花；含车轮、踏板、机翼、螺旋桨、云层动画及暂停/重新起飞控制",
    createdAt: "2026-09-16T08:35:00.000Z"
  }
];
