# 🎮 GameHub Arcade for DeepSeek Harness

<p align="center">
  <strong>1000+ 经典网页游戏 · 即点即玩 · 无需安装 · DSH 侧边栏一键直达</strong><br>
  <em>1000+ classic browser games in your DeepSeek Harness sidebar. Zero installs.</em>
</p>

<p align="center">
<a href="https://github.com/bihong2026/dsh-arcade/stargazers"><img src="https://img.shields.io/github/stars/bihong2026/dsh-arcade?style=flat-square" alt="Stars"></a>
<a href="https://github.com/bihong2026/dsh-arcade/network/members"><img src="https://img.shields.io/github/forks/bihong2026/dsh-arcade?style=flat-square" alt="Forks"></a>
<img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License">
<img src="https://img.shields.io/badge/platform-dsh--web-blue?style=flat-square" alt="DSH web">
<img src="https://img.shields.io/badge/games-94%20verified-orange?style=flat-square" alt="Games count">
<a href="https://gitee.com/bihong2023/dsh-arcade"><img src="https://img.shields.io/badge/mirror-Gitee-red?style=flat-square" alt="Gitee mirror"></a>
</p>

<p align="center">
简体中文 · <a href="README.en.md">English</a>
</p>

---

## ✨ 这是什么

**GameHub Arcade** 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。安装后，DSH Web 界面侧边栏会多出一个 **🎮 游戏** 标签，点开就是完整的游戏中心：

- 🕹️ **94 款上线游戏，全部逐个实测**：贪吃蛇、2048、俄罗斯方块、吃豆人、扫雷、围棋、Hextris……全部来自开源社区（MIT 等），逐个验证可嵌入、可实际运行后收录
- ⚡ **即点即玩**：游戏在沙箱 iframe 中运行，不装任何本地依赖
- 🔍 **搜索 / 分类 / 收藏 / 随机**：棋盘游戏、街机、益智、3D 等 10 大分类
- 🌓 **明暗主题**：跟随系统，护眼
- 🔒 **安全沙箱**：不授予 same-origin，游戏无法访问 DSH 数据
- 🧩 **持续扩展**：目录是纯 JSON，一条记录 = 一个新游戏（见 [收录新游戏](#-收录新游戏)）

同时包含一个可独立部署的**游戏网站**，插件只是把同一个网站嵌入侧边栏——一个目录，两个入口，流量共享。当前线上实例：<https://122.51.206.118/>（94 款游戏全量自托管，不依赖任何代码托管平台）

## 📦 安装

在 DeepSeek Harness 终端中执行（把 `<profile>` 换成你的 profile 名，如 `web`）：

**方式 A —— 本地目录（最稳，推荐）**

从任一来源下载代码后，指到含 `package.json` 的目录：

```bash
# GitHub
git clone https://github.com/bihong2026/dsh-arcade.git
# 或 Gitee（国内更快）
git clone https://gitee.com/bihong2023/dsh-arcade.git

dsh plugin --profile web add ./dsh-arcade
```

**方式 B —— 直接从 Git 仓库安装**

`dsh plugin add` 会把参数原样交给 pnpm，因此只接受 pnpm 认识的源格式：GitHub 用简写 `github:owner/repo`，Gitee 等其它站点用完整 git URL。

```bash
# GitHub（简写）
dsh plugin --profile web add "github:bihong2026/dsh-arcade#v0.1.2"

# Gitee（完整 git URL，注意 git+ 前缀与 #标签）
dsh plugin --profile web add "git+https://gitee.com/bihong2023/dsh-arcade.git#v0.1.2"

# 跟踪 main 分支（两边同理）
dsh plugin --profile web add "github:bihong2026/dsh-arcade#main"
dsh plugin --profile web add "git+https://gitee.com/bihong2023/dsh-arcade.git#main"
```

> Git 源拉取的是**源码**，pnpm 10+ 需要授权才能跑构建脚本。本仓库已提交 `lib/` 构建产物，无需本地构建；若安装时报 `Ignored build scripts`，按提示执行 `pnpm approve-builds` 即可（或直接用方式 A / 方式 C，跳过构建）。

**方式 C —— tarball（无网络依赖，最适合离线交付）**

```bash
dsh plugin add ./dsh-arcade-0.1.2.tgz
```

重启 `dsh web` 并刷新页面，侧边栏即出现 **🎮 游戏** 标签。

## 🗂️ 目录结构

```
dsh-arcade/
├── package.json        # DSH 插件清单（dsh.client / keywords / exports）
├── cordis.patch.yml    # DSH bundle 挂载配置
├── build.mjs           # esbuild：client bundle（react external + ModuleLoader 包装）
├── lib/                # 构建产物（安装即用，无需本地构建）
├── src/                # 插件源码（host 入口 + client 侧边栏注册）
├── site/               # 游戏网站（可独立部署到 GitHub Pages / Cloudflare Pages）
│   ├── index.html      # 启动页：搜索、分类、收藏、随机、播放器
│   ├── assets/         # 站点样式与逻辑（CSS 变量主题，支持插件紧凑模式）
│   └── data/games.json # ⭐ 游戏目录（唯一数据源，site 与 plugin 共用）
├── scripts/ingest.py   # 收录管线：拉取上游 registry → 校验可嵌入性 → 生成目录
└── docs/               # 架构与贡献指南
```

## 🏗️ 架构

```mermaid
graph LR
    A[开源游戏仓库<br/>sausi-7/games 等] -->|scripts/ingest.py<br/>校验 X-Frame-Options| B[site/data/games.json<br/>唯一目录]
    B --> C[静态网站<br/>site/]
    C -->|GitHub Pages / CF Pages| D[公网玩家]
    C -->|sandbox iframe| E[DSH 插件<br/>侧边栏 🎮 游戏 tab]
    B --> F[未来端<br/>桌面壳 / 小程序]
```

设计原则：

1. **目录即数据**：`games.json` 是唯一事实来源，网站与插件都只读它；加游戏零代码改动
2. **收录即验证**：ingest 管线自动检查每个游戏 URL 的 `X-Frame-Options` / `CSP frame-ancestors`，不可嵌入的游戏不会进入目录
3. **插件薄壳**：插件只负责侧边栏标签 + 沙箱 iframe，游戏逻辑与 UI 全在网站侧，插件永远不用为新增游戏发版

## ➕ 收录新游戏

**方式一：编辑目录（最快）** — 在 `site/data/games.json` 的 `games` 数组追加：

```json
{
  "id": "manual:my-game",
  "slug": "my-game",
  "name": "我的游戏",
  "category": "puzzle",
  "tags": ["classic"],
  "description": "一句话介绍",
  "tech": "html5",
  "embed": "https://<game-url>",
  "embed_ok": true,
  "source_repo": "https://github.com/...",
  "license": "MIT"
}
```

**方式二：跑收录管线（批量）**

```bash
python3 scripts/ingest.py        # 拉取全部 registry 源并校验，重建目录
```

收录标准：可 iframe 嵌入、无强制广告/跳转、开源或已获授权、内容健康。

> ⚠️ 版权说明：每个游戏的版权与许可归其上游作者，条目中的 `source_repo` / `license` 字段用于溯源。收到上游作者的移除请求会立即处理。

## 🚀 部署独立网站（可选）

线上实例已自托管在独立服务器（nginx，含 94 款游戏全量镜像）。自建时：

```bash
python3 -m http.server 8080 --directory site   # 本地预览
# 静态托管：任意支持静态文件的即可（nginx / GitHub Pages / Cloudflare Pages）
# 游戏全量镜像（可选，彻底摆脱外网依赖）：
python3 scripts/mirror2.py /path/to/mirror   # 抓取全部游戏静态文件
```

## 🔖 插件市场与 SEO

- `package.json` 的 `keywords` 覆盖 `dsh / deepseek-harness / dsh-plugin / games / arcade / sidebar / entertainment`，可被插件目录与 GitHub topic 检索
- 建议给仓库加 GitHub topics：`deepseek-harness` `dsh-plugin` `browser-games` `html5-games` `mini-games` `sidebar`
- 站点已内置 `description` meta 与 emoji favicon；上线后建议补充 sitemap 与 OG 图

## 🗺️ Roadmap

- [x] 插件骨架 + 侧边栏标签 + 沙箱播放器
- [x] 目录管线与可嵌入性校验
- [x] 网站启动页（搜索/分类/收藏/随机/全屏）
- [x] 94 款游戏全量自托管（scripts/mirror2.py 镜像管线）
- [ ] 94 → 1000+ 游戏扩充（持续跑 ingest，欢迎 PR）
- [ ] 游戏排行榜（localStorage 起步，后端可选）
- [ ] 中英文目录元数据
- [ ] DSH 主题色适配（读取 --dsw-* tokens）

## 🤝 贡献

欢迎 PR 收录新游戏、修复失效链接、改进 UI。收录前请跑 `python3 scripts/ingest.py` 确认新游戏通过可嵌入性校验。

## 📄 License

本仓库代码 MIT。收录的第三方游戏各自遵循其上游许可证，详见 `games.json` 中的 `license` 字段；这些游戏的版权归其各自作者。

<p align="center">
<em>如果觉得有用，点个 ⭐ 让更多 DSH 用户发现它！</em>
</p>
