/* Plan storage. The plan is small text, so it lives in localStorage under one key.
 * If nothing is saved yet, the app starts from the local Doc 2 skeleton (window.SEED),
 * or from an empty plan when there is none (e.g. on the published site before F4).
 * Feature F4 will also keep a copy of the plan in Google Drive.
 */
(function () {
  'use strict';

  var KEY = 'vfp.plan';

  function emptyPlan() {
    return { version: 1, weekZero: '', themes: [], tiles: [] };
  }

  function fromSeed() {
    var s = window.SEED;
    if (!s || !Array.isArray(s.tiles)) return emptyPlan();
    return JSON.parse(JSON.stringify({ version: 1, weekZero: s.weekZero || '', themes: s.themes || [], tiles: s.tiles }));
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var plan = JSON.parse(raw);
        if (plan && Array.isArray(plan.tiles)) return plan;
      }
    } catch (e) { /* storage blocked or corrupt: fall back */ }
    return fromSeed();
  }

  /** Throws when storage is full or blocked, so the caller can tell the user. */
  function save(plan) {
    localStorage.setItem(KEY, JSON.stringify(plan));
  }

  window.Store = { load: load, save: save, fromSeed: fromSeed };
})();
