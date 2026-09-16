// ============================================================
// 模型降质治理公开共建平台 · 云端与公共服务配置 (Cloud BaaS Config)
// ============================================================
// 默认采用轻量纯前端方案：
// 1. 本地模式 (Local Mode)：零配置即可使用，数据保存在浏览器 localStorage + 种子库中。
// 2. 公开云端模式 (Supabase BaaS)：只需填入 Supabase URL 和 Anon Key，
//    即可让所有访问者实时共享、提交、投票与同步测试数据！
//
// 免费创建 Supabase 项目指南：
// 1) 访问 https://supabase.com 注册免费账号
// 2) 创建一个新项目（例如 model-degradation-watch）
// 3) 在 SQL Editor 中执行下方建表语句
// 4) 在 Project Settings -> API 中复制 Project URL 和 anon/public key 填入下方即可。
// ============================================================

window.APP_CONFIG = {
  // 平台基础信息
  siteName: "模型降质治理 · 公开共建平台",
  siteTagline: "开源社区共建的 AI 模型降智检测与回归追踪看板",
  sourceRepo: "https://github.com/nxxxsooo/model-test",
  communityX: "https://x.com",
  mcpDocUrl: "https://github.com/nxxxsooo/model-test#mcp-server",

  // 云端 BaaS 配置（Supabase）
  // 留空或为默认占位符时自动运行在「本地缓存 + 演示同步」模式
  supabase: {
    url: "", // 例如: "https://xxxxxxxxxxxx.supabase.co"
    anonKey: "", // 例如: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    // 表名配置
    tables: {
      records: "model_records",
      tests: "model_tests",
      votes: "model_record_votes"
    }
  },

  // 开放 API 与 MCP 示例配置
  api: {
    version: "v1.0.0",
    endpoints: [
      { method: "GET", path: "/api/status", desc: "获取全网模型整体健康度与最新降智警报" },
      { method: "GET", path: "/api/records", desc: "获取所有已公开的社区评测战报" },
      { method: "GET", path: "/api/tests", desc: "获取所有基准评测题库与判定标准" },
      { method: "POST", path: "/api/submit", desc: "提交实测记录（需包含 model, testId, result 等）" }
    ]
  },

  // Supabase 一键初始化 SQL 语句（供用户在管理界面一键复制使用）
  supabaseInitSQL: `-- 1. 创建测试记录表
create table if not exists public.model_records (
  id text primary key,
  test_id text not null,
  test_title text not null,
  test_type text default 'graphic',
  model text not null,
  channel text,
  date text not null,
  result text not null, -- 'pass', 'suspect', 'fail', 'pending'
  note text,
  contributor text default '社区极客',
  contributor_url text,
  html text,
  src text,
  answer text,
  upvotes integer default 0,
  verified_normal integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. 创建社区题库表
create table if not exists public.model_tests (
  id text primary key,
  title text not null,
  type text default 'graphic',
  prompt text not null,
  tags text[],
  difficulty integer default 2,
  author text,
  author_url text,
  reference jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. 启用公开读写权限（开发测试与公开共建用途）
alter table public.model_records enable row level security;
alter table public.model_tests enable row level security;

create policy "允许任何人查看测试记录" on public.model_records for select using (true);
create policy "允许任何人提交测试记录" on public.model_records for insert with check (true);
create policy "允许任何人更新点赞投票" on public.model_records for update using (true);

create policy "允许任何人查看题库" on public.model_tests for select using (true);
create policy "允许任何人贡献新题目" on public.model_tests for insert with check (true);
`
};
