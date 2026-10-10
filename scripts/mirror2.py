#!/usr/bin/env python3
"""Mirror all games preserving original URL path structure.

Layout: OUT/<slug>/<original-path-under-host>  (wget -nH).
Served URL for a game = /games/<slug>/<original path>/
This makes root-absolute refs (/js/x.js) map uniformly to /games/<slug>/js/x.js
"""
import json, os, sys, subprocess, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

GAMES = '/home/agentuser/gamehub-plugin/site/data/games.json'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/mirror3'
ONLY = sys.argv[2:] if len(sys.argv) > 2 else None
CDNS = ",".join([
    "cdnjs.cloudflare.com", "unpkg.com", "cdn.jsdelivr.net", "ajax.googleapis.com",
    "code.jquery.com", "code.responsivevoice.org", "fonts.googleapis.com",
    "fonts.gstatic.com", "cdn.jsdelivr.org", "maxcdn.bootstrapcdn.com",
    "stackpath.bootstrapcdn.com", "cdn.datatables.net", "kit.fontawesome.com",
])
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
EXCL = "*.mp4,*.zip,*.exe,*.dmg,*.7z,*.tar.gz,*.apk,*.apworld"

def entry_path(embed):
    """original path of the entry doc, e.g. /3d.city/index.html -> '3d.city/index.html'"""
    p = urllib.parse.urlparse(embed).path
    p = p.lstrip('/')
    if p.endswith('/') or p == '':
        p = p + 'index.html'
    return p

def mirror(g):
    slug, embed = g['slug'], g['embed']
    host = urllib.parse.urlparse(embed).netloc
    dest = os.path.join(OUT, slug)
    if os.path.isfile(os.path.join(dest, entry_path(embed))):
        return (slug, 'SKIP', entry_path(embed), 0)
    os.makedirs(dest, exist_ok=True)
    cmd = ['wget', '-q', '-e', 'robots=off', '--no-check-certificate',
           '-r', '-l', '2', '-np', '-k', '-p', '-nH', '-H',
           '-D', f'{host},{CDNS}', '-R', EXCL, '-U', UA,
           '-t', '2', '-T', '20', '-P', dest, embed]
    try:
        subprocess.run(cmd, timeout=300, capture_output=True)
    except subprocess.TimeoutExpired:
        pass
    n = sum(len(f) for _, _, f in os.walk(dest))
    ep = os.path.join(dest, entry_path(embed))
    if os.path.isfile(ep):
        return (slug, 'OK', entry_path(embed), n)
    return (slug, 'MISS', entry_path(embed), n)

def main():
    data = json.load(open(GAMES))
    games = data['games']
    if ONLY:
        games = [g for g in games if g['slug'] in ONLY]
    os.makedirs(OUT, exist_ok=True)
    res = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(mirror, g) for g in games]
        for f in as_completed(futs):
            r = f.result()
            res.append(r)
            print(f"{r[1]:4} {r[3]:3}f {r[0]} -> {r[2]}", flush=True)
    json.dump(res, open(os.path.join(OUT, '_report.json'), 'w'), indent=1)
    ok = sum(1 for r in res if r[1] in ('OK', 'SKIP'))
    print(f"== {ok}/{len(res)} ok ==")

if __name__ == '__main__':
    main()
