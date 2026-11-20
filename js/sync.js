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
  // Both sides changed: decided in 5.4. Until then nothing is overwritten.
  function conflict(p, meta) {
    show('Plan iki yerde değişti', 'bad');
    return Promise.resolve();
  }

  // Coming back to the tab (e.g. after planning on the phone): look for a newer plan.
  var checking = null;
  function check() {
    if (checking || !Drive.canWrite() || !st.fileId) return;
    checking = Drive.planMeta(st.fileId).then(compare).catch(function (e) { show('Drive: ' + e.message, 'bad'); })
      .then(function () { checking = null; });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });

  window.Sync = { state: function () { return JSON.parse(JSON.stringify(st)); }, check: check };
})();
