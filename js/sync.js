/* Feature 5: the plan saved in Drive, in the signed-in account's My Drive:
 *   "Visual Feed Planner" / plan.json   (created by this app; the app can see and change only its own files)
 * The browser copy (localStorage) stays the working copy; Drive is the shared copy for every device.
 * What this browser knows about the Drive copy is kept in localStorage "vfp.sync":
 *   { fileId, version (Drive's version number at the last sync), dirty (changes not in Drive yet) }
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
      return Drive.createPlan(text(), props()).then(function (meta) {
        st = { fileId: meta.id, version: meta.version, dirty: false };
        keep();
        saved(meta);
        Planner.toast('Plan Drive\'a kaydedildi: Visual Feed Planner / plan.json', null, null, 5000);
      });
    }).catch(function (e) { show('Drive: ' + e.message, 'bad'); });
  }
  document.addEventListener('drive:signedin', start);

  // ---- 5.2 load: Drive has a newer plan (saved on another device) → take it ----
  var applying = false;          // true while a plan from Drive is put in place (that is not a new change)
  function compare(meta) {
    if (st.version && String(meta.version) === String(st.version)) {
      if (st.dirty && window.Sync.push) return Sync.push();
      saved(meta);
      return Promise.resolve();
    }
    return Drive.readPlan(meta.id).then(function (body) {
      var p = JSON.parse(body);
      if (!Store.valid(p)) throw new Error("Drive'daki plan okunamadı.");
      if (body === text()) { st.version = meta.version; st.dirty = false; keep(); saved(meta); return; }
      var fresh = !st.version && !Planner.plan().tiles.length;     // this browser has nothing yet
      if (!st.dirty && (st.version || fresh)) return take(p, meta);
      return conflict(p, meta);
    });
  }
  function from(meta) {
    var dev = meta.appProperties && meta.appProperties.device;
    return (dev ? dev + ', ' : '') + hm(meta.modifiedTime);
  }
  function take(p, meta) {
    applying = true;
    try { Planner.replace(p, "Drive'dan alındı (" + from(meta) + ')'); } finally { applying = false; }
    st.version = meta.version; st.dirty = false; st.savedAt = meta.modifiedTime;
    keep();
    show("Drive'dan alındı " + hm(meta.modifiedTime));
  }
  // ---- 5.4 both sides changed: ask which plan stays; the other one is kept in Geçmiş ----
  function count(pl) { return pl.tiles.filter(function (t) { return !t.archived; }).length + ' kutu'; }
  function conflict(p, meta) {
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
        take(p, meta);
        done();
      };
      $('cf-local').onclick = function () {
        box.hidden = true;
        Backup.snapshot(p, "Drive'daki (çakışmada bırakıldı, " + from(meta) + ')');
        Backup.snapshot(Planner.plan(), 'Bu cihazdaki seçildi', true);
        st.version = meta.version;                    // we have seen Drive's copy: now ours replaces it
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
    checking = Drive.planMeta(st.fileId).then(compare).catch(function (e) { show('Drive: ' + e.message, 'bad'); })
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
    busy = Drive.planMeta(st.fileId).then(function (meta) {
      // someone else saved since our last sync → don't overwrite (5.4 decides)
      if (st.version && String(meta.version) !== String(st.version)) return compare(meta);
      return Drive.updatePlan(st.fileId, body, props()).then(function (m) {
        st.version = m.version;
        if (text() === body) st.dirty = false;  // changes made while saving go in the next round
        keep();
        saved(m);
        wrote = true;
      });
    }).catch(function (e) { show('Drive: ' + e.message, 'bad'); })
      .then(function () {
        busy = null;
        // new changes arrived while saving → one more round (a failed save is not retried in a loop)
        var more = again || (wrote && st.dirty);
        again = false;
        if (more && st.dirty) timer = setTimeout(push, 2000);
      });
    return busy;
  }

  window.Sync = { state: function () { return JSON.parse(JSON.stringify(st)); }, check: check, changed: changed, push: push };
})();
