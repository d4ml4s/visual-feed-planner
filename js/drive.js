/* Google Drive connection (read-only). Browser → Google directly; no server.
   The access token lives only in memory and expires after about an hour. */
(function () {
  'use strict';
  var C = window.CONFIG || {};
  var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var FOLDER = 'application/vnd.google-apps.folder';
  var API = 'https://www.googleapis.com/drive/v3/files';
  var token = null, client = null, gisReady = null;

  // Load Google's sign-in script early, so the click can open the popup right away.
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
        if (r && r.access_token) { token = r.access_token; res(); }
        else rej(new Error('Giriş yapılamadı.'));
      };
      client.error_callback = function (e) {
        rej(new Error(e && e.type === 'popup_closed' ? 'Giriş penceresi kapandı.' : 'Giriş yapılamadı.'));
      };
      client.requestAccessToken();
    });
  }

  function api(path, params) {
    var q = new URLSearchParams(Object.assign({ supportsAllDrives: 'true' }, params || {}));
    return fetch(API + path + '?' + q, { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
      if (r.status === 401) { token = null; throw new Error('Oturum süresi doldu. Tekrar bağlan.'); }
      if (r.status === 403 || r.status === 404) throw new Error('Bu klasöre erişim yok. Kütüphanenin sahibi olan hesapla mı giriş yaptın?');
      if (!r.ok) throw new Error('Drive hatası (' + r.status + ').');
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

  // Count images and videos in a folder and all its subfolders.
  function count(folderId) {
    return children(folderId).then(function (items) {
      var c = { images: 0, videos: 0 };
      var subs = [];
      items.forEach(function (f) {
        if (f.mimeType === FOLDER) subs.push(f.id);
        else if (/^image\//.test(f.mimeType)) c.images++;
        else if (/^video\//.test(f.mimeType)) c.videos++;
      });
      return Promise.all(subs.map(count)).then(function (rs) {
        rs.forEach(function (r) { c.images += r.images; c.videos += r.videos; });
        return c;
      });
    });
  }

  // Library overview: the top folder's name + each subfolder with its counts.
  function library() {
    var id = C.libraryFolderId;
    return Promise.all([api('/' + id, { fields: 'id, name' }), children(id)]).then(function (r) {
      var folders = r[1].filter(function (f) { return f.mimeType === FOLDER; });
      return Promise.all(folders.map(function (f) {
        return count(f.id).then(function (c) { return { name: f.name, images: c.images, videos: c.videos }; });
      })).then(function (list) { return { name: r[0].name, folders: list }; });
    });
  }

  window.Drive = {
    loadGis: loadGis,
    signIn: signIn,
    library: library,
    isSignedIn: function () { return !!token; }
  };
})();
