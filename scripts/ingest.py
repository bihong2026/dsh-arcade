#!/usr/bin/env python3
"""
GameHub catalog ingest pipeline.

Pulls game registries from open-source GitHub Pages collections,
normalizes them into our unified catalog format, and verifies
each game's embeddability (no X-Frame-Options / CSP frame-ancestors).

Usage:
    python3 scripts/ingest.py            # refresh catalog from all sources
    python3 scripts/ingest.py --check    # re-verify embeddability only

Output: site/data/games.json  (single source of truth for site + plugin)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "games.json"

# ---------------------------------------------------------------------------
# Sources. Each entry produces catalog items with embed = a playable URL.
# "registry" sources expose a registry.json we can ingest wholesale.
# "manual" sources are curated classic games, one entry each.
# ---------------------------------------------------------------------------
SAUSI = "https://sausi-7.github.io/games/"

REGISTRY_SOURCES = [
    {
        "id": "sausi7",
        "registry_url": SAUSI + "games/registry.json",
        "base_url": SAUSI,
        "repo": "https://github.com/sausi-7/games",
        "license": "MIT",
    }
]

MANUAL_SOURCES = [
    # repo, license, slug, name, category, description, embed path
    ("https://github.com/gabrielecirulli/2048", "MIT", "2048-og", "2048 (原版)",
     "puzzle", "原版开源 2048，滑块合并抵达 2048", "https://gabrielecirulli.github.io/2048/"),
    ("https://github.com/tommalbran/games", "MIT", "tm-tetris", "Tetris 经典版",
     "puzzle", "经典俄罗斯方块，行消除得分", "https://tommalbran.github.io/games/tetris/"),
    ("https://github.com/tommalbran/games", "MIT", "tm-snake", "贪吃蛇经典版",
     "arcade", "经典贪吃蛇，吃食物变长", "https://tommalbran.github.io/games/snake/"),
    ("https://github.com/tommalbran/games", "MIT", "tm-pacman", "吃豆人",
     "arcade", "经典吃豆人，迷宫里吃豆躲鬼", "https://tommalbran.github.io/games/pacman/"),
    ("https://github.com/tommalbran/games", "MIT", "tm-spider", "蜘蛛纸牌",
     "board", "经典接龙类纸牌游戏", "https://tommalbran.github.io/games/spider/"),
    ("https://github.com/kenrick95/c4", "MIT", "connect4", "四子棋 (vs AI)",
     "board", "和 AI 对战的四子棋", "https://kenrick95.github.io/c4/demo/"),
    ("https://github.com/Hextris/hextris", "GPL-3.0", "hextris", "Hextris 六边形消除",
     "puzzle", "快节奏六边形旋转消除", "https://hextris.github.io/hextris/"),
    ("https://github.com/AlexNisnevich/untrusted", "MIT", "untrusted", "Untrusted 代码冒险",
     "puzzle", "修改 JavaScript 代码通关的元游戏", "https://untrustedgame.com/"),
    ("https://github.com/Vader941/minigame", "MIT", "vg-go", "围棋 (9/13/19路)",
     "board", "经典围棋对弈", "https://vader941.github.io/minigame/games/go.html"),
    ("https://github.com/Vader941/minigame", "MIT", "vg-battleship", "海战棋",
     "board", "经典战舰海战棋", "https://vader941.github.io/minigame/games/battleship.html"),
    ("https://github.com/Vader941/minigame", "MIT", "vg-memory", "记忆翻牌",
     "puzzle", "翻牌配对记忆游戏", "https://vader941.github.io/minigame/games/memory.html"),
]

BLOCK_PATTERNS = ("x-frame-options", "frame-ancestors")


def curl_headers(url: str) -> dict:
    """Fetch response headers; returns lowercase name -> value map."""
    try:
        out = subprocess.run(
            ["curl", "-sI", "-m", "15", "-A", "Mozilla/5.0", "-L", url],
            capture_output=True, text=True, timeout=25
        ).stdout
    except subprocess.TimeoutExpired:
        return {}
    headers = {}
    for line in out.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return headers


def is_embeddable(url: str) -> tuple[bool, str]:
    """True if the URL can be shown inside an iframe from another origin."""
    h = curl_headers(url)
    if not h:
        return False, "unreachable"
    for p in BLOCK_PATTERNS:
        for hk in h:
            if p in hk and url not in h.get(hk, ""):
                val = h[hk]
                # frame-ancestors directives that explicitly allow us are ok;
                # conservative default: any frame-ancestors/x-frame block fails
                return False, f"{hk}: {val}"
    return True, "ok"


def load_candidates() -> list[dict]:
    """Load curated candidates from data/candidates.json (produced by research runs).

    Each entry: {slug, name, category, embed, source_repo, license, description?}
    These are research-vetted, so only embeddability is checked (not title).
    """
    path = ROOT / "scripts" / "data" / "candidates.json"
    if not path.exists():
        return []
    try:
        entries = json.loads(path.read_text())
    except json.JSONDecodeError:
        print(f"  ! failed to parse {path}", file=sys.stderr)
        return []
    items = []
    for e in entries:
        slug = e["slug"]
        items.append({
            "id": f"curated:{slug}",
            "slug": slug,
            "name": e["name"],
            "category": e.get("category", "casual"),
            "tags": e.get("tags", []),
            "description": e.get("description", ""),
            "tech": e.get("tech", "html5"),
            "embed": e["embed"],
            "source_repo": e.get("source_repo", ""),
            "license": e.get("license", ""),
            "strict_title": False,
        })
    print(f"  curated candidates: {len(items)}")
    return items


def load_registries() -> list[dict]:
    items = []
    for src in REGISTRY_SOURCES:
        r = subprocess.run(["curl", "-s", "-m", "30", src["registry_url"]],
                           capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
        except json.JSONDecodeError:
            print(f"  ! failed to parse registry from {src['registry_url']}", file=sys.stderr)
            continue
        cats = {c["id"]: c for c in data.get("categories", [])}
        for g in data.get("games", []):
            url = src["base_url"] + g["path"]
            c = cats.get(g["category"], {})
            items.append({
                "id": f"{src['id']}:{g['slug']}",
                "slug": g["slug"],
                "name": g["name"],
                "category": g["category"],
                "tags": g.get("tags", []),
                "description": g.get("description", ""),
                "tech": g.get("tech", "html5"),
                "embed": url,
                "source_repo": src["repo"],
                "license": src["license"],
                "strict_title": True,
            })
    print(f"  registry items: {len(items)}")
    return items


def load_manuals() -> list[dict]:
    items = []
    for repo, lic, slug, name, cat, desc, embed in MANUAL_SOURCES:
        items.append({
            "id": f"manual:{slug}",
            "slug": slug,
            "name": name,
            "category": cat,
            "tags": [],
            "description": desc,
            "tech": "html5",
            "embed": embed,
            "source_repo": repo,
            "license": lic,
            "strict_title": False,
        })
    print(f"  manual items: {len(items)}")
    return items


def fetch_title(url: str) -> str:
    """Fetch a game page and return its <title> (for content mismatch checks)."""
    try:
        out = subprocess.run(
            ["curl", "-s", "-m", "20", "-A", "Mozilla/5.0", "-L", url],
            capture_output=True, text=True, timeout=30
        ).stdout
    except subprocess.TimeoutExpired:
        return ""
    m = re.search(r"<title[^>]*>(.*?)</title>", out, re.S)
    return m.group(1).strip() if m else ""


def name_matches_title(name: str, title: str) -> bool:
    """Loose check that a page's title corresponds to the catalog name."""
    if not title:
        return False
    n, t = name.lower(), title.lower()
    # strip common decorations from title
    for junk in (" - portrait", " – portrait", "🐴", "play", "free online game", "game"):
        t = t.replace(junk, " ")
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    tw = set(t.split()) - {"the", "a", "of", "in", "js", "html5", "phaser"}
    nw = set(n.split())
    if not nw:
        return False
    overlap = len(nw & tw) / len(nw)
    return overlap >= 0.5 or n[:8] in t


def verify(items: list[dict], force: bool = False) -> list[dict]:
    import concurrent.futures as cf

    existing = {}
    if OUT.exists() and not force:
        try:
            for g in json.loads(OUT.read_text())["games"]:
                existing[g["id"]] = (g.get("embed_ok"), g.get("title_ok"), g.get("page_title"))
        except Exception:
            existing = {}

    def check(g: dict) -> dict:
        prev = existing.get(g["id"])
        if prev and prev[1] is not None and not force:
            g["embed_ok"], g["title_ok"], g["page_title"] = prev
            g["drop"] = not (g["embed_ok"] and g["title_ok"])
            return g
        good, reason = is_embeddable(g["embed"])
        g["embed_ok"] = good
        g["title_ok"] = False
        g["page_title"] = ""
        if good:
            if g.get("strict_title", True):
                title = fetch_title(g["embed"])
                g["page_title"] = title
                g["title_ok"] = name_matches_title(g["name"], title)
            else:
                # research-vetted / manually curated: embeddability is enough
                g["title_ok"] = True
        g["drop"] = not (g["embed_ok"] and g["title_ok"])
        if g["drop"]:
            why = reason if not good else f"title={g['page_title'][:40]!r}"
            print(f"  ✗ {g['name']}: {why}")
        return g

    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(check, items))

    ok = sum(1 for g in items if g["embed_ok"] and g["title_ok"] and not g["drop"])
    print(f"  playable (embeddable + content match): {ok}/{len(items)}")
    return items


def build_catalog(items: list[dict]) -> dict:
    games = [g for g in items if g.get("embed_ok") and g.get("title_ok") and not g.get("drop")]
    games.sort(key=lambda g: (g["category"], g["name"].lower()))
    return {
        "version": 2,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "schema": {
            "id": "stable unique id (source:slug)",
            "slug": "url-safe identifier",
            "category": "puzzle|arcade|shooter|racing|sports|platformer|casual|board|word|3d",
            "tags": "free-form strings for search",
            "embed": "iframe-embeddable URL of the playable game",
            "embed_ok": "verified by ingest (no frame-blocking headers)",
            "source_repo": "attribution / upstream",
            "license": "upstream license (MIT etc.)",
        },
        "categories": [
            {"id": "puzzle", "label": "益智", "emoji": "🧩"},
            {"id": "arcade", "label": "街机", "emoji": "🕹️"},
            {"id": "shooter", "label": "射击", "emoji": "🎯"},
            {"id": "racing", "label": "竞速", "emoji": "🏎️"},
            {"id": "sports", "label": "体育", "emoji": "⚽"},
            {"id": "platformer", "label": "平台跳跃", "emoji": "🏃"},
            {"id": "casual", "label": "休闲", "emoji": "🎈"},
            {"id": "board", "label": "棋牌", "emoji": "♟️"},
            {"id": "word", "label": "文字", "emoji": "📝"},
            {"id": "word-quiz", "label": "文字", "emoji": "📝"},
            {"id": "rpg", "label": "角色扮演", "emoji": "⚔️"},
            {"id": "strategy", "label": "策略", "emoji": "🏰"},
            {"id": "3d", "label": "3D", "emoji": "🌐"},
        ],
        "games": games,
    }


def main():
    force = "--check" in sys.argv or "--force" in sys.argv
    print("[1/3] loading sources …")
    items = load_registries()
    items += load_candidates()
    items += load_manuals()
    # dedupe by slug, first wins
    seen, uniq = set(), []
    for g in items:
        if g["slug"] not in seen:
            seen.add(g["slug"])
            uniq.append(g)
    print(f"[2/3] verifying embeddability of {len(uniq)} games …")
    items = verify(uniq, force=force)
    print("[3/3] building catalog …")
    catalog = build_catalog(items)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=1))
    print(f"→ wrote {OUT} with {len(catalog['games'])} playable games")


if __name__ == "__main__":
    main()
