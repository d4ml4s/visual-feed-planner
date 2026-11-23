/* Feature 5: the plan saved in Drive, in the signed-in account's My Drive:
 *   "Visual Feed Planner" / plan.json   (created by this app; the app can see and change only its own files)
 * The browser copy (localStorage) stays the working copy; Drive is the shared copy for every device.
 * What this browser knows about the Drive copy is kept in localStorage "vfp.sync":
 *   { fileId, sig (Drive's content fingerprint at the last sync), base (fingerprint of the plan text last
 *     synced, made here), dirty (changes not in Drive yet), savedAt }
 * 5.6: Drive's "version" number also goes up on invisible server-side changes, so it is NOT used to decide
 * whether another device saved: the content fingerprint (md5Checksum) and the last synced text are.
 */
(function () {
  'use strict';
  if (!window.Drive || !window.Planner) return;

  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'vfp.sync';
  var st = {};
  try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { st = {}; }
  function keep() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ } }

  var device = matchMedia('(hover: none)').matches ? 'telefon' : 'bilgisayar';
  function props() { return { device: device, savedAt: new Date().toISOString() }; }
  function text() { return JSON.stringify(Planner.plan()); }
  // Drive's fingerprint of the file content; older fallbacks only if Google gives none.
  function sig(meta) { return meta.md5Checksum || meta.headRevisionId || ('v' + meta.version); }
  // Our own fingerprint of a plan text (to recognise "Drive still holds exactly what we last synced").
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + s.length; }
  if (st.version && !st.sig && !st.base) st.synced = true;      // synced before 5.6 (old version number only)

  function hm(isoTime) {
    var d = isoTime ? new Date(isoTime) : new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // ---- the small note next to the buttons ----
  var chip = $('sync'), chipAction = null;
  function show(msg, kind, action) {
    chip.textContent = msg;
    chip.hidden = !msg;
    chip.className = 'sync' + (kind ? ' ' + kind : '') + (action ? ' act' : '');
    chip.disabled = !action;
    chipAction = action || null;
  }
  chip.addEventListener('click', function () { if (chipAction) chipAction(); });
  function saved(meta) {
    st.savedAt = meta && meta.modifiedTime || new Date().toISOString();
    keep();
    show('Drive\'a kaydedildi ' + hm(st.savedAt));
  }

  // ---- 5.1 on sign-in: find the plan file, or create it with this browser's plan ----
  function start() {
    if (!Drive.canWrite()) { show('Plan kaydı için Drive izni gerekli', 'bad'); return Promise.resolve(); }
    show('Drive kontrol ediliyor…');
    return Drive.findPlan().then(function (found) {
      if (found.file) {
        st.fileId = found.file.id;
        keep();
        return compare(found.file);
      }
      if (!Planner.plan().tiles.length) { show('Bu hesapta plan yok', 'bad'); return; }
      show('Kaydediliyor…');
      var body0 = text();
      return Drive.createPlan(body0, props()).then(function (meta) {
        st = { fileId: meta.id, sig: sig(meta), base: hash(body0), dirty: false };
        keep();
        saved(meta);
        Planner.toast('Plan Drive\'a kaydedildi: Visual Feed Planner / plan.json', null, null, 5000);
      });
    }).catch(problem);
  }
  document.addEventListener('drive:signedin', start);

  // ---- 5.2 load: Drive has a newer plan (saved on another device) → take it ----
  var applying = false;          // true while a plan from Drive is put in place (that is not a new change)
  // upload: what to do when Drive still holds what we last synced but we have unsaved changes
  // (inside a save that is the upload itself; elsewhere a normal save)
  function compare(meta, upload) {
    var send = upload || function () { return window.Sync.push(); };
    if (st.sig && sig(meta) === st.sig) {
      if (st.dirty) return send();
      saved(meta);
      return Promise.resolve();
    }
    return Drive.readPlan(meta.id).then(function (body) {
      var p = JSON.parse(body);
      if (!Store.valid(p)) throw new Error("Drive'daki plan okunamadı.");
      if (body === text()) { st.sig = sig(meta); st.base = hash(body); st.dirty = false; delete st.synced; keep(); saved(meta); return; }
      // Drive's content is exactly what we last synced: nobody else saved (only the fingerprint moved)
      if (st.base && hash(body) === st.base) {
        st.sig = sig(meta); keep();
        if (st.dirty) return send();
        saved(meta);
        return;
      }
      var synced = st.sig || st.base || st.synced;
      var fresh = !synced && !Planner.plan().tiles.length;         // this browser has nothing yet
      if (!st.dirty && (synced || fresh)) return take(p, meta, body);
      return conflict(p, meta, body);
    });
  }
  function from(meta) {
    var dev = meta.appProperties && meta.appProperties.device;
    return (dev ? dev + ', ' : '') + hm(meta.modifiedTime);
  }
  function take(p, meta, body) {
    applying = true;
    try { Planner.replace(p, "Drive'dan alındı (" + from(meta) + ')'); } finally { applying = false; }
    st.sig = sig(meta); st.base = hash(body); st.dirty = false; st.savedAt = meta.modifiedTime; delete st.synced;
    keep();
    show("Drive'dan alındı " + hm(meta.modifiedTime));
  }
  // ---- 5.4 both sides changed: ask which plan stays; the other one is kept in Geçmiş ----
  function count(pl) { return pl.tiles.filter(function (t) { return !t.archived; }).length + ' kutu'; }
  function conflict(p, meta, body) {
    var box = $('conflict');
    if (!box.hidden) return Promise.resolve();          // already asking
    show('Plan iki yerde değişti', 'bad');
    $('cf-drive').querySelector('span').textContent = from(meta) + ' · ' + count(p);
    $('cf-local').querySelector('span').textContent = device + ' · ' + count(Planner.plan());
    box.hidden = false;
    $('cf-drive').focus();
    return new Promise(function (done) {
      $('cf-drive').onclick = function () {
        box.hidden = true;
        Backup.snapshot(Planner.plan(), 'Bu cihazdaki (çakışmada bırakıldı)', true);
        take(p, meta, body);
        done();
      };
      $('cf-local').onclick = function () {
        box.hidden = true;
        Backup.snapshot(p, "Drive'daki (çakışmada bırakıldı, " + from(meta) + ')');
        Backup.snapshot(Planner.plan(), 'Bu cihazdaki seçildi', true);
        st.sig = sig(meta); st.base = hash(body);     // we have seen Drive's copy: now ours replaces it
        st.dirty = true;
        keep();
        show('Kaydediliyor…');
        done();
        setTimeout(push, 0);
      };
    });
  }

  // Coming back to the tab (e.g. after planning on the phone): look for a newer plan.
  var checking = null;
  function check() {
    if (checking || !Drive.canWrite() || !st.fileId) return;
    checking = Drive.planMeta(st.fileId).then(compare).catch(problem)
      .then(function () { checking = null; });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });

  // ---- 5.3 save automatically: every change goes to Drive ~2 s later (quick changes go together) ----
  var timer = null, busy = null, again = false;
  function changed() {
    if (applying) return;                      // a plan that came from Drive is not a new change
    st.dirty = true;
    keep();
    if (!st.fileId && !Drive.canWrite()) return; // not connected to a Drive plan (yet)
    if (!Drive.canWrite()) { needAuth(); return; } // the sign-in ran out: kept here, sent after "tekrar bağlan"
    show('Kaydediliyor…');
    clearTimeout(timer);
    timer = setTimeout(push, 2000);
  }
  function push() {
    clearTimeout(timer);
    if (busy) { again = true; return busy; }
    if (!st.dirty) return Promise.resolve();
    if (!Drive.canWrite()) return Promise.resolve();
    if (!st.fileId) return start();
    var body = text(), wrote = false;
    function upload() {
      return Drive.updatePlan(st.fileId, body, props()).then(function (m) {
        st.sig = sig(m); st.base = hash(body); delete st.synced;
        if (text() === body) st.dirty = false;  // changes made while saving go in the next round
        keep();
        saved(m);
        wrote = true;
      });
    }
    busy = Drive.planMeta(st.fileId).then(function (meta) {
      // the content in Drive changed since our last sync → maybe another device saved: compare decides
      if (st.sig && sig(meta) !== st.sig) return compare(meta, upload);
      return upload();
    }).catch(problem)
      .then(function () {
        busy = null;
        // new changes arrived while saving → one more round (a failed save is not retried in a loop)
        var more = again || (wrote && st.dirty);
        again = false;
        if (more && st.dirty) timer = setTimeout(push, 2000);
      });
    return busy;
  }

  // ---- 5.5 sign-in ran out / no internet: everything stays in this browser and goes up later ----
  function problem(e) {
    if ((e && e.status === 401) || !Drive.isSignedIn()) return needAuth();
    if (e && e.status === 404 && st.fileId) {       // the plan file was deleted in Drive: make it again
      st.fileId = null; st.sig = null; st.base = null; keep();
      return start();
    }
    if (!navigator.onLine || e instanceof TypeError) { show('Bağlantı yok, sonra kaydedilecek', 'warn'); return; }
    show('Drive: ' + e.message, 'bad', function () { push(); });
  }
  function needAuth() { show("Drive'a tekrar bağlan", 'bad', reconnect); }
  function reconnect() {
    // a click → Google's window may open; after it, "drive:signedin" runs start() and sends what waits
    Drive.signIn().catch(function (e) { show(e.message, 'bad', reconnect); });
  }
  window.addEventListener('online', function () { if (st.dirty && Drive.canWrite()) push(); });

  // ---- Yedek panel: which account and file, last save ----
  function drawInfo() {
    var box = $('bk-drive');
    if (!box) return;
    box.textContent = '';
    var line = function (t) { var p = document.createElement('p'); p.className = 'bnote'; p.textContent = t; box.appendChild(p); return p; };
    if (!st.fileId) { line("Drive'a bağlanınca plan 'Visual Feed Planner / plan.json' dosyasına kaydedilir."); return; }
    var who = line('Hesap: …');                    // filled in when Google answers
    Drive.account().then(function (u) {
      who.textContent = u ? 'Hesap: ' + (u.displayName ? u.displayName + ' · ' : '') + u.emailAddress : '';
    });
    line('Dosya: Visual Feed Planner / plan.json' + (st.savedAt ? ' · son kayıt ' + hm(st.savedAt) : '') + (st.dirty ? ' · kaydedilmemiş değişiklik var' : ''));
    var a = document.createElement('a');
    a.href = 'https://drive.google.com/file/d/' + st.fileId + '/view';
    a.target = '_blank'; a.rel = 'noopener';
    a.className = 'blink';
    a.textContent = "Drive'da aç";
    box.appendChild(a);
  }
  var bkOpen = $('bk-open');
  if (bkOpen) bkOpen.addEventListener('click', drawInfo);

  window.Sync = { state: function () { return JSON.parse(JSON.stringify(st)); }, check: check, changed: changed, push: push };
})();
