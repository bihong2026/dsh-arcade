# 🎮 GameHub Arcade for DeepSeek Harness

**94 verified classic browser games · Play instantly · Zero installs · One click away in your DSH sidebar**

> 简体中文文档见 [README.md](README.md)

**GameHub Arcade** is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. Once installed, a **🎮 Games** tab appears in the DSH web sidebar — a full arcade of open-source browser games: Snake, 2048, Tetris, Pac-Man, Minesweeper, Go, Hextris and more. All 94 entries were individually verified to be embeddable and playable.

- ⚡ **Instant play** — games run in a sandboxed iframe, nothing to install locally
- 🔍 **Search / categories / favorites / random** across 13 genres
- 🌓 **Dark & light themes**
- 🔒 **Sandboxed** — cross-origin isolation from DSH data
- 🧩 **Extensible** — the catalog is plain JSON; adding a game is a one-record change

The repo also ships a **standalone game site**. The plugin embeds the same site — one catalog, two traffic entry points. Live instance: <http://122.51.206.118/> (all 94 games self-hosted, no dependency on any code-hosting platform).

**Repositories (both kept in sync)**
- GitHub: <https://github.com/bihong2026/dsh-arcade>
- Gitee (faster in mainland China): <https://gitee.com/bihong2023/dsh-arcade>

## Install

Run in your DeepSeek Harness terminal (replace `web` with your profile name).

**Option A — local directory (most reliable, recommended)**

```bash
# GitHub
git clone https://github.com/bihong2026/dsh-arcade.git
# or Gitee (faster in mainland China)
git clone https://gitee.com/bihong2023/dsh-arcade.git

dsh plugin --profile web add ./dsh-arcade
```

**Option B — install from the Git host**

`dsh plugin add` forwards its argument verbatim to pnpm, so it accepts only pnpm-recognised source formats: use the `github:` shorthand for GitHub, and a full git URL for any other host such as Gitee.

```bash
# GitHub (shorthand)
dsh plugin --profile web add "github:bihong2026/dsh-arcade#v0.1.2"

# Gitee (full git URL — note the git+ prefix and the #tag)
dsh plugin --profile web add "git+https://gitee.com/bihong2023/dsh-arcade.git#v0.1.2"

# Track main instead
dsh plugin --profile web add "github:bihong2026/dsh-arcade#main"
dsh plugin --profile web add "git+https://gitee.com/bihong2023/dsh-arcade.git#main"
```

> Git sources fetch **sources**, and pnpm 10+ requires a build-script grant. This repo commits its `lib/` build output, so no local build is needed; if install reports `Ignored build scripts`, run `pnpm approve-builds` as prompted — or use Option A / Option C to skip building entirely.

**Option C — tarball (no network dependency, best for offline delivery)**

```bash
dsh plugin add ./dsh-arcade-0.1.2.tgz
```

Restart `dsh web` and refresh — the **🎮 Games** tab appears in the sidebar.

## Adding a game

Append one record to `site/data/games.json` (see README.md for the schema), or run the ingest pipeline:

```bash
python3 scripts/ingest.py
```

Every game URL is verified for iframe embeddability (no `X-Frame-Options` / `frame-ancestors` blocks) and its page title is checked before it enters the catalog. To mirror all games locally:

```bash
python3 scripts/mirror2.py /path/to/mirror
```

## License

MIT for this repo's code. Bundled third-party games keep their upstream licenses — see the `license` field in `games.json`.

⭐ Star the repo so more DSH users can find it!
