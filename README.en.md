# 🎮 GameHub Arcade for DeepSeek Harness

**1000+ classic browser games · Play instantly · Zero installs · One click away in your DSH sidebar**

> 简体中文文档见 [README.md](README.md)

**GameHub Arcade** is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. Once installed, a **🎮 Games** tab appears in the DSH web sidebar — a full arcade with 150+ (growing to 1000+) open-source browser games: Snake, 2048, Tetris, Pac-Man, Minesweeper, Go, Hextris and more.

- ⚡ **Instant play** — games run in a sandboxed iframe, nothing to install locally
- 🔍 **Search / categories / favorites / random** across 10 genres
- 🌓 **Dark & light themes**
- 🔒 **Sandboxed** — cross-origin isolation from DSH data
- 🧩 **Extensible** — the catalog is plain JSON; adding a game is a one-record change

The repo also ships a **standalone game site** (deployable to GitHub Pages / Cloudflare Pages). The plugin embeds the same site — one catalog, two traffic entry points.

## Install

```bash
dsh plugin --profile web add github:gamehub-dev/dsh-arcade#v0.1.0
# or track main
dsh plugin --profile web add github:gamehub-dev/dsh-arcade#main
```

Restart `dsh web` and refresh — the **🎮 Games** tab appears in the sidebar.

## Adding a game

Append one record to `site/data/games.json` (see README.md for the schema), or run the ingest pipeline:

```bash
python3 scripts/ingest.py
```

Every game URL is verified for iframe embeddability (no `X-Frame-Options` / `frame-ancestors` blocks) before it enters the catalog.

## License

MIT for this repo's code. Bundled third-party games keep their upstream licenses — see the `license` field in `games.json`.

⭐ Star the repo so more DSH users can find it!
