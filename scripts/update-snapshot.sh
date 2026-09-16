#!/usr/bin/env bash
# 生成 data/snapshot.json：GitHub API 限流或断网时的降级数据源。
# 用法：scripts/update-snapshot.sh
set -euo pipefail

cd "$(dirname "$0")/.."

REPO="$(node -e 'const s=require("fs").readFileSync("data/config.js","utf8");
const o=s.match(/owner:\s*"([^"]+)"/)[1], n=s.match(/name:\s*"([^"]+)"/)[1];
process.stdout.write(o+"/"+n)')"

echo "拉取 ${REPO} 的 report issues..."
issues="$(curl -sS -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/issues?state=open&per_page=100&labels=report")"

node -e '
const issues = JSON.parse(process.argv[1]);
if (!Array.isArray(issues)) { console.error("API 返回异常:", process.argv[1].slice(0,200)); process.exit(1); }
const slim = issues.filter(i => !i.pull_request).map(i => ({
  number: i.number, html_url: i.html_url, body: i.body,
  created_at: i.created_at, user: { login: i.user && i.user.login },
  reactions: { "+1": i.reactions["+1"], "-1": i.reactions["-1"] }
}));
require("fs").writeFileSync("data/snapshot.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), issues: slim }, null, 2) + "\n");
console.log("已写入 data/snapshot.json，共 " + slim.length + " 条");
' "$issues"
