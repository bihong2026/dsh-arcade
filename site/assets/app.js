/* GameHub app — loads games.json, renders grid, handles search/filter/player.
   Works standalone (site) and embedded (plugin sidebar via data-compact). */
(function () {
  'use strict';

  var state = { games: [], cats: [], filter: 'all', q: '', featured: null };
  var CAT_META = {};
  var EMOJI_FALLBACK = '🎮';

  // ---------- data ----------
  function load() {
    return fetch('data/games.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('games.json ' + r.status); return r.json(); })
      .then(function (data) {
        state.games = data.games || [];
        state.featured = data.featured || null;
        (data.categories || []).forEach(function (c) { CAT_META[c.id] = c; });
      });
  }

  // ---------- rendering ----------
  function gameEmoji(g) {
    var m = CAT_META[g.category];
    return (m && m.emoji) || EMOJI_FALLBACK;
  }

  function renderCats() {
    var nav = document.getElementById('cats');
    var counts = {};
    state.games.forEach(function (g) { counts[g.category] = (counts[g.category] || 0) + 1; });
    var btns = [
      { id: 'all', label: '全部', emoji: '🎮', n: state.games.length },
      { id: 'fav', label: '收藏', emoji: '⭐', n: favs().length }
    ];
    Object.keys(CAT_META).forEach(function (id) {
      if (counts[id]) btns.push({ id: id, emoji: CAT_META[id].emoji, label: CAT_META[id].label, n: counts[id] });
    });
    nav.innerHTML = '';
    btns.forEach(function (b) {
      var el = document.createElement('button');
      el.className = 'cat-btn' + (state.filter === b.id ? ' active' : '');
      el.textContent = b.emoji + ' ' + b.label + ' ' + b.n;
      el.onclick = function () { state.filter = b.id; renderCats(); renderGrid(); };
      nav.appendChild(el);
    });
  }

  function favs() { try { return JSON.parse(localStorage.getItem('gb_favs') || '[]'); } catch (e) { return []; } }
  function toggleFav(id) {
    var f = favs(), i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    localStorage.setItem('gb_favs', JSON.stringify(f));
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    return state.games.filter(function (g) {
      if (state.filter === 'fav') { if (favs().indexOf(g.id) < 0) return false; }
      else if (state.filter !== 'all' && g.category !== state.filter) return false;
      if (!q) return true;
      var hay = (g.name + ' ' + (g.description || '') + ' ' + (g.tags || []).join(' ') + ' ' + g.category).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function renderGrid() {
    var grid = document.getElementById('grid');
    var empty = document.getElementById('empty');
    var list = visible();
    document.getElementById('hero-count').textContent =
      '共 ' + state.games.length + ' 款游戏 · 当前显示 ' + list.length + ' 款 · 收藏 ' + favs().length + ' 款';
    empty.hidden = list.length > 0;
    var frag = document.createDocumentFragment();
    list.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-id', g.id);
      var fav = favs().indexOf(g.id) >= 0;
      card.innerHTML =
        (g.cover ? '<img class="card-cover" loading="lazy" alt="" src="' + esc(g.cover) + '">' :
                   '<span class="card-emoji">' + gameEmoji(g) + '</span>') +
        '<div class="card-body">' +
        '<div class="card-top"><span class="card-name">' + esc(g.name) + '</span>' +
        '<span class="card-cat" data-fav="' + (fav ? '⭐' : '☆') + '">' + (fav ? '⭐' : (CAT_META[g.category] || {}).label || '') + '</span></div>' +
        '<div class="card-desc">' + esc(g.description || '') + '</div></div>';
      card.onclick = function (e) {
        if (e.target.hasAttribute('data-fav')) {
          toggleFav(g.id); renderCats(); renderGrid(); return;
        }
        openPlayer(g);
      };
      frag.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- player ----------
  function openPlayer(g) {
    var p = document.getElementById('player');
    document.getElementById('player-title').textContent = gameEmoji(g) + ' ' + g.name;
    var frame = document.getElementById('player-frame');
    frame.src = g.embed;
    document.getElementById('player-open').href = g.embed;
    p.hidden = false;
    document.body.style.overflow = 'hidden';
    if (history.replaceState) history.replaceState(null, '', '#play=' + encodeURIComponent(g.slug));
  }
  function closePlayer() {
    document.getElementById('player').hidden = true;
    document.getElementById('player-frame').src = 'about:blank';
    document.body.style.overflow = '';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  // ---------- boot ----------
  function init() {
    // deep link #play=slug
    var m = location.hash.match(/#play=([^&]+)/);
    var want = m ? decodeURIComponent(m[1]) : null;

    load().then(function () {
      renderCats(); renderGrid();
      if (want) {
        var g = state.games.filter(function (x) { return x.slug === want; })[0];
        if (g) openPlayer(g);
      }
      document.getElementById('hero').scrollIntoViewIfNeeded && 0;
    }).catch(function (e) {
      document.getElementById('grid').innerHTML =
        '<p class="empty">加载游戏目录失败：' + esc(e.message) + '</p>';
    });

    document.getElementById('search').addEventListener('input', function (e) {
      state.q = e.target.value; renderGrid();
    });
    document.getElementById('player-close').onclick = closePlayer;
    document.getElementById('player-reload').onclick = function () {
      var f = document.getElementById('player-frame');
      f.src = f.src;
    };
    document.getElementById('player-full').onclick = function () {
      var f = document.getElementById('player-frame');
      if (f.requestFullscreen) f.requestFullscreen();
    };
    document.getElementById('random-btn').onclick = function () {
      if (!state.games.length) return;
      openPlayer(state.games[Math.floor(Math.random() * state.games.length)]);
    };
    document.getElementById('theme-btn').onclick = function () {
      var d = document.documentElement;
      var dark = d.getAttribute('data-theme') === 'dark';
      d.setAttribute('data-theme', dark ? '' : 'dark');
      localStorage.setItem('gb_theme', dark ? 'light' : 'dark');
      document.getElementById('theme-btn').textContent = dark ? '☀️' : '🌙';
    };
    if (localStorage.getItem('gb_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('theme-btn').textContent = '🌙';
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('player').hidden) closePlayer();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); document.getElementById('search').focus();
      }
    });
    window.addEventListener('hashchange', function () {
      var mm = location.hash.match(/#play=([^&]+)/);
      if (mm) {
        var g = state.games.filter(function (x) { return x.slug === decodeURIComponent(mm[1]); })[0];
        if (g) openPlayer(g); else closePlayer();
      }
    });
    // plugin mode: sidebar host sets <body data-compact>
    if (document.body.hasAttribute('data-compact')) {
      document.getElementById('hero').hidden = true;
      var fl = document.getElementById('plugin-link'); if (fl) fl.parentElement.hidden = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
