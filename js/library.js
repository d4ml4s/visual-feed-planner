/* Kütüphane: a live view of the Drive library folder.
   Pick files in order, then drag them onto an empty tile (computer) or press "Yerleştir" (phone). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var btn = $('dconnect'), status = $('dstatus');
  var panel = $('lib'), grid = $('lgrid'), chips = $('lfolders'), sizes = $('lsize');
  var place = $('lplace'), count = $('lcount'), target = $('ltarget');
  if (!btn || !window.Drive || !panel) return;

  var state = { folders: null, folder: null, size: 'all', items: [], picked: [], target: null };

  Drive.loadGis().catch(function (e) { say(e.message, true); });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function say(text, bad) {
    status.textContent = text;
    status.classList.toggle('bad', !!bad);
  }

  // ---- open / close ----
  // Called from a click, so a sign-in popup is allowed here.
  function open(targetId) {
    state.target = targetId && window.Planner && Planner.isEmpty(targetId) ? targetId : state.target;
    markTarget();
    if (Drive.isSignedIn()) return show();
    btn.disabled = true;
    Drive.signIn().then(show, function (e) { say(e.message, true); }).then(function () { btn.disabled = false; });
  }

  function show() {
    panel.hidden = false;
    document.body.classList.add('lib-open');
    btn.textContent = 'Kütüphane';
    say('Bağlandı');
    updateFoot();
    if (!state.folders) loadFolders();
  }

  function close() {
    panel.hidden = true;
    document.body.classList.remove('lib-open');
    state.target = null;
    markTarget();
  }

  function markTarget() {
    document.querySelectorAll('.tile.target').forEach(function (n) { n.classList.remove('target'); });
    if (state.target) {
      var n = document.querySelector('.tile[data-id="' + state.target + '"]');
      if (n) n.classList.add('target');
      target.textContent = 'Hedef: ' + Planner.tileLabel(state.target);
    } else {
      target.textContent = matchMedia('(hover: none)').matches ? 'Boş bir kutuya dokun' : 'Boş bir kutuya sürükle';
    }
    updateFoot();
  }

  // ---- folders + files ----
  function loadFolders() {
    grid.textContent = '';
    grid.appendChild(el('p', 'lnote', 'Klasörler yükleniyor…'));
    Drive.folders().then(function (list) {
      state.folders = list;
      chips.textContent = '';
      list.forEach(function (f) {
        var c = el('button', 'lchip', f.name);
        c.type = 'button';
        c.dataset.id = f.id;
        chips.appendChild(c);
      });
      if (list.length) pickFolder(list[0].id);
      else { grid.textContent = ''; grid.appendChild(el('p', 'lnote', 'Kütüphanede klasör yok.')); }
    }, fail);
  }

  function pickFolder(id) {
    state.folder = id;
    Array.prototype.forEach.call(chips.children, function (c) { c.classList.toggle('on', c.dataset.id === id); });
    grid.textContent = '';
    grid.appendChild(el('p', 'lnote', 'Dosyalar yükleniyor…'));
    Drive.media(id).then(function (items) {
      if (state.folder !== id) return;
      state.items = items;
      drawGrid();
    }, fail);
  }

  function fail(e) {
    grid.textContent = '';
    grid.appendChild(el('p', 'lnote bad', e.message));
  }

  function inSize(it) {
    if (state.size === 'all') return true;
    return it.path.split('/').indexOf(state.size) >= 0;
  }

  function drawGrid() {
    grid.textContent = '';
    var list = state.items.filter(inSize);
    if (!list.length) { grid.appendChild(el('p', 'lnote', 'Bu seçimde dosya yok.')); return; }
    list.forEach(function (it) {
      var b = el('button', 'lthumb');
      b.type = 'button';
      b.dataset.id = it.id;
      b.draggable = true;
      b.title = (it.path ? it.path + '/' : '') + it.name;
      var src = Drive.thumbUrl(it.id, 300);
      if (src) { var im = el('img'); im.src = src; im.alt = it.name; im.loading = 'lazy'; im.draggable = false; b.appendChild(im); }
      else b.appendChild(el('span', 'lname', it.name));
      if (/^video\//.test(it.mime)) b.appendChild(el('span', 'lvid'));
      b.appendChild(el('span', 'lnum'));
      grid.appendChild(b);
    });
    paintPicked();
  }

  // ---- picking (order matters: it becomes the carousel order) ----
  function toggle(id) {
    var i = indexPicked(id);
    if (i >= 0) state.picked.splice(i, 1);
    else {
      var it = state.items.filter(function (x) { return x.id === id; })[0];
      if (it) state.picked.push(it);
    }
    paintPicked();
  }

  function indexPicked(id) {
    for (var i = 0; i < state.picked.length; i++) if (state.picked[i].id === id) return i;
    return -1;
  }

  function paintPicked() {
    Array.prototype.forEach.call(grid.querySelectorAll('.lthumb'), function (b) {
      var i = indexPicked(b.dataset.id);
      b.classList.toggle('on', i >= 0);
      b.querySelector('.lnum').textContent = i >= 0 ? i + 1 : '';
      b.setAttribute('aria-pressed', i >= 0 ? 'true' : 'false');
    });
    updateFoot();
  }

  function updateFoot() {
    var n = state.picked.length;
    count.textContent = n ? n + ' seçili' + (n > 1 ? ' · carousel' : '') : 'Dosya seç';
    $('lclear').hidden = !n;
    place.disabled = !(n && state.target);
  }

  function clearSelection() { state.picked = []; paintPicked(); }

  // ---- events ----
  btn.addEventListener('click', function () { panel.hidden ? open(null) : close(); });
  $('lclose').addEventListener('click', close);
  $('lclear').addEventListener('click', clearSelection);

  chips.addEventListener('click', function (e) {
    var c = e.target.closest('.lchip');
    if (c) pickFolder(c.dataset.id);
  });
  sizes.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    state.size = b.dataset.size;
    Array.prototype.forEach.call(sizes.children, function (x) { x.classList.toggle('on', x === b); });
    drawGrid();
  });
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.lthumb');
    if (b) toggle(b.dataset.id);
  });

  // Drag: a picked file carries the whole selection; an unpicked one goes alone.
  grid.addEventListener('dragstart', function (e) {
    var b = e.target.closest('.lthumb');
    if (!b) return;
    var items = indexPicked(b.dataset.id) >= 0 ? state.picked
      : state.items.filter(function (x) { return x.id === b.dataset.id; });
    e.dataTransfer.setData(Planner.DT, JSON.stringify(items));
    e.dataTransfer.effectAllowed = 'copy';
  });

  place.addEventListener('click', function () {
    if (!state.target || !state.picked.length) return;
    if (Planner.fill(state.target, state.picked)) {
      clearSelection();
      state.target = null;
      markTarget();
      if (matchMedia('(max-width: 760px)').matches) close();
    }
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden && $('ask').hidden) close(); });

  window.Library = { open: open, clearSelection: clearSelection };
})();
