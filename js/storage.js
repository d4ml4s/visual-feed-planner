/* Plan storage. The plan is small text, so it lives in localStorage under one key.
 * If nothing is saved yet, the app starts from the local Doc 2 skeleton (window.SEED),
 * or from an empty plan when there is none (e.g. on the published site before the plan is in Drive).
 * Every saved change is also kept as a version (js/backup.js).
 */
(function () {
  'use strict';

  var KEY = 'vfp.plan';
  var VERSION = 2;

  function emptyPlan() {
    return { version: VERSION, weekZero: '', themes: [], tiles: [] };
  }

  function fromSeed() {
    var s = window.SEED;
    if (!s || !Array.isArray(s.tiles)) return emptyPlan();
    return JSON.parse(JSON.stringify({ version: 1, weekZero: s.weekZero || '', themes: s.themes || [], tiles: s.tiles }));
  }

  // One-time tidy-up for plans made before version 2 (Feature 2.4):
  // - undated empty tiles go (the skeleton ended with one, which left nothing to add after);
  // - tiles before 12 Nov 2026 move to the archive, so the grid starts there. Nothing is lost.
  var START = '2026-11-12';
  function upgrade(plan) {
    if ((plan.version || 1) >= VERSION) return false;
    plan.tiles = plan.tiles.filter(function (t) { return t.date || (t.images || []).length; });
    var at = new Date().toISOString();
    plan.tiles.forEach(function (t) { if (t.date && t.date < START && !t.archived) t.archived = at; });
    plan.version = VERSION;
    return true;
  }

  function load() {
    var plan = null, raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw) {
        plan = JSON.parse(raw);
        if (!plan || !Array.isArray(plan.tiles)) plan = null;
      }
    } catch (e) { plan = null; /* storage blocked or corrupt: fall back */ }
    if (!plan) { plan = fromSeed(); raw = plan.tiles.length ? JSON.stringify(plan) : null; }
    var before = raw;
    if (upgrade(plan)) Store.upgradedFrom = before;   // app.js keeps the old state as a version
    return plan;
  }

  /** Throws when storage is full or blocked, so the caller can tell the user. */
  function save(plan) {
    localStorage.setItem(KEY, JSON.stringify(plan));
  }

  /** Checks that something read from a file looks like a plan. */
  function valid(p) {
    return !!p && typeof p === 'object' && Array.isArray(p.tiles) &&
      p.tiles.every(function (t) { return t && typeof t.id === 'string' && typeof t.kind === 'string'; });
  }

  var Store = window.Store = { VERSION: VERSION, load: load, save: save, fromSeed: fromSeed, valid: valid, upgrade: upgrade, upgradedFrom: null };
})();
