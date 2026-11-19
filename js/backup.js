/* Feature 2: safety blanket.
 * - Versions: every saved change is kept in the browser's IndexedDB ("vfp-versions"):
 *   the last 30, plus the newest one of each day for 30 days. "Geri yükle" brings one back.
 * - Excel: "Excel'e aktar" writes a readable "Plan" sheet + a hidden "Yedek" sheet holding the exact plan;
 *   "Excel'den yükle" restores from that hidden copy. The Excel library (SheetJS) loads only when needed.
 * - Archive: lists archived tiles with "Geri getir" and "Sil".
 * The panel talks to the grid through window.Planner (js/app.js).
 */
(function () {
  'use strict';

  var KEEP = 30, DAYS = 30, DAY = 864e5;
  var XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var XLSX_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  var MARK = 'VFP-PLAN', CHUNK = 30000;   // an Excel cell holds at most 32,767 characters

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------------- versions (IndexedDB) ----------------
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (ok, bad) {
      if (!window.indexedDB) return bad(new Error('IndexedDB yok'));
      var r = indexedDB.open('vfp-versions', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('versions', { keyPath: 'at' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { bad(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, bad) {
        var t = d.transaction('versions', mode), s = t.objectStore('versions'), out = fn(s);
        t.oncomplete = function () { ok(out && 'result' in out ? out.result : undefined); };
        t.onerror = function () { bad(t.error); };
      });
    });
  }
  function all() {
    return tx('readonly', function (s) { return s.getAll(); }).then(function (list) {
      return (list || []).sort(function (a, b) { return b.at - a.at; });
    });
  }

  // Keep the newest 30; of older ones keep the newest per day, for 30 days.
  function prune() {
    return all().then(function (list) {
      var now = Date.now(), days = {}, drop = [];
      list.forEach(function (v, i) {
        var day = new Date(v.at).toDateString();
        var keep = i < KEEP || (now - v.at < DAYS * DAY && !days[day]);
        days[day] = true;
        if (!keep) drop.push(v.at);
      });
      if (drop.length) return tx('readwrite', function (s) { drop.forEach(function (k) { s.delete(k); }); });
    });
  }

  var last = null, queue = Promise.resolve();
  function counts(plan) {
    var shown = 0, arch = 0;
    plan.tiles.forEach(function (t) { if (t.archived) arch++; else shown++; });
    return { shown: shown, arch: arch };
  }

  /** Saves the plan as a version (skipped when nothing changed since the last one). */
  function snapshot(plan, reason) {
    var json = JSON.stringify(plan), c = counts(plan);
    queue = queue.then(function () {
      if (last === null) return all().then(function (l) { last = l[0] ? l[0].plan : ''; });
    }).then(function () {
      if (json === last) return;
      var at = Date.now();
      return tx('readwrite', function (s) { s.put({ at: at, reason: reason || 'Değişiklik', tiles: c.shown, archived: c.arch, plan: json }); })
        .then(function () { last = json; return prune(); });
    }).then(function () { if (!panel.hidden) drawHistory(); }, function () { /* versions off in this browser */ });
    return queue;
  }

  // ---------------- panel ----------------
  var panel = $('bk');

  function openPanel() {
    panel.hidden = false;
    document.body.style.overflow = 'hidden';
    drawArchive();
    drawHistory();
    $('bk-close').focus();
  }
  function closePanel() {
    panel.hidden = true;
    document.body.style.overflow = '';
    $('bk-confirm').hidden = true;
    pendingImport = null;
  }
  $('bk-open').addEventListener('click', openPanel);
  $('bk-close').addEventListener('click', closePanel);
  panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closePanel(); });

  function when(at) {
    var d = new Date(at), now = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Bugün ' + hm;
    if (d.toDateString() === y.toDateString()) return 'Dün ' + hm;
    return Planner.shortDate(d) + ' ' + hm;
  }

  function drawHistory() {
    var box = $('bk-history');
    all().then(function (list) {
      box.textContent = '';
      if (!list.length) { box.appendChild(el('p', 'bnote', 'Henüz kayıt yok. Her değişiklik burada saklanır.')); return; }
      list.forEach(function (v, i) {
        var row = el('div', 'brow');
        var txt = el('div', 'btxt');
        txt.appendChild(el('b', null, when(v.at)));
        txt.appendChild(el('span', null, v.reason + ' · ' + v.tiles + ' kutu' + (v.archived ? ' · arşiv ' + v.archived : '')));
        row.appendChild(txt);
        if (i === 0) row.appendChild(el('span', 'bnow', 'Şimdiki'));
        else {
          var b = el('button', 'bbtn', 'Geri yükle');
          b.type = 'button';
          b.addEventListener('click', function () { restoreVersion(v); });
          row.appendChild(b);
        }
        box.appendChild(row);
      });
    }, function () {
      box.textContent = '';
      box.appendChild(el('p', 'bnote bad', 'Bu tarayıcıda geçmiş saklanamıyor. Excel yedeği kullan.'));
    });
  }

  function restoreVersion(v) {
    var p;
    try { p = JSON.parse(v.plan); } catch (e) { return; }
    if (!Store.valid(p)) return;
    var prev = JSON.parse(JSON.stringify(Planner.plan()));
    if (!Planner.replace(p, 'Geri yüklendi (' + when(v.at) + ')')) return;
    drawArchive();
    Planner.toast('Plan geri yüklendi: ' + when(v.at) + '.', 'Geri al', function () {
      Planner.replace(prev, 'Geri alındı');
      drawArchive();
    }, 7000);
  }

  // ---- archive list ----
  function drawArchive() {
    var box = $('bk-archive'), list = Planner.archived();
    $('bk-acount').textContent = list.length ? '(' + list.length + ')' : '';
    box.textContent = '';
    if (!list.length) { box.appendChild(el('p', 'bnote', 'Arşiv boş. Silinen dolu kutular buraya gelir.')); return; }
    list.forEach(function (t) {
      var row = el('div', 'brow');
      row.appendChild(Planner.thumb(t));
      var txt = el('div', 'btxt');
      txt.appendChild(el('b', null, Planner.tileLabel(t.id) + ' · ' + Planner.kindName(t)));
      txt.appendChild(el('span', null, t.title || (t.images || []).map(function (im) { return im.name; }).filter(Boolean).join(', ') || '—'));
      row.appendChild(txt);
      var back = el('button', 'bbtn', 'Geri getir');
      back.type = 'button';
      back.addEventListener('click', function () { Planner.unarchive(t.id); drawArchive(); });
      var del = el('button', 'bbtn ghost', 'Sil');
      del.type = 'button';
      del.setAttribute('aria-label', 'Arşivden tamamen sil');
      del.addEventListener('click', function () { Planner.forget(t.id); drawArchive(); });
      row.appendChild(back);
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  // ---------------- Excel ----------------
  var xlsxp = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxp) xlsxp = new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = XLSX_URL;
      s.integrity = XLSX_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = function () { window.XLSX ? ok(window.XLSX) : bad(new Error('Excel aracı yüklenemedi')); };
      s.onerror = function () { xlsxp = null; bad(new Error('Excel aracı yüklenemedi (internet?)')); };
      document.head.appendChild(s);
    });
    return xlsxp;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function exportExcel() {
    var btn = $('bk-export');
    btn.disabled = true;
    loadXLSX().then(function (X) {
      var plan = Planner.plan();
      var rows = [['Sıra', 'Tarih', 'Gün', 'Hafta', 'Tür', 'Başlık', 'Dosyalar', 'Durum']];
      var n = 0;
      plan.tiles.forEach(function (t) {
        rows.push([t.archived ? '' : ++n, t.date || '', Planner.dayName(t.date), Planner.weekName(t.id), Planner.kindName(t),
          t.title || t.label || '', (t.images || []).map(function (im) { return im.name || ''; }).join(' | '), t.archived ? 'Arşiv' : '']);
      });
      var ws = X.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 5 }, { wch: 11 }, { wch: 10 }, { wch: 7 }, { wch: 9 }, { wch: 40 }, { wch: 60 }, { wch: 7 }];
      ws['!autofilter'] = { ref: 'A1:H' + rows.length };

      var json = JSON.stringify(plan), copy = [[MARK, 1, new Date().toISOString(), 'Bu sayfayı değiştirme: planın tam kopyası.']];
      for (var i = 0; i < json.length; i += CHUNK) copy.push([json.slice(i, i + CHUNK)]);
      var wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, ws, 'Plan');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(copy), 'Yedek');
      wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
      X.writeFile(wb, 'feed-plan-' + today() + '.xlsx', { compression: true });
      Planner.toast('Excel indirildi.');
    }).catch(function (e) { Planner.toast(e.message, null, null, 5000); })
      .then(function () { btn.disabled = false; });
  }

  // Import: read the hidden copy, show what's in it, replace only after "Yükle".
  var pendingImport = null;
  function readExcel(file) {
    loadXLSX().then(function (X) {
      return file.arrayBuffer().then(function (buf) {
        var wb = X.read(buf, { type: 'array' });
        var ws = wb.Sheets.Yedek;
        if (!ws) throw new Error('Bu dosyada yedek yok. Yalnızca bu uygulamanın Excel\'i yüklenebilir.');
        var rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        if (!rows.length || rows[0][0] !== MARK) throw new Error('Bu dosyada yedek yok. Yalnızca bu uygulamanın Excel\'i yüklenebilir.');
        var p = JSON.parse(rows.slice(1).map(function (r) { return String(r[0] || ''); }).join(''));
        if (!Store.valid(p)) throw new Error('Yedek okunamadı.');
        return p;
      });
    }).then(function (p) {
      pendingImport = p;
      var c = counts(p), dates = p.tiles.filter(function (t) { return t.date && !t.archived; }).map(function (t) { return t.date; }).sort();
      var range = dates.length ? Planner.shortDate(dates[0]) + ' – ' + Planner.shortDate(dates[dates.length - 1]) : '';
      $('bk-ctext').textContent = file.name + ': ' + c.shown + ' kutu' + (range ? ' (' + range + ')' : '') +
        (c.arch ? ', arşivde ' + c.arch : '') + '. Şimdiki planın yerine geçsin mi? Şimdiki hali Geçmiş\'e kaydedilir.';
      $('bk-confirm').hidden = false;
      $('bk-yes').focus();
    }).catch(function (e) {
      Planner.toast(e instanceof SyntaxError ? 'Yedek okunamadı.' : e.message, null, null, 6000);
    });
  }

  $('bk-export').addEventListener('click', exportExcel);
  $('bk-import').addEventListener('click', function () { $('bk-file').click(); });
  $('bk-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (f) readExcel(f);
  });
  $('bk-yes').addEventListener('click', function () {
    if (!pendingImport) return;
    Planner.replace(pendingImport, 'Excel\'den yüklendi');
    pendingImport = null;
    $('bk-confirm').hidden = true;
    drawArchive();
    Planner.toast('Plan Excel\'den yüklendi.', null, null, 4000);
  });
  $('bk-no').addEventListener('click', function () { pendingImport = null; $('bk-confirm').hidden = true; });

  window.Backup = { snapshot: snapshot, versions: all, refresh: function () { if (!panel.hidden) { drawArchive(); drawHistory(); } } };
})();
