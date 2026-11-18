/* Google Drive connection (read-only). Browser → Google directly; no server, no API key.
   The access token lives only in memory and expires after about an hour. */
(function () {
  'use strict';
  var C = window.CONFIG || {};
  var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var FOLDER = 'application/vnd.google-apps.folder';
  var API = 'https://www.googleapis.com/drive/v3/files';
  var token = null, client = null, gisReady = null;
  var thumbs = {};          // Drive file id → thumbnailLink (short-lived, kept in memory only)
  var folderCache = {};     // folder id → media list

  // Load Google's sign-in script early, so a click can open the popup right away.
  function loadGis() {
    if (gisReady) return gisReady;
    gisReady = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { gisReady = null; rej(new Error('Google yüklenemedi. İnternet bağlantını kontrol et.')); };
      document.head.appendChild(s);
    });
    return gisReady;
  }

  // Must run inside a click, or the browser blocks the popup.
  function signIn() {
    return new Promise(function (res, rej) {
      if (!(window.google && google.accounts && google.accounts.oauth2)) {
        return rej(new Error('Google henüz yüklenmedi. Birkaç saniye sonra tekrar dene.'));
      }
      if (!client) {
        client = google.accounts.oauth2.initTokenClient({ client_id: C.googleClientId, scope: SCOPE, callback: function () {} });
      }
      client.callback = function (r) {
        if (r && r.access_token) {
          token = r.access_token;
          document.dispatchEvent(new CustomEvent('drive:signedin'));
          res();
        } else rej(new Error('Giriş yapılamadı.'));
      };
      client.error_callback = function (e) {
        rej(new Error(e && e.type === 'popup_closed' ? 'Giriş penceresi kapandı.' : 'Giriş yapılamadı.'));
      };
      client.requestAccessToken();
    });
  }

  function fail(r) {
    if (r.status === 401) { token = null; return new Error('Oturum süresi doldu. Tekrar bağlan.'); }
    if (r.status === 403 || r.status === 404) return new Error('Bu dosyaya erişim yok. Kütüphanenin sahibi olan hesapla mı giriş yaptın?');
    return new Error('Drive hatası (' + r.status + ').');
  }

  function api(path, params) {
    var q = new URLSearchParams(Object.assign({ supportsAllDrives: 'true' }, params || {}));
    return fetch(API + path + '?' + q, { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
      if (!r.ok) throw fail(r);
      return r.json();
    });
  }

  // All items directly inside one folder (follows pages).
  function children(folderId) {
    var all = [];
    function page(tok) {
      var p = {
        q: "'" + folderId + "' in parents and trashed = false",
        fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink)',
        pageSize: '1000', orderBy: 'name', includeItemsFromAllDrives: 'true'
      };
      if (tok) p.pageToken = tok;
      return api('', p).then(function (d) {
        all = all.concat(d.files || []);
        return d.nextPageToken ? page(d.nextPageToken) : all;
      });
    }
    return page();
  }

  function isMedia(f) { return /^(image|video)\//.test(f.mimeType); }

  // The product folders at the top of the library.
  function folders() {
    return children(C.libraryFolderId).then(function (items) {
      return items.filter(function (f) { return f.mimeType === FOLDER; }).map(function (f) { return { id: f.id, name: f.name }; });
    });
  }

  // Every image and video in a folder and its subfolders. path = subfolder names, e.g. "Brass/4-5".
  function media(folderId) {
    if (folderCache[folderId]) return Promise.resolve(folderCache[folderId]);
    function walk(id, path) {
      return children(id).then(function (items) {
        var out = [], subs = [];
        items.forEach(function (f) {
          if (f.mimeType === FOLDER) subs.push(walk(f.id, path ? path + '/' + f.name : f.name));
          else if (isMedia(f)) {
            if (f.thumbnailLink) thumbs[f.id] = f.thumbnailLink;
            out.push({ id: f.id, name: f.name, mime: f.mimeType, path: path });
          }
        });
        return Promise.all(subs).then(function (rs) { return out.concat.apply(out, rs); });
      });
    }
    return walk(folderId, '').then(function (list) { folderCache[folderId] = list; return list; });
  }

  // Make sure we have thumbnail links for these file ids (e.g. the ones placed in the plan).
  function ensureThumbs(ids) {
    var todo = ids.filter(function (id) { return id && !thumbs[id]; });
    var i = 0;
    function worker() {
      if (i >= todo.length) return Promise.resolve();
      var id = todo[i++];
      return api('/' + id, { fields: 'id, thumbnailLink' })
        .then(function (f) { if (f.thumbnailLink) thumbs[id] = f.thumbnailLink; }, function () {})
        .then(worker);
    }
    var pool = [];
    for (var k = 0; k < Math.min(6, todo.length); k++) pool.push(worker());
    return Promise.all(pool);
  }

  // Thumbnail URL at a given size (Drive links end in "=s220"), or '' if unknown.
  function thumbUrl(id, size) {
    var t = thumbs[id];
    return t ? t.replace(/=s\d+(-c)?$/, '') + '=s' + (size || 800) : '';
  }

  // Full file as a local object URL (used to play videos in the large viewer).
  function fileUrl(id) {
    return fetch(API + '/' + id + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { if (!r.ok) throw fail(r); return r.blob(); })
      .then(function (b) { return URL.createObjectURL(b); });
  }

  window.Drive = {
    loadGis: loadGis,
    signIn: signIn,
    isSignedIn: function () { return !!token; },
    folders: folders,
    media: media,
    ensureThumbs: ensureThumbs,
    thumbUrl: thumbUrl,
    fileUrl: fileUrl
  };
})();
