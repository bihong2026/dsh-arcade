# 架构

## 概览

GameHub Arcade 由三部分组成，全部围绕一个 JSON 目录运转：

```
scripts/ingest.py ──生成──▶ site/data/games.json ──读取──▶ site/（静态网站）
                                        └──读取──▶ （DSH 插件，iframe 嵌网站）
```

## 1. 目录管线 (`scripts/ingest.py`)

- 从 registry 源（如 sausi-7/games 的 `registry.json`）批量拉取游戏元数据
- 手工精选的经典游戏写在 `MANUAL_SOURCES` 里
- 逐个 URL 发 HEAD 请求，检查 `X-Frame-Options` / `CSP frame-ancestors`，不可嵌入的剔除
- 结果排序去重后写入 `site/data/games.json`

重新收录：`python3 scripts/ingest.py`（增量：已验证的 URL 不会重复校验；`--force` 全量重跑）

## 2. 网站 (`site/`)

零构建纯静态：`index.html` + `assets/app.js` + `assets/style.css`。

- `app.js` 只做三件事：读目录 → 渲染网格（搜索/分类/收藏/随机）→ 播放器弹层（iframe + 全屏 + 新窗口）
- 主题用 CSS 变量（`--gb-*`），`data-theme="light"` 切换；`body[data-compact]` 是插件侧边栏的紧凑布局模式
- 深链：`#play=<slug>` 直达某游戏（插件/分享场景用）

## 3. 插件 (repo 根 → 仓库根 package.json)

DSH web profile 插件，标准双入口结构：

- `src/index.js`（host）：注册 `/gamehub-arcade/api` 健康检查路由
- `src/client.js`（client）：通过 `client-ui-slots.register()` 注册侧边栏「🎮 游戏」标签，内容为站点的沙箱 iframe
- `build.mjs`：esbuild 打包 client（`react` external，由 DSH 宿主提供；输出用 `window.__ModuleLoader__.load()` 包装）
- `lib/` 为构建产物，随仓库提交，安装无需本地构建

## 扩展点

| 想做的事 | 改哪里 |
|---|---|
| 加一个游戏 | `games.json` 加一条记录，或 `ingest.py` 的 `MANUAL_SOURCES` |
| 加一个 registry 源 | `ingest.py` 的 `REGISTRY_SOURCES` |
| 换/加分类 | `ingest.py` 的 `categories` + 站点自动感知 |
| 自定义站点皮肤 | `site/assets/style.css` 的 CSS 变量 |
| 插件指向自己的站点 | `src/client.js` 的 `GAMEHUB_URL` |
