/* Visual Feed Planner: renders the plan as the Doc 2 grid; F1 adds tiles and fills them from Drive.
 * Tile model: { id, kind: 'carousel'|'post'|'reel'|'empty', date: 'YYYY-MM-DD'|'', title,
 *               images: [{src, name} | {driveId, name, mime}], video?, match?: 'same'|'similar', style?, label?, note }
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
    tile.setAttribute('role', 'button');
    tile.tabIndex = 0;
    tile.appendChild(delBtn(tile.classList.contains('empty')));
    tile.appendChild(addBtn('l', 'Soluna boş kutu ekle'));
    tile.appendChild(addBtn('r', 'Sağına boş kutu ekle'));
    if (tile.classList.contains('empty')) {
      tile.setAttribute('aria-label', 'Boş kutu' + (d ? ' ' + chip(d) : '') + ': doldur');
    } else {
      tile.draggable = false;
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
      var cap = el('div', 'vcount', (t.images[0].name || '') + (t.match === 'same' ? ' · aynı ürün' : t.match === 'similar' ? ' · benzer ürün' : ''));
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

  // ---- clicks and keys on the grid ----
  function disarm(except) {
    document.querySelectorAll('.tile.armed').forEach(function (n) { if (n !== except) n.classList.remove('armed'); });
  }

  function activate(node) {
    // Phone: the first tap shows the buttons (+ and ×), the second tap opens the tile.
    if (touch && !node.classList.contains('armed')) { disarm(node); node.classList.add('armed'); return; }
    if (node.classList.contains('empty')) {
      if (window.Library) Library.open(node.dataset.id);
      return;
    }
    open(node);
  }

  $('feed').addEventListener('click', function (e) {
    if (e.target.closest('.addend')) { askDate(null, 'r'); return; }
    var add = e.target.closest('.add');
    if (add) { e.stopPropagation(); askDate(add.closest('.tile').dataset.id, add.dataset.side); return; }
    var del = e.target.closest('.del');
    if (del) { e.stopPropagation(); removeTile(del.closest('.tile').dataset.id); return; }
    var node = e.target.closest('.tile');
    if (node) activate(node);
  });
  $('feed').addEventListener('keydown', function (e) {
    if (e.target.closest('.add, .del, .addend')) return;
    var node = e.target.closest('.tile');
    if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); disarm(); node.classList.add('armed'); open(node); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.tile')) disarm(); });

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
  // Files dragged in from the computer are not used (media comes from Drive): don't let the browser open them.
  document.addEventListener('dragover', function (e) { if (!ours(e)) e.preventDefault(); });
  document.addEventListener('drop', function (e) { if (!ours(e)) { e.preventDefault(); toast('Önce dosyayı Drive klasörüne ekle, sonra Kütüphane\'den seç.'); } });

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

  render();
})();
