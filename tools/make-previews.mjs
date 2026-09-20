// 为每个有 src 的样例生成 1200×800 静态封面（WebP），并补齐 data/previews.js 缺失映射。
// 用法：
//   1. python3 -m http.server 8777 --bind 127.0.0.1   （仓库根目录）
//   2. node tools/make-previews.mjs [--all]           （默认只补缺失的）
// 依赖：npx playwright（chromium）、ImageMagick magick。
// 封面是原始作品的真实截图；动画类作品截的是加载约 2.5s 后的一帧。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = "http://127.0.0.1:8777";
const W = 1200;
const H = 800;
const REGEN_ALL = process.argv.includes("--all");

function loadGlobal(file, key) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(`${ROOT}/${file}`, "utf8"), ctx, { filename: file });
  return ctx.window[key];
}

const samples = loadGlobal("data/samples.js", "SAMPLES");
const previewsPath = `${ROOT}/data/previews.js`;
const previews = loadGlobal("data/previews.js", "SAMPLE_PREVIEWS");

const missing = samples.filter((s) => s.src && (!REGEN_ALL && !previews[s.id]));
if (!missing.length && !REGEN_ALL) {
  console.log("all samples already have previews, nothing to do");
  process.exit(0);
}
const targets = REGEN_ALL ? samples.filter((s) => s.src) : missing;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
mkdirSync("/tmp/covers", { recursive: true });

for (const s of targets) {
  const file = previews[s.id] || `assets/previews/${s.id}.webp`;
  const png = `/tmp/covers/${s.id}.png`;
  await page.goto(`${BASE}/${s.src}`, { waitUntil: "load", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: png });
  execFileSync("magick", [png, "-colorspace", "sRGB", "-strip", "-quality", "86",
    "-define", "webp:method=6", `${ROOT}/${file}`]);
  previews[s.id] = file;
  console.log(`ok ${s.id} -> ${file}`);
}
await browser.close();

const entries = Object.entries(previews)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  .join(",\n");
writeFileSync(previewsPath,
  `// 静态封面来自对应原始作品的 1200×800 浏览器截图；不是重新绘制的示意图。\n` +
  `// 没有封面的新样例仍可直接运行。题库、样例与原始作品的数据契约不变。\n` +
  `window.SAMPLE_PREVIEWS = {\n${entries}\n};\n`);
console.log(`previews.js updated (${Object.keys(previews).length} entries)`);
