"""把标了 sample 的投稿 issue 自动转成 PR。

约定（与 .github/ISSUE_TEMPLATE/sample.yml 一致）：
- issue 正文是 Issue Forms 格式：`### 字段名` 后跟值。
- 「产出」字段二选一：Gist 链接（或直链），或 ```html 代码块。
- 产物存为 results/<testId>/<slug>/index.html，索引追加到 data/samples.js，
  封面占位写进 data/previews.js（截图由 workflow 另一步生成）。
"""
import json
import os
import re
import sys
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def fail(msg):
    print("AUTO_SAMPLE_ERROR:" + msg)
    sys.exit(1)


def parse_sections(body):
    sections = {}
    current = None
    buf = []
    for line in body.splitlines():
        m = re.match(r"^###\s+(.+?)\s*$", line)
        if m:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current = m.group(1).strip()
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()
    return sections


def load_js_array(path, key):
    import subprocess

    out = subprocess.check_output(
        ["node", "-e",
         'const fs=require("fs"),vm=require("vm");'
         'const ctx={window:{}};vm.createContext(ctx);'
         'vm.runInContext(fs.readFileSync(process.argv[1],"utf8"),ctx);'
         'console.log(JSON.stringify(ctx.window[process.argv[2]]));',
         path, key],
        cwd=REPO_ROOT, text=True)
    return json.loads(out)


def fetch_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": "model-test-bot"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def fetch_gist(url):
    m = re.search(r"gist\.github\.com/[\w.-]+/([0-9a-f]+)", url)
    if not m:
        return None
    api = "https://api.github.com/gists/" + m.group(1)
    data = json.loads(fetch_url(api))
    files = data.get("files", {})
    if not files:
        fail("Gist 里没有文件")
    # 优先取 html 文件，否则取第一个
    for name, f in files.items():
        if name.endswith((".html", ".htm")):
            return fetch_url(f["raw_url"])
    first = next(iter(files.values()))
    if not first.get("raw_url"):
        fail("Gist 文件无法读取（可能是空文件或被截断）")
    return fetch_url(first["raw_url"])


def slugify(s, limit=40):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9\u4e00-\u9fa5]+", "-", s).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s[:limit].strip("-") or "sample"


def main():
    body = open(os.environ["ISSUE_BODY_FILE"], encoding="utf-8").read()
    author = os.environ.get("ISSUE_AUTHOR", "")
    sections = parse_sections(body)

    test_raw = sections.get("题目", "")
    model = sections.get("模型", "").strip()
    channel = sections.get("渠道", "").strip()
    date = sections.get("测试日期", "").strip()
    link_raw = sections.get("产出", "")
    note = sections.get("你的观察", "").strip()
    if isinstance(note, str):
        note = re.sub(r"<[^>]+>", "", note)  # 去掉粘贴带进来的 HTML 标签
        note = note.strip()

    if not test_raw:
        fail("「题目」为空")
    if not model:
        fail("「模型」为空")
    if not date:
        fail("「测试日期」为空")
    if not link_raw:
        fail("「产出」为空：请贴 Gist 链接或完整 HTML 代码块")

    tests = load_js_array("data/tests.js", "MODEL_TESTS")
    samples = load_js_array("data/samples.js", "SAMPLES")
    test_ids = {t["id"] for t in tests}

    m = re.search(r"\(([A-Za-z0-9_-]+)\)\s*$", test_raw.strip())
    test_id = m.group(1) if m else ""
    if test_id not in test_ids:
        hit = [t["id"] for t in tests
               if t["title"] in test_raw or test_raw.strip() in t["title"]]
        if len(hit) == 1:
            test_id = hit[0]
        else:
            fail("题目 %r 无法对应到题库 id（应形如「鹈鹕骑自行车 (pelican-bike)」）" % test_raw)

    # 产出：优先代码块，其次链接
    html = ""
    fence = re.search(r"```(?:html)?\s*\n(.*?)```", link_raw, re.S | re.I)
    if fence and len(fence.group(1).strip()) > 50:
        html = fence.group(1).strip()
    else:
        urls = re.findall(r"https?://[^\s)>\]]+", link_raw)
        if not urls:
            fail("「产出」里既没有代码块也没有可用链接")
        gist_html = fetch_gist(urls[0])
        html = gist_html if gist_html is not None else fetch_url(urls[0])

    if not html or len(html.strip()) < 50:
        fail("产出内容太短或为空")
    if len(html) > 2000000:
        fail("产出超过 2MB，请拆分或用 Gist 链接")
    if not re.search(r"<(html|svg)\b", html, re.I):
        fail("产出看起来不是 HTML/SVG（缺少 <html> 或 <svg>）")

    slug = slugify(model + "-" + date.replace("-", ""))
    dest_dir = os.path.join(REPO_ROOT, "results", test_id, slug)
    if os.path.exists(dest_dir):
        slug = slug + "-" + os.environ.get("ISSUE_NUMBER", "x")
        dest_dir = os.path.join(REPO_ROOT, "results", test_id, slug)
    if os.path.exists(dest_dir):
        fail("同名目录已存在：results/%s/%s" % (test_id, slug))
    os.makedirs(dest_dir)

    with open(os.path.join(dest_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html if html.endswith("\n") else html + "\n")
    src = "results/%s/%s/index.html" % (test_id, slug)

    base_id = "s-%s-%s" % (test_id, slugify(model, 24))
    sample_id = base_id
    taken = {s["id"] for s in samples}
    n = 2
    while sample_id in taken:
        sample_id = "%s-%d" % (base_id, n)
        n += 1

    entry = {"id": sample_id, "testId": test_id, "model": model,
             "channel": channel, "date": date, "src": src,
             "observation": "unrated", "note": note, "contributor": author}

    append_js_entry(os.path.join(REPO_ROOT, "data/samples.js"),
                    "  " + json.dumps(entry, ensure_ascii=False, separators=(",", ":")))

    preview_rel = "assets/previews/%s.webp" % sample_id
    append_js_entry(os.path.join(REPO_ROOT, "data/previews.js"),
                    "  %s: %s" % (json.dumps(sample_id), json.dumps(preview_rel)))

    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
        f.write("sample_id=%s\n" % sample_id)
        f.write("slug=%s\n" % slug)
        f.write("test_id=%s\n" % test_id)
        f.write("preview=%s\n" % preview_rel)
        f.write("model=%s\n" % model)
    print("SAMPLE_OK %s %s" % (sample_id, src))


def append_js_entry(path, entry_text):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    new, count = re.subn(r"\}\s*\n\];\s*$",
                         "},\n" + entry_text + "\n];\n",
                         content, count=1)
    if not count:
        # previews.js 是对象字面量：{...} 结尾
        new, count = re.subn(r"\n(\})\s*;\s*$",
                             ",\n" + entry_text + "\n};\n",
                             content, count=1)
    if not count:
        fail("无法写入 " + path + "（结尾格式不符合预期）")
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)


if __name__ == "__main__":
    main()
