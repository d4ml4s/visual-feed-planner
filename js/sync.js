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
        if (!st.version) st.version = found.file.version;
        keep();
        saved(found.file);
        return;
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

  window.Sync = { state: function () { return JSON.parse(JSON.stringify(st)); } };
})();
