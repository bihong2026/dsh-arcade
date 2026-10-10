#!/usr/bin/env python3
"""Mirror all games from games.json to local static files.

For each game: download embed page HTML, rewrite absolute refs where possible,
download same-origin static assets (js/css/img) referenced in HTML (plus a
shallow scan of css url() refs). Output to OUT/<slug>/.
Produces a report of which games mirrored successfully.
"""
import json, os, re, sys, urllib.parse, urllib.request, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "http://122.51.206.118"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mirror"
GAMES_JSON = sys.argv[2] if len(sys.argv) > 2 else "site/data/games.json"

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
ASSET_EXT = re.compile(r"\.(js|mjs|css|png|jpe?g|gif|svg|webp|ico|mp3|ogg|wav|json|woff2?|ttf|xml|txt|map|wasm|data|mem|pak|unityweb)(\?|#|$)", re.I)

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def normalize(url):
    return url.split("#")[0]

def safe_name(url, default_ext=""):
    p = urllib.parse.urlparse(url).path
    name = os.path.basename(p) or "index"
    if default_ext and "." not in name:
        name += default_ext
    return name

def mirror_one(slug, embed):
    """Returns (slug, status, detail, files_count)"""
    game_dir = os.path.join(OUT, slug)
    os.makedirs(game_dir, exist_ok=True)
    embed = normalize(embed)
    base = embed.rsplit("/", 1)[0] + "/"
    parsed = urllib.parse.urlparse(embed)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    files = 0
    try:
        html = fetch(embed).decode("utf-8", "replace")
    except Exception as e:
        return (slug, "FAIL", f"fetch html: {e}", 0)
    with open(os.path.join(game_dir, "index.html"), "w") as f:
        f.write(html)

    # collect candidate asset URLs from html
    urls = set()
    for m in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', html):
        u = m.group(1)
        if u.startswith("data:") or u.startswith("mailto:") or u.startswith("javascript:"):
            continue
        full = urllib.parse.urljoin(embed, u)
        if full.startswith(origin) and ASSET_EXT.search(full):
            urls.add(normalize(full))
    # also fetch <script> and <link> regardless of ext when same-origin
    for m in re.finditer(r'<script[^>]+src=["\']([^"\']+)["\']', html):
        full = urllib.parse.urljoin(embed, m.group(1))
        if full.startswith(origin):
            urls.add(normalize(full))
    for m in re.finditer(r'<link[^>]+href=["\']([^"\']+)["\']', html):
        full = urllib.parse.urljoin(embed, m.group(1))
        if full.startswith(origin) and "stylesheet" in html[max(0, m.start()-120):m.start()]:
            urls.add(normalize(full))

    seen = set()
    queue = list(urls)[:80]
    while queue:
        u = queue.pop(0)
        if u in seen:
            continue
        seen.add(u)
        try:
            data = fetch(u)
        except Exception:
            continue
        name = safe_name(u)
        # avoid collisions
        h = hashlib.md5(u.encode()).hexdigest()[:6]
        if os.path.exists(os.path.join(game_dir, name)) and name != "index.html":
            root, ext = os.path.splitext(name)
            name = f"{root}_{h}{ext}"
        with open(os.path.join(game_dir, name), "wb") as f:
            f.write(data)
        files += 1
        # css: scan url() refs for more assets (one more level)
        if u.endswith(".css"):
            try:
                css = data.decode("utf-8", "replace")
                for m in re.finditer(r'url\((["\']?)([^)"\']+)\1\)', css):
                    cu = m.group(2)
                    if cu.startswith("data:"):
                        continue
                    full = urllib.parse.urljoin(u, cu)
                    if full.startswith(origin) and full not in seen:
                        queue.append(normalize(full))
            except Exception:
                pass
    return (slug, "OK", "", files)

def main():
    data = json.load(open(GAMES_JSON))
    games = data["games"] if isinstance(data, dict) else data
    os.makedirs(OUT, exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(mirror_one, g["slug"], g["embed"]): g for g in games}
        for fut in as_completed(futs):
            try:
                r = fut.result()
            except Exception as e:
                r = (futs[fut]["slug"], "FAIL", str(e)[:100], 0)
            results.append(r)
            print(f"{r[1]:5} {r[3]:3}f  {r[0]}  {r[2]}", flush=True)
    ok = [r for r in results if r[1] == "OK"]
    print(f"\n== mirrored OK: {len(ok)}/{len(results)} ==")
    json.dump(results, open(os.path.join(OUT, "_report.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
