/* Visual Feed Planner: renders the plan as the Doc 2 grid; F1 adds tiles and fills them from Drive.
 * Tile model: { id, kind: 'carousel'|'post'|'reel'|'empty', date: 'YYYY-MM-DD'|'', title,
 *               images: [{src, name} | {driveId, name, mime}], video?, style?, label?, note }
 * Older plans may also carry match: 'same'|'similar'; it is no longer shown (Feature 3.1).
 * Local skeleton images use src; images placed from Drive store only the Drive file id.
 * archived: ISO time when the tile went to the archive (hidden from the grid, kept in the plan).
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
    if (+a === +b) return a.getDate() + ' ' + AYK[a.getMonth() + 1];
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
  /** Groups tiles into weeks. Undated tiles belong to the week of the tile before them.
   *  from/to = the first and last tile date in the week (shown on tabs, band and pinned bar, Feature 3.2);
   *  first/sun = the calendar week, used for the theme chips. */
  function shown() { return plan.tiles.filter(function (t) { return !t.archived; }); }

  function weeks() {
    var tiles = shown();
    var dated = tiles.map(function (t) { return parse(t.date); }).filter(Boolean);
    if (!dated.length) return { byTile: {}, list: [] };
    var start = new Date(Math.min.apply(null, dated));
    var zero = parse(plan.weekZero) || monday(start);
    var byTile = {}, list = [], seen = {}, cur = null;
    tiles.forEach(function (t) {
      var d = parse(t.date);
      if (d) {
        var mon = monday(d);
        var n = Math.round((mon - zero) / DAY / 7) + 1;
        var id = 'hafta-' + n;
        if (!seen[id]) {
          var first = mon < start ? start : mon, sun = addDays(mon, 6);
          seen[id] = { id: id, n: n, first: first, sun: sun, from: d, to: d, firstTileId: t.id };
          list.push(seen[id]);
        }
        cur = seen[id];
        if (d < cur.from) cur.from = d;
        if (d > cur.to) cur.to = d;
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
  function missText(t, im) {
    if (im.driveId && !(window.Drive && Drive.isSignedIn())) return (t.title ? t.title + ' · ' : '') + "Görmek için Drive'a bağlan";
    return t.title;
  }
  function isVideo(im) { return /^video\//.test(im.mime || ''); }

  // One picture: Drive files load through Drive.paint (preview, or the image itself if the preview is blocked).
  function pic(im, size, title) {
    if (!im.driveId) return img(im.src, im.name, title);
    if (!window.Drive) return el('span', 'miss', title || 'Görsel yok');
    // Remembered pictures show at once; others load from Drive when signed in.
    var i = el('img');
    i.alt = '';
    i.decoding = 'async';
    Drive.paint(i, im.driveId, im.mime, size, function () { if (i.parentNode) i.replaceWith(el('span', 'miss', title || 'Görsel yok')); });
    return i;
  }

  // A missing file (no local copy, or Drive not connected yet) becomes a soft grey box with the post's title.
  function img(src, alt, title) {
    if (!src) return el('span', 'miss', title || 'Görsel yok');
    var i = el('img');
    i.loading = 'lazy';
    i.alt = alt || '';
    i.onerror = function () { i.replaceWith(el('span', 'miss', title || 'Görsel yok')); };
    i.src = src;
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
      // A carousel can mix pictures and videos; a video slide shows its first frame with a ▶ mark.
      images.forEach(function (im) {
        if (!isVideo(im)) { strip.appendChild(pic(im, 600, missText(t, im))); return; }
        var s = el('span', 'slide');
        s.appendChild(pic(im, 600, missText(t, im)));
        s.appendChild(el('span', 'vmark'));
        strip.appendChild(s);
      });
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
      tile.appendChild(pic(images[0], 600, missText(t, images[0])));
      if (t.kind === 'reel') tile.appendChild(el('span', 'play'));
    }

    if (d) tile.appendChild(el('span', 'date', chip(d)));
    if (w && w.firstTileId === t.id) {
      tile.classList.add('wstart');
      var band = el('span', 'wband', 'Hafta ' + w.n + ' · ' + shortRange(w.from, w.to));
      band.id = w.id;
      tile.appendChild(band);
    }
    tile.draggable = !touch;           // 4.3: on the computer every tile can be dragged to a new place
    tile.setAttribute('role', 'button');
    tile.tabIndex = 0;
    tile.appendChild(delBtn(tile.classList.contains('empty')));
    tile.appendChild(addBtn('l', 'Soluna boş kutu ekle'));
    tile.appendChild(addBtn('r', 'Sağına boş kutu ekle'));
    if (tile.classList.contains('empty')) {
      tile.setAttribute('aria-label', 'Boş kutu' + (d ? ' ' + chip(d) : '') + ': doldur');
    } else {
      tile.setAttribute('aria-label', (t.kind === 'carousel' ? 'Carousel' : t.kind === 'reel' ? 'Reel' : 'Gönderi') + (d ? ' ' + chip(d) : '') + (t.title ? ': ' + t.title : ''));
    }
    return tile;
  }

  function render() {
    var wk = weeks();
    var feed = $('feed');
    feed.textContent = '';
    var tiles = shown();
    tiles.forEach(function (t) { feed.appendChild(renderTile(t, wk.byTile[t.id])); });
    // After the last tile: "+ Yeni kutu" adds at the end of the plan (any date, e.g. a new month).
    var end = el('button', 'tile addend');
    end.type = 'button';
    end.appendChild(el('span', 'plus', '+'));
    end.appendChild(el('span', 'elbl', 'Yeni kutu'));
    end.setAttribute('aria-label', 'Sona yeni kutu ekle');
    feed.appendChild(end);
    $('empty-plan').hidden = tiles.length > 0;

    var tabs = $('tabs');
    tabs.textContent = '';
    wk.list.forEach(function (w) {
      var a = el('a', 'tab');
      a.href = '#' + w.id;
      a.appendChild(el('b', null, 'H' + w.n));
      a.appendChild(document.createTextNode(shortRange(w.from, w.to)));
      tabs.appendChild(a);
    });
    tabs.hidden = !wk.list.length;
    $('wbar').hidden = !wk.list.length;
    followWeeks(wk.list);
    markToday();
    if (pick) showPick();
  }

  // ---------- pinned week bar follows the scroll ----------
  var observer = null, follow = null;
  function followWeeks(list) {
    if (observer) observer.disconnect();
    follow = null;
    if (!list.length) return;
    var byId = {};
    list.forEach(function (w) { byId[w.id] = w; });
    var current = null;
    function setWeek(id) {
      if (id === current || !byId[id]) return;
      current = id;
      var w = byId[id];
      $('wt').textContent = 'Hafta ' + w.n;
      $('wr').textContent = longRange(w.from, w.to);
      var wc = $('wc');
      wc.textContent = '';
      wc.appendChild(themeChips(w));
      Array.prototype.forEach.call($('tabs').children, function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); });
      // keep the highlighted tab in view in the tab row (phone: the row scrolls sideways)
      var row = $('tabs'), on = row.querySelector('.tab.on');
      if (on) {
        var a = on.getBoundingClientRect(), r = row.getBoundingClientRect();
        if (a.left < r.left || a.right > r.right) row.scrollLeft += a.left - r.left - 8;
      }
    }
    var last = list[list.length - 1].id;
    observer = new IntersectionObserver(function (entries) {
      if (atBottom()) { setWeek(last); return; }
      if (atTop()) { setWeek(list[0].id); return; }
      entries.forEach(function (en) { if (en.isIntersecting) setWeek(en.target.dataset.wk); });
    }, { rootMargin: '-130px 0px -70% 0px' });
    follow = { set: setWeek, first: list[0].id, last: last };
    document.querySelectorAll('.tile[data-wk]').forEach(function (t) { observer.observe(t); });
    setWeek(list[0].id);
  }

  // The last week can sit too low on the page to ever reach the top: at the bottom of the page it becomes current.
  function atBottom() {
    var root = document.documentElement;
    return root.scrollHeight > window.innerHeight + 4 && window.innerHeight + window.scrollY >= root.scrollHeight - 4;
  }
  // Before the first week reaches the bar's line (top of the page), the first week is current.
  function atTop() {
    var f = document.querySelector('.tile[data-wk]');
    return !!f && f.getBoundingClientRect().top > 130;
  }
  window.addEventListener('scroll', function () {
    if (!follow) return;
    if (atBottom()) follow.set(follow.last);
    else if (atTop()) follow.set(follow.first);
  }, { passive: true });
  // A tapped tab is the current week straight away.
  $('tabs').addEventListener('click', function (e) {
    var a = e.target.closest('.tab');
    if (a && follow) follow.set(a.getAttribute('href').slice(1));
  });

  // ---------- today: highlight it and open the page there ----------
  function markToday() {
    var today = iso(new Date());
    var target = shown().filter(function (t) { return t.date && t.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    document.querySelectorAll('.tile').forEach(function (n) {
      var t = findTile(n.dataset.id);
      n.classList.toggle('today', !!t && t.date === today);
    });
    if (target && !location.hash && !markToday.done) {
      markToday.done = true;   // only on the first render; edits must not jump the page
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

    var driveVideo = t.kind === 'reel' && t.images[0].driveId && isVideo(t.images[0]);
    if (t.kind === 'reel' && (t.video || driveVideo)) {
      var wrap = el('div', 'vvideo');
      var v = el('video');
      v.controls = true; v.muted = true; v.playsInline = true; v.autoplay = true; v.loop = true;
      if (driveVideo) {
        Drive.picture(t.images[0].driveId, t.images[0].mime, 1600).then(function (u) { v.poster = u; }, function () {});
        if (Drive.isSignedIn()) {
          Drive.fileUrl(t.images[0].driveId).then(function (u) {
            if (viewer.hidden) { URL.revokeObjectURL(u); return; }
            v.src = u; v.dataset.blob = u;
          }, function () {});
        }
      } else v.src = t.video;
      wrap.appendChild(v);
      var cap = el('div', 'vcount', t.images[0].name || '');
      vbody.appendChild(wrap);
      vbody.appendChild(cap);
    } else {
      var strip = el('div', 'vstrip');
      t.images.forEach(function (im) {
        var f = el('figure');
        if (im.driveId && isVideo(im)) {
          // A video slide: cover first; the video itself loads when the slide is shown.
          var sv = el('video');
          sv.controls = true; sv.muted = true; sv.playsInline = true; sv.loop = true;
          sv.dataset.id = im.driveId;
          Drive.picture(im.driveId, im.mime, 1600).then(function (u) { sv.poster = u; }, function () {});
          f.appendChild(sv);
        } else f.appendChild(pic(im, 1600, t.title));
        f.appendChild(el('figcaption', null, im.name || ''));
        strip.appendChild(f);
      });
      var cnt = el('div', 'vcount');
      vbody.appendChild(strip);
      vbody.appendChild(cnt);
      var small = node.querySelector('.strip');
      var start = small ? Math.round(small.scrollLeft / (small.clientWidth || 1)) : 0;
      var upd = function () {
        var i = Math.round(strip.scrollLeft / (strip.clientWidth || 1));
        cnt.textContent = (i + 1) + ' / ' + t.images.length;
        strip.querySelectorAll('video').forEach(function (sv, k) { if (sv.closest('figure') !== strip.children[i]) sv.pause(); });
        var cur = strip.children[i] && strip.children[i].querySelector('video');
        if (cur && !cur.dataset.blob && !cur.dataset.loading && Drive.isSignedIn()) {
          cur.dataset.loading = '1';
          Drive.fileUrl(cur.dataset.id).then(function (u) {
            if (viewer.hidden) { URL.revokeObjectURL(u); return; }
            cur.src = u; cur.dataset.blob = u; cur.play().catch(function () {});
          }, function () { delete cur.dataset.loading; });
        } else if (cur && cur.dataset.blob) cur.play().catch(function () {});
      };
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
    vbody.querySelectorAll('video[data-blob]').forEach(function (v) { v.pause(); URL.revokeObjectURL(v.dataset.blob); });
    vbody.textContent = '';
    document.body.style.overflow = '';
  }

  $('vclose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !viewer.hidden) close(); });

  // =====================================================================
  // F1: add empty tiles ("+" left/right) and fill empty tiles from Drive
  // =====================================================================
  var touch = window.matchMedia('(hover: none)').matches;

  function addBtn(side, label) {
    var b = el('button', 'add ' + side, '+');
    b.type = 'button';
    b.dataset.side = side;
    b.setAttribute('aria-label', label);
    return b;
  }

  function indexOf(id) {
    for (var i = 0; i < plan.tiles.length; i++) if (plan.tiles[i].id === id) return i;
    return -1;
  }

  // The tile's own date, or the nearest dated tile before it (undated tiles live in that week).
  function dateNear(i) {
    for (var k = i; k >= 0; k--) { var d = parse(plan.tiles[k].date); if (d) return d; }
    return null;
  }

  // Saves the plan; every save is also kept as a version (Geçmiş) with a short reason.
  function persist(reason) {
    try { Store.save(plan); }
    catch (e) { toast('Kaydedilemedi: tarayıcı hafızası dolu.'); return false; }
    if (window.Backup) { Backup.snapshot(plan, reason); Backup.refresh(); }
    return true;
  }

  // Short notice at the bottom; optional button (e.g. "Geri al") with its own action.
  function toast(text, actionLabel, action, ms) {
    var t = $('toast');
    t.textContent = text;
    if (actionLabel) {
      var b = el('button', null, actionLabel);
      b.type = 'button';
      b.addEventListener('click', function () { t.hidden = true; action(); });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }

  // ---- 1.4 delete a tile, with "Geri al" ----
  // ---- 2.3 "×": an empty tile is deleted, a full tile goes to the archive (both with "Geri al") ----
  function delBtn(empty) {
    var b = el('button', 'del');
    b.type = 'button';
    b.setAttribute('aria-label', empty ? 'Boş kutuyu sil' : 'Kutuyu arşive kaldır');
    return b;
  }

  function flash(id) {
    var n = document.querySelector('.tile[data-id="' + id + '"]');
    if (n) { n.classList.add('fresh'); n.scrollIntoView({ block: 'nearest' }); }
  }

  function isBlank(t) { return t.kind === 'empty' || !(t.images || []).length; }

  function removeTile(id) {
    var i = indexOf(id);
    if (i < 0) return;
    var t = plan.tiles[i];
    if (isBlank(t)) {
      plan.tiles.splice(i, 1);
      if (!persist('Boş kutu silindi')) { plan.tiles.splice(i, 0, t); return; }
      render();
      toast('Boş kutu silindi.', 'Geri al', function () {
        plan.tiles.splice(Math.min(i, plan.tiles.length), 0, t);
        if (persist('Geri alındı')) { render(); flash(t.id); }
      }, 7000);
      return;
    }
    t.archived = new Date().toISOString();
    if (!persist('Kutu arşivlendi')) { delete t.archived; return; }
    render();
    toast('Kutu arşive kaldırıldı.', 'Geri al', function () { unarchive(t.id, 'Geri alındı'); }, 7000);
  }

  function unarchive(id, reason) {
    var t = findTile(id);
    if (!t || !t.archived) return;
    var was = t.archived;
    delete t.archived;
    if (!persist(reason || 'Arşivden geri getirildi')) { t.archived = was; return; }
    render();
    flash(id);
  }

  // Removes an archived tile for good (the versions in Geçmiş still have it).
  function forget(id) {
    var i = indexOf(id);
    if (i < 0 || !plan.tiles[i].archived) return;
    var t = plan.tiles.splice(i, 1)[0];
    if (!persist('Arşivden silindi')) { plan.tiles.splice(i, 0, t); return; }
    toast('Arşivden silindi.', 'Geri al', function () {
      plan.tiles.splice(Math.min(i, plan.tiles.length), 0, t);
      persist('Geri alındı');
    }, 7000);
  }

  // ---- insert: ask the date first ----
  var ask = $('ask'), pending = null;

  // id = null: add at the very end of the plan ("+ Yeni kutu" after the last tile).
  function askDate(id, side) {
    var i = id ? indexOf(id) : plan.tiles.length - 1;
    if (id && i < 0) return;
    var base = i >= 0 ? dateNear(i) : null;
    pending = { id: id, side: side };
    $('ask-title').textContent = !id ? 'Sona yeni kutu' : side === 'l' ? 'Soluna yeni kutu' : 'Sağına yeni kutu';
    $('ask-date').value = iso(base ? addDays(base, side === 'l' ? -1 : 1) : new Date());
    var opts = $('ask-opts');
    opts.textContent = '';
    if (base) {
      opts.appendChild(dateBtn('Aynı gün', base));
      opts.appendChild(dateBtn(side === 'l' ? 'Bir gün önce' : 'Bir gün sonra', addDays(base, side === 'l' ? -1 : 1)));
    } else {
      var b = el('button', 'abtn', 'Tarihsiz ekle');
      b.type = 'button'; b.dataset.date = '';
      opts.appendChild(b);
    }
    ask.hidden = false;
    opts.firstChild.focus();
  }

  function dateBtn(label, d) {
    var b = el('button', 'abtn');
    b.type = 'button';
    b.dataset.date = iso(d);
    b.appendChild(el('b', null, label));
    b.appendChild(el('span', null, chip(d)));
    return b;
  }

  function closeAsk() { ask.hidden = true; pending = null; }

  function insert(date) {
    if (!pending) return;
    var at = pending.id ? indexOf(pending.id) + (pending.side === 'l' ? 0 : 1) : plan.tiles.length;
    var tile = { id: 't' + Date.now().toString(36), kind: 'empty', date: date, title: '', images: [] };
    plan.tiles.splice(at, 0, tile);
    closeAsk();
    if (!persist('Kutu eklendi')) { plan.tiles.splice(at, 1); return; }
    render();
    var node = document.querySelector('.tile[data-id="' + tile.id + '"]');
    if (node) { node.classList.add('fresh'); node.scrollIntoView({ block: 'nearest' }); node.focus({ preventScroll: true }); }
  }

  $('ask-opts').addEventListener('click', function (e) {
    var b = e.target.closest('.abtn');
    if (b) insert(b.dataset.date);
  });
  // "Başka gün": any date, e.g. the first day of a new month.
  $('ask-go').addEventListener('click', function () {
    var v = $('ask-date').value;
    if (!parse(v)) { $('ask-date').focus(); return; }
    insert(v);
  });
  $('ask-cancel').addEventListener('click', closeAsk);
  ask.addEventListener('click', function (e) { if (e.target === ask) closeAsk(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ask.hidden) closeAsk(); });

  // ---- fill an empty tile with Drive files (in the order chosen) ----
  // 1 image → post, 1 video → reel, 2+ files → carousel.
  function fill(id, items) {
    var t = findTile(id);
    if (!t || !items.length) return false;
    if (t.kind !== 'empty' && (t.images || []).length) { toast('Bu kutu dolu.'); return false; }
    var before = JSON.stringify(t);
    t.images = items.map(function (it) { return { driveId: it.id, name: it.name, mime: it.mime }; });
    t.kind = items.length > 1 ? 'carousel' : isVideo(t.images[0]) ? 'reel' : 'post';
    if (!t.title) t.title = t.label || '';
    delete t.style; delete t.label; delete t.video;
    if (!persist('Kutu dolduruldu')) { Object.assign(t, JSON.parse(before)); return false; }
    render();
    var node = document.querySelector('.tile[data-id="' + id + '"]');
    if (node) node.classList.add('fresh');
    toast(t.kind === 'carousel' ? 'Carousel eklendi (' + items.length + ').' : t.kind === 'reel' ? 'Reel eklendi.' : 'Gönderi eklendi.');
    return true;
  }

  function tileLabel(id) {
    var t = findTile(id);
    var d = t && parse(t.date);
    return d ? chip(d) : 'Tarihsiz kutu';
  }

  // After sign-in: load thumbnails for everything already placed from Drive, then redraw.
  function driveIds() {
    var ids = [];
    plan.tiles.forEach(function (t) { (t.images || []).forEach(function (im) { if (im.driveId) ids.push(im.driveId); }); });
    return ids;
  }
  document.addEventListener('drive:signedin', function () {
    // Redraw so tiles that were waiting for the sign-in load their pictures now.
    linkSkeleton().then(render);
  });

  // ---- Doc 2 skeleton → Drive ----
  // The skeleton points at local copies (media/2026-11-14_04.jpg, media/v-<name>.mp4) that no longer exist.
  // The same files are in the Drive library: carousel cards keep their day code at the start of the name
  // ("2026-11-14_04_…_4-5.jpg"); videos have a product code in front ("BIL-12 Taşlı nazar bileklik - video.MP4").
  // Once matched, the tile stores the Drive id and the local path is dropped.
  function key(s) {
    // NFKD splits "ş" into "s" + accent; dropping everything non-ASCII removes the accents (and "ı").
    return s.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')
      .toLowerCase().replace(/i/g, '').replace(/[^a-z0-9]/g, '');
  }
  function videoKey(name) {           // Drive name → comparable key
    return key(name.replace(/\.[^.]+$/, '').replace(/^[A-Z]{3}-[A-Z]?\d+\s+/, '')
      .replace(/\s*-\s*video\s*$/i, '').replace(/\([^)]*\)/g, ''));
  }
  function docVideoKey(src) {         // "media/v-baget-yan-tasl-emerald-yuzuk-foto-1k9a9033.mp4" → key
    var m = /v-([a-z0-9-]+)\.\w+$/.exec(src || '');
    return m ? key(m[1].replace(/-foto-[a-z0-9]+$/, '')) : '';
  }

  function linkSkeleton() {
    var todo = plan.tiles.filter(function (t) {
      return (t.images || []).some(function (im) { return im.src && !im.driveId; });
    });
    if (!todo.length) return Promise.resolve();
    // tools/link_cards.py found each card's twin in the library by comparing the pictures and wrote its
    // library path into the skeleton ("drive": "Kolye/4-5/<file>"). Saved plans made before that still
    // carry only the old path, so the hint is looked up in the skeleton by that path.
    var hints = {};
    ((window.SEED && SEED.tiles) || []).forEach(function (t) {
      (t.images || []).forEach(function (im) { if (im.src && im.drive) hints[im.src] = key(im.drive); });
    });
    return Drive.media(window.CONFIG.libraryFolderId).then(function (all) {
      var cards = {}, videos = {}, byPath = {};
      all.forEach(function (f) {
        byPath[key((f.path ? f.path + '/' : '') + f.name)] = f;
        var day = /^(\d{4}-\d{2}-\d{2}_\d{2})_/.exec(f.name);
        if (day && /^image\//.test(f.mime) && (!cards[day[1]] || /4-5/.test(f.name + f.path))) cards[day[1]] = f;
        if (/^video\//.test(f.mime)) videos[videoKey(f.name)] = f;
      });
      var linked = 0, missed = 0;
      todo.forEach(function (t) {
        if (t.kind === 'reel') {
          var v = videos[docVideoKey(t.video || (t.images[0] && t.images[0].src))];
          if (v) { t.images = [{ driveId: v.id, name: t.images[0].name || v.name, mime: v.mime }]; delete t.video; linked++; }
          else missed++;
          return;
        }
        t.images = t.images.map(function (im) {
          if (!im.src || im.driveId) return im;
          var m = /(\d{4}-\d{2}-\d{2}_\d{2})\.\w+$/.exec(im.src);
          var f = (hints[im.src] && byPath[hints[im.src]]) || (m && cards[m[1]]);
          if (!f) { missed++; return im; }
          linked++;
          return { driveId: f.id, name: im.name, mime: f.mime };
        });
      });
      if (linked && persist('Doc 2 görselleri Drive\'a bağlandı')) {
        render();
        toast('Doc 2 görselleri Drive\'a bağlandı: ' + linked + (missed ? ' · bulunamayan: ' + missed : ''), null, null, 5000);
      } else if (missed) {
        toast('Doc 2 görsellerinden ' + missed + ' tanesi Drive\'da bulunamadı.', null, null, 5000);
      }
    }, function (e) { toast('Doc 2 görselleri bağlanamadı: ' + e.message, null, null, 6000); });
  }

  // =====================================================================
  // 4.2 Phone: two modes. Görüntüle (always at start): a tap opens the tile, nothing can change.
  // Düzenle: "+" and "×" always visible, a tap on an empty tile opens the Kütüphane.
  // The computer has no modes: "+" and "×" show on hover, a click opens the tile.
  // =====================================================================
  var mode = 'view';
  function setMode(m, quiet) {
    if (m !== 'edit' && window.endPick) { endPick(); disarm(); }
    mode = m;
    document.body.classList.toggle('mode-edit', touch && m === 'edit');
    document.body.classList.toggle('mode-view', touch && m !== 'edit');
    var b = $('mode');
    b.setAttribute('aria-pressed', m === 'edit' ? 'true' : 'false');
    b.setAttribute('aria-label', m === 'edit' ? 'Düzenlemeyi bitir' : 'Düzenle');
    if (!quiet) toast(m === 'edit' ? 'Düzenleme açık.' : 'Görüntüleme: değişiklik yapılamaz.');
  }
  $('mode').addEventListener('click', function () { setMode(mode === 'edit' ? 'view' : 'edit'); });

  // No accidental taps while scrolling: a touch that moved, or that started while the page was
  // still moving, is not a tap.
  var gest = { x: 0, y: 0, moved: false, busy: false }, lastScroll = 0;
  window.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });
  $('feed').addEventListener('touchstart', function (e) {
    var p = e.touches[0];
    gest = { x: p.clientX, y: p.clientY, moved: false, busy: Date.now() - lastScroll < 150, held: false };
  }, { passive: true });
  $('feed').addEventListener('touchmove', function (e) {
    var p = e.touches[0];
    if (Math.abs(p.clientX - gest.x) > 10 || Math.abs(p.clientY - gest.y) > 10) gest.moved = true;
  }, { passive: true });
  function notATap() { return touch && (gest.moved || gest.busy || gest.held); }

  function libraryOpen() { return !$('lib').hidden; }

  function activate(node, e) {
    var empty = node.classList.contains('empty');
    if (!touch) {
      // 4.7 computer: a double-click opens the calendar (move to a day). A single click waits a
      // moment so the first click of a double-click doesn't open the large view first.
      clearTimeout(clickTimer);
      if (e && e.detail >= 2) { askMoveDate(node.dataset.id); return; }
      var id0 = node.dataset.id;
      clickTimer = setTimeout(function () {
        var n = document.querySelector('.tile[data-id="' + id0 + '"]');
        if (!n) return;
        empty ? (window.Library && Library.open(id0)) : open(n);
      }, 260);
      return;
    }
    if (mode === 'view') {
      if (!empty) open(node);
      else if (libraryOpen()) Library.open(node.dataset.id);      // the open Kütüphane is waiting for a target
      else toast('Doldurmak için Düzenle\'ye geç.');
      return;
    }
    // Düzenle (4.6): the first tap shows this tile's "+" and "×" (like hover on a computer);
    // a second tap on an empty tile opens the Kütüphane; a double tap on a full tile picks it up (4.4).
    var now = Date.now(), id = node.dataset.id;
    if (!empty && lastTap.id === id && now - lastTap.at < 400) { lastTap = { id: null, at: 0 }; disarm(); startPick(id); return; }
    lastTap = { id: id, at: now };
    if (!node.classList.contains('armed')) { disarm(); node.classList.add('armed'); return; }
    if (empty && window.Library) Library.open(id);
  }
  var lastTap = { id: null, at: 0 }, clickTimer = null;
  function disarm() { document.querySelectorAll('.tile.armed').forEach(function (n) { n.classList.remove('armed'); }); }
  // a tap outside the tiles hides the buttons again
  document.addEventListener('click', function (e) { if (!e.target.closest('.tile, .ask, .movebar, .toast')) disarm(); });

  $('feed').addEventListener('click', function (e) {
    if (notATap()) { e.stopPropagation(); return; }
    if (pick) {
      var to = e.target.closest('.tile[data-id], .addend');
      if (to && to.dataset.id !== pick) placeTap(to, e.clientX);
      return;
    }
    if (e.target.closest('.addend')) { askDate(null, 'r'); return; }
    var add = e.target.closest('.add');
    if (add) { e.stopPropagation(); askDate(add.closest('.tile').dataset.id, add.dataset.side); return; }
    var del = e.target.closest('.del');
    if (del) { e.stopPropagation(); removeTile(del.closest('.tile').dataset.id); return; }
    var node = e.target.closest('.tile');
    if (node) activate(node, e);
  });
  $('feed').addEventListener('keydown', function (e) {
    if (e.target.closest('.add, .del, .addend')) return;
    var node = e.target.closest('.tile');
    if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(node); }
  });

  // ---- drag from the library onto the grid (computer) ----
  var DT = 'application/x-vfp-items';
  function ours(e) { return Array.prototype.indexOf.call(e.dataTransfer.types, DT) >= 0; }
  function clearDrag() { document.querySelectorAll('.tile.over, .tile.refuse').forEach(function (n) { n.classList.remove('over', 'refuse'); }); }

  $('feed').addEventListener('dragover', function (e) {
    if (!ours(e)) return;
    var node = e.target.closest('.tile');
    clearDrag();
    if (!node) return;
    if (node.classList.contains('empty')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; node.classList.add('over'); }
    else { e.dataTransfer.dropEffect = 'none'; node.classList.add('refuse'); }
  });
  $('feed').addEventListener('dragleave', function (e) {
    var node = e.target.closest('.tile');
    if (node && !node.contains(e.relatedTarget)) node.classList.remove('over', 'refuse');
  });
  $('feed').addEventListener('drop', function (e) {
    if (!ours(e)) return;
    e.preventDefault();
    clearDrag();
    var node = e.target.closest('.tile');
    if (!node || !node.classList.contains('empty')) { toast('Bu kutu dolu.'); return; }
    var items = [];
    try { items = JSON.parse(e.dataTransfer.getData(DT)); } catch (err) { return; }
    if (fill(node.dataset.id, items) && window.Library) Library.clearSelection();
  });
  document.addEventListener('dragend', clearDrag);

  // =====================================================================
  // 4.3 / 4.4 Move a tile. It lands left or right of another tile (or at the end) and takes the
  // date of its new place: the tile just before it, or the tile after it when it lands first.
  // =====================================================================
  var MT = 'application/x-vfp-move';
  function moving(e) { return Array.prototype.indexOf.call(e.dataTransfer.types, MT) >= 0; }

  function placeDate(i) {
    for (var k = i - 1; k >= 0; k--) { var t = plan.tiles[k]; if (!t.archived && parse(t.date)) return t.date; }
    for (k = i + 1; k < plan.tiles.length; k++) { t = plan.tiles[k]; if (!t.archived && parse(t.date)) return t.date; }
    return '';
  }

  /** targetId = null → the end of the plan. side: 'l' | 'r'. */
  function moveTile(id, targetId, side) {
    if (id === targetId) return false;
    var from = indexOf(id);
    if (from < 0) return false;
    var t = plan.tiles[from], oldDate = t.date;
    plan.tiles.splice(from, 1);
    var at = targetId ? indexOf(targetId) + (side === 'l' ? 0 : 1) : plan.tiles.length;
    plan.tiles.splice(at, 0, t);
    t.date = placeDate(at) || t.date;
    if (at === from && t.date === oldDate) return false;     // same place, nothing to do
    if (!persist('Kutu taşındı')) { plan.tiles.splice(at, 1); plan.tiles.splice(from, 0, t); t.date = oldDate; return false; }
    render();
    flash(id);
    var d = parse(t.date);
    toast('Kutu taşındı' + (d && t.date !== oldDate ? ': ' + chip(d) : '') + '.', 'Geri al', function () {
      var i = indexOf(id);
      if (i < 0) return;
      plan.tiles.splice(i, 1);
      plan.tiles.splice(Math.min(from, plan.tiles.length), 0, t);
      t.date = oldDate;
      if (persist('Geri alındı')) { render(); flash(id); }
    }, 7000);
    return true;
  }

  // The line: on the left or right edge of the tile under the pointer, whichever half it is over.
  function clearLine() { document.querySelectorAll('.line-l, .line-r').forEach(function (n) { n.classList.remove('line-l', 'line-r'); }); }
  function lineAt(node, x) {
    clearLine();
    if (!node) return null;
    if (node.classList.contains('addend')) { node.classList.add('line-l'); return { id: null, side: 'r' }; }
    var b = node.getBoundingClientRect(), side = x < b.left + b.width / 2 ? 'l' : 'r';
    node.classList.add('line-' + side);
    return { id: node.dataset.id, side: side };
  }

  // ---- 4.4 phone (Düzenle): double tap a full tile → it lifts; tap where it should go → a line;
  //      "Buraya taşı" moves it, "Vazgeç" leaves everything as it was ----
  var pick = null, spot = null;
  function startPick(id) {
    pick = id; spot = null;
    document.body.classList.add('picking');
    showPick();
    $('mv-text').textContent = 'Nereye? Bir kutuya dokun.';
    $('mv-go').hidden = true;
    $('movebar').hidden = false;
  }
  function showPick() {              // also after a redraw
    var n = pick && document.querySelector('.tile[data-id="' + pick + '"]');
    if (n) n.classList.add('picked');
    if (spot) {
      var s = spot.id ? document.querySelector('.tile[data-id="' + spot.id + '"]') : document.querySelector('.addend');
      if (s) s.classList.add(spot.id ? 'line-' + spot.side : 'line-l');
    }
  }
  function endPick() {
    pick = null; spot = null;
    clearLine();
    document.body.classList.remove('picking');
    document.querySelectorAll('.picked').forEach(function (n) { n.classList.remove('picked'); });
    $('movebar').hidden = true;
  }
  window.endPick = endPick;
  function placeTap(node, x) {
    spot = lineAt(node, x);
    $('mv-text').textContent = spot.id ? (spot.side === 'l' ? 'Soluna: ' : 'Sağına: ') + tileLabel(spot.id) : 'En sona';
    $('mv-go').hidden = false;
  }
  $('mv-go').addEventListener('click', function () {
    if (!pick || !spot) return;
    var id = pick, s = spot;
    endPick();
    moveTile(id, s.id, s.side);
  });
  $('mv-cancel').addEventListener('click', endPick);

  // ---- 4.5 phone (Düzenle): hold a tile ~half a second → a calendar; the tile moves to that day
  //      (after that day's other tiles) and takes its date ----
  var hold = null, HOLD_MS = 500;
  function cancelHold() {
    if (!hold) return;
    clearTimeout(hold.timer); clearTimeout(hold.pressTimer);
    hold.node.classList.remove('holding');
    hold = null;
  }
  $('feed').addEventListener('touchstart', function (e) {
    cancelHold();
    if (!touch || mode !== 'edit' || pick || e.touches.length > 1 || gest.busy) return;
    if (e.target.closest('.add, .del')) return;
    var node = e.target.closest('.tile[data-id]');
    if (!node) return;
    hold = { node: node, id: node.dataset.id };
    hold.pressTimer = setTimeout(function () { if (hold) hold.node.classList.add('holding'); }, 150);
    hold.timer = setTimeout(function () {
      if (!hold || gest.moved) { cancelHold(); return; }
      var id = hold.id;
      gest.held = true;                  // the click that follows is not a tap
      cancelHold();
      if (navigator.vibrate) navigator.vibrate(15);
      askMoveDate(id);
    }, HOLD_MS);
  }, { passive: true });
  $('feed').addEventListener('touchmove', function () { if (hold && gest.moved) cancelHold(); }, { passive: true });
  $('feed').addEventListener('touchend', function () {
    if (hold) cancelHold();
    // the finger that held is lifting now: the tap the phone makes from it must not reach the calendar
    if (liftGuard) { liftGuard = false; swallowUntil = Date.now() + 300; }
  }, { passive: true });
  var liftGuard = false, swallowUntil = 0;
  document.addEventListener('click', function (e) {
    if (Date.now() < swallowUntil && e.target.closest && e.target.closest('#movedate')) { swallowUntil = 0; e.stopPropagation(); e.preventDefault(); }
  }, true);
  $('feed').addEventListener('touchcancel', cancelHold, { passive: true });
  $('feed').addEventListener('contextmenu', function (e) { if (touch && e.target.closest('.tile')) e.preventDefault(); });

  var dateFor = null;
  function askMoveDate(id) {
    var t = findTile(id);
    if (!t) return;
    dateFor = id;
    $('md-title').textContent = 'Hangi güne taşınsın?';
    $('md-from').textContent = (t.title ? t.title + ' · ' : '') + (parse(t.date) ? 'şimdi ' + chip(parse(t.date)) : 'tarihsiz');
    $('md-date').value = t.date || iso(new Date());
    liftGuard = true;
    $('movedate').hidden = false;
    $('md-date').focus();
  }
  function closeMoveDate() { $('movedate').hidden = true; dateFor = null; }
  $('md-cancel').addEventListener('click', closeMoveDate);
  $('movedate').addEventListener('click', function (e) { if (e.target === $('movedate')) closeMoveDate(); });
  $('md-go').addEventListener('click', function () {
    var v = $('md-date').value, id = dateFor;
    if (!parse(v)) { $('md-date').focus(); return; }
    closeMoveDate();
    moveToDate(id, v);
  });

  function moveToDate(id, date) {
    var from = indexOf(id);
    if (from < 0) return false;
    var t = plan.tiles[from], oldDate = t.date;
    plan.tiles.splice(from, 1);
    // after the last shown tile on or before that day; else before the first shown tile
    var at = -1;
    for (var k = 0; k < plan.tiles.length; k++) {
      var o = plan.tiles[k];
      if (!o.archived && o.date && o.date <= date) at = k + 1;
    }
    if (at < 0) { at = 0; for (k = 0; k < plan.tiles.length; k++) if (!plan.tiles[k].archived) { at = k; break; } }
    plan.tiles.splice(at, 0, t);
    t.date = date;
    if (at === from && date === oldDate) return false;
    if (!persist('Kutu taşındı')) { plan.tiles.splice(at, 1); plan.tiles.splice(from, 0, t); t.date = oldDate; return false; }
    render();
    flash(id);
    toast('Kutu taşındı: ' + chip(parse(date)) + '.', 'Geri al', function () {
      var i = indexOf(id);
      if (i < 0) return;
      plan.tiles.splice(i, 1);
      plan.tiles.splice(Math.min(from, plan.tiles.length), 0, t);
      t.date = oldDate;
      if (persist('Geri alındı')) { render(); flash(id); }
    }, 7000);
    return true;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('movedate').hidden) closeMoveDate(); });

  var dragId = null;
  $('feed').addEventListener('dragstart', function (e) {
    var node = e.target.closest && e.target.closest('.tile[data-id]');
    if (!node || touch) return;
    dragId = node.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(MT, dragId);
    setTimeout(function () { node.classList.add('lifted'); }, 0);
  });
  $('feed').addEventListener('dragover', function (e) {
    if (!moving(e)) return;
    var node = e.target.closest('.tile[data-id], .addend');
    if (!node || node.dataset.id === dragId) { clearLine(); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    lineAt(node, e.clientX);
  });
  $('feed').addEventListener('drop', function (e) {
    if (!moving(e)) return;
    e.preventDefault();
    e.stopPropagation();
    var node = e.target.closest('.tile[data-id], .addend'), id = e.dataTransfer.getData(MT);
    var spot = node && node.dataset.id !== id ? lineAt(node, e.clientX) : null;
    clearLine();
    if (spot) moveTile(id, spot.id, spot.side);
  });
  document.addEventListener('dragend', function () {
    clearLine();
    document.querySelectorAll('.lifted').forEach(function (n) { n.classList.remove('lifted'); });
    dragId = null;
  });
  // Files dragged in from the computer are not used (media comes from Drive): don't let the browser open them.
  document.addEventListener('dragover', function (e) { if (!ours(e)) e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    if (ours(e)) return;
    e.preventDefault();
    if (moving(e)) return;            // a tile dropped outside the grid: it stays where it was
    toast('Önce dosyayı Drive klasörüne ekle, sonra Kütüphane\'den seç.');
  });

  // ---- for the Yedek panel (js/backup.js) ----
  function kindName(t) { return isBlank(t) ? 'Boş' : t.kind === 'carousel' ? 'Carousel' : t.kind === 'reel' ? 'Reel' : 'Gönderi'; }
  function thumb(t) {
    var b = el('span', 'bthumb');
    var im = (t.images || [])[0];
    if (im) b.appendChild(pic(im, 600, ''));
    return b;
  }
  function replace(p, reason) {
    persist('Önceki hali');          // the current plan stays in Geçmiş (skipped when already saved)
    // A restored plan is used exactly as it was: mark it current so the one-time tidy-up (2.4) never runs on it.
    if ((p.version || 1) < Store.VERSION) p.version = Store.VERSION;
    plan = p;
    if (!persist(reason)) return false;
    render();
    return true;
  }

  window.Planner = {
    fill: fill, tileLabel: tileLabel, DT: DT, toast: toast,
    isEmpty: function (id) { var t = findTile(id); return !!t && isBlank(t); },
    plan: function () { return plan; },
    replace: replace,
    archived: function () {
      return plan.tiles.filter(function (t) { return t.archived; })
        .sort(function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; });
    },
    unarchive: function (id) { unarchive(id); },
    forget: forget,
    thumb: thumb,
    kindName: kindName,
    dayName: function (s) { var d = parse(s); return d ? GUNL[d.getDay()] : ''; },
    weekName: function (id) { var w = weeks().byTile[id]; return w ? 'H' + w.n : ''; },
    shortDate: function (x) { var d = typeof x === 'string' ? parse(x) : x; return d ? d.getDate() + ' ' + AYK[d.getMonth() + 1] : ''; }
  };

  // First open after the update (2.4): keep the old state as a version, then save the tidied plan.
  if (Store.upgradedFrom && window.Backup) {
    try { Backup.snapshot(JSON.parse(Store.upgradedFrom), 'Güncellemeden önce'); } catch (e) { /* ignore */ }
    persist('Başlangıç 12 Kasım; boş son kutu silindi');
  } else if (window.Backup) {
    Backup.snapshot(plan, 'Açılış');
  }

  setMode('view', true);
  render();
})();
