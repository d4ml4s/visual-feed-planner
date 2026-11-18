/* Visual Feed Planner, baseline: renders the plan as the Doc 2 grid (view only).
 * Tile model: { id, kind: 'carousel'|'post'|'reel'|'empty', date: 'YYYY-MM-DD'|'', title,
 *               images: [{src, name}], video?, match?: 'same'|'similar', style?, label?, note }
 * Editing (add / fill / move / delete) arrives with F1 and F2.
 */
(function () {
  'use strict';

  var AYK = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var AY = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var GUNK = ['Paz', 'Pzt', 'Sal', 'Çar', 'Prş', 'Cum', 'Cmt'];          // indexed by Date.getDay()
  var GUNL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  var DAY = 864e5;

  var plan = Store.load();
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------- dates ----------
  function parse(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function monday(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function chip(d) { return d.getDate() + ' ' + AYK[d.getMonth() + 1] + ' · ' + GUNK[d.getDay()]; }
  function shortRange(a, b) {
    return a.getMonth() === b.getMonth()
      ? a.getDate() + '–' + b.getDate() + ' ' + AYK[b.getMonth() + 1]
      : a.getDate() + ' ' + AYK[a.getMonth() + 1] + '–' + b.getDate() + ' ' + AYK[b.getMonth() + 1];
  }
  function longRange(a, b) {
    if (+a === +b) return a.getDate() + ' ' + AY[a.getMonth() + 1];
    return a.getMonth() === b.getMonth()
      ? a.getDate() + '–' + b.getDate() + ' ' + AY[a.getMonth() + 1]
      : a.getDate() + ' ' + AY[a.getMonth() + 1] + ' – ' + b.getDate() + ' ' + AY[b.getMonth() + 1];
  }

  // ---------- weeks ----------
  /** Groups tiles into weeks. Undated tiles belong to the week of the tile before them. */
  function weeks() {
    var dated = plan.tiles.map(function (t) { return parse(t.date); }).filter(Boolean);
    if (!dated.length) return { byTile: {}, list: [] };
    var start = new Date(Math.min.apply(null, dated));
    var zero = parse(plan.weekZero) || monday(start);
    var byTile = {}, list = [], seen = {}, cur = null;
    plan.tiles.forEach(function (t) {
      var d = parse(t.date);
      if (d) {
        var mon = monday(d);
        var n = Math.round((mon - zero) / DAY / 7) + 1;
        var id = 'hafta-' + n;
        if (!seen[id]) {
          var first = mon < start ? start : mon, sun = addDays(mon, 6);
          seen[id] = { id: id, n: n, first: first, sun: sun, firstTileId: t.id };
          list.push(seen[id]);
        }
        cur = seen[id];
      }
      if (cur) byTile[t.id] = cur;
    });
    return { byTile: byTile, list: list };
  }

  function themeChips(w) {
    var frag = document.createDocumentFragment();
    (plan.themes || []).forEach(function (th) {
      var a = parse(th.from), b = parse(th.to);
      if (!a || !b || a > w.sun || b < w.first) return;
      var from = a < w.first ? w.first : a, to = b > w.sun ? w.sun : b;
      var whole = +from === +w.first && +to === +w.sun;
      var label = th.name + (whole ? '' : ' · ' + (+from === +to ? from.getDate() + ' ' + AYK[from.getMonth() + 1] : shortRange(from, to)));
      var s = el('span', 'th');
      s.style.setProperty('--tc', th.color || '#999');
      s.appendChild(el('i'));
      s.appendChild(document.createTextNode(label));
      frag.appendChild(s);
    });
    return frag;
  }

  // ---------- grid ----------
  function img(src, alt) {
    var i = el('img');
    i.loading = 'lazy';
    i.src = src;
    i.alt = alt || '';
    return i;
  }

  function renderTile(t, w) {
    var d = parse(t.date);
    var tile = el('div', 'tile');
    tile.dataset.id = t.id;
    if (w) tile.dataset.wk = w.id;
    var images = t.images || [];

    if (t.kind === 'empty' || !images.length) {
      tile.classList.add('empty');
      if (t.style && t.style !== 'ugc') tile.classList.add(t.style);
      tile.appendChild(el('span', 'plus', t.style === 'novid' ? '!' : '+'));
      tile.appendChild(el('span', 'elbl', t.label || 'Boş kutu'));
    } else if (t.kind === 'carousel') {
      tile.classList.add('car');
      var strip = el('div', 'strip');
      images.forEach(function (im) { strip.appendChild(img(im.src, im.name)); });
      tile.appendChild(strip);
      tile.appendChild(el('span', 'ico'));
      var dots = el('span', 'dots');
      images.forEach(function () { dots.appendChild(el('i')); });
      tile.appendChild(dots);
      var mark = function () {
        var i = Math.round(strip.scrollLeft / (strip.clientWidth || 1));
        Array.prototype.forEach.call(dots.children, function (dot, k) { dot.classList.toggle('on', k === i); });
      };
      strip.addEventListener('scroll', mark, { passive: true });
      mark();
    } else {
      tile.classList.add(t.kind === 'reel' ? 'reel' : 'post');
      tile.appendChild(img(images[0].src, images[0].name));
      if (t.kind === 'reel') tile.appendChild(el('span', 'play'));
      if (t.match === 'same') tile.appendChild(el('span', 'badge same', 'Aynı ürün'));
      if (t.match === 'similar') tile.appendChild(el('span', 'badge sim', 'Benzer'));
    }

    if (d) tile.appendChild(el('span', 'date', chip(d)));
    if (w && w.firstTileId === t.id) {
      tile.classList.add('wstart');
      var band = el('span', 'wband', 'Hafta ' + w.n + ' · ' + shortRange(w.first, w.sun));
      band.id = w.id;
      tile.appendChild(band);
    }
    if (!tile.classList.contains('empty')) {
      tile.setAttribute('role', 'button');
      tile.tabIndex = 0;
      tile.setAttribute('aria-label', (t.kind === 'carousel' ? 'Carousel' : t.kind === 'reel' ? 'Reel' : 'Gönderi') + (d ? ' ' + chip(d) : '') + (t.title ? ': ' + t.title : ''));
    }
    return tile;
  }

  function render() {
    var wk = weeks();
    var feed = $('feed');
    feed.textContent = '';
    plan.tiles.forEach(function (t) { feed.appendChild(renderTile(t, wk.byTile[t.id])); });
    $('empty-plan').hidden = plan.tiles.length > 0;

    var tabs = $('tabs');
    tabs.textContent = '';
    wk.list.forEach(function (w) {
      var a = el('a', 'tab');
      a.href = '#' + w.id;
      a.appendChild(el('b', null, 'H' + w.n));
      a.appendChild(document.createTextNode(shortRange(w.first, w.sun)));
      tabs.appendChild(a);
    });
    tabs.hidden = !wk.list.length;
    $('wbar').hidden = !wk.list.length;
    followWeeks(wk.list);
    markToday();
  }

  // ---------- pinned week bar follows the scroll ----------
  var observer = null;
  function followWeeks(list) {
    if (observer) observer.disconnect();
    if (!list.length) return;
    var byId = {};
    list.forEach(function (w) { byId[w.id] = w; });
    var current = null;
    function setWeek(id) {
      if (id === current || !byId[id]) return;
      current = id;
      var w = byId[id];
      $('wt').textContent = 'Hafta ' + w.n;
      $('wr').textContent = longRange(w.first, w.sun);
      var wc = $('wc');
      wc.textContent = '';
      wc.appendChild(themeChips(w));
      Array.prototype.forEach.call($('tabs').children, function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); });
    }
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setWeek(en.target.dataset.wk); });
    }, { rootMargin: '-130px 0px -70% 0px' });
    document.querySelectorAll('.tile[data-wk]').forEach(function (t) { observer.observe(t); });
    setWeek(list[0].id);
  }

  // ---------- today: highlight it and open the page there ----------
  function markToday() {
    var today = iso(new Date());
    var target = plan.tiles.filter(function (t) { return t.date && t.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    document.querySelectorAll('.tile').forEach(function (n) {
      var t = findTile(n.dataset.id);
      n.classList.toggle('today', !!t && t.date === today);
    });
    if (target && !location.hash) {
      var node = document.querySelector('.tile[data-id="' + target.id + '"]');
      if (node) node.scrollIntoView({ block: 'start' });
    }
  }

  function findTile(id) {
    for (var i = 0; i < plan.tiles.length; i++) if (plan.tiles[i].id === id) return plan.tiles[i];
    return null;
  }

  // ---------- large viewer ----------
  var viewer = $('viewer'), vbody = $('vbody'), vtitle = $('vtitle');

  function open(node) {
    var t = findTile(node.dataset.id);
    if (!t || !(t.images || []).length) return;
    var d = parse(t.date);
    vbody.textContent = '';
    vtitle.textContent = d ? GUNL[d.getDay()] + ' ' + d.getDate() + ' ' + AY[d.getMonth() + 1] : '';
    if (t.title) vtitle.appendChild(el('small', null, t.title));

    if (t.kind === 'reel' && t.video) {
      var wrap = el('div', 'vvideo');
      var v = el('video');
      v.src = t.video; v.controls = true; v.muted = true; v.playsInline = true; v.autoplay = true; v.loop = true;
      wrap.appendChild(v);
      var cap = el('div', 'vcount', (t.images[0].name || '') + (t.match === 'same' ? ' · aynı ürün' : t.match === 'similar' ? ' · benzer ürün' : ''));
      vbody.appendChild(wrap);
      vbody.appendChild(cap);
    } else {
      var strip = el('div', 'vstrip');
      t.images.forEach(function (im) {
        var f = el('figure');
        f.appendChild(img(im.src, im.name));
        f.appendChild(el('figcaption', null, im.name || ''));
        strip.appendChild(f);
      });
      var cnt = el('div', 'vcount');
      vbody.appendChild(strip);
      vbody.appendChild(cnt);
      var small = node.querySelector('.strip');
      var start = small ? Math.round(small.scrollLeft / (small.clientWidth || 1)) : 0;
      var upd = function () { cnt.textContent = (Math.round(strip.scrollLeft / (strip.clientWidth || 1)) + 1) + ' / ' + t.images.length; };
      strip.addEventListener('scroll', upd, { passive: true });
      viewer.hidden = false;
      strip.scrollLeft = start * strip.clientWidth;
      upd();
    }
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    $('vclose').focus();
  }

  function close() {
    viewer.hidden = true;
    vbody.textContent = '';
    document.body.style.overflow = '';
  }

  $('feed').addEventListener('click', function (e) {
    var node = e.target.closest('.tile');
    if (node && !node.classList.contains('empty')) open(node);
  });
  $('feed').addEventListener('keydown', function (e) {
    var node = e.target.closest('.tile');
    if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(node); }
  });
  $('vclose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !viewer.hidden) close(); });

  render();
})();
