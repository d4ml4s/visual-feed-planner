/* Google Drive connection (read-only). Browser → Google directly; no server, no API key.
   The access token is kept for this browser tab only (sessionStorage), so a refresh doesn't sign you out.
   It expires after about an hour; then one click on "Drive'a bağlan" renews it. */
(function () {
  'use strict';
  var C = window.CONFIG || {};
  var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var FOLDER = 'application/vnd.google-apps.folder';
  var API = 'https://www.googleapis.com/drive/v3/files';
  var token = null, client = null, gisReady = null;
  var TOK = 'vfp.drive.token';

  // Restore the sign-in after a refresh (same tab only, until it expires).
  try {
    var saved = JSON.parse(sessionStorage.getItem(TOK) || 'null');
    if (saved && saved.exp > Date.now() + 60000) token = saved.t;
    else sessionStorage.removeItem(TOK);
  } catch (e) {}
  if (token) {
    document.addEventListener('DOMContentLoaded', function () { document.dispatchEvent(new CustomEvent('drive:signedin')); });
  }
  function forget() { token = null; try { sessionStorage.removeItem(TOK); } catch (e) {} }
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
          try { sessionStorage.setItem(TOK, JSON.stringify({ t: token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 })); } catch (e) {}
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
    if (r.status === 401) { forget(); return new Error('Oturum süresi doldu. Tekrar bağlan.'); }
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

  // ---------- pictures ----------
  // Every picture is shrunk to a small copy and kept in the browser (IndexedDB), so next time the grid
  // shows it at once, even before sign-in. Two sizes: 600 px (grid + library) and 1600 px (large view).
  // Loading a new picture: Google's small preview (with the sign-in) first; if the browser refuses it,
  // the image file itself. Only pictures that are on screen are loaded, 6 at a time.
  var urls = {};                 // cache key → object URL (this visit)
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('vfp-pictures', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('p'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function idbGet(k) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        try {
          var q = d.transaction('p').objectStore('p').get(k);
          q.onsuccess = function () { res(q.result || null); };
          q.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    });
  }
  function idbPut(k, v) {
    db().then(function (d) { try { if (d) d.transaction('p', 'readwrite').objectStore('p').put(v, k); } catch (e) {} });
  }

  function bucket(size) { return size > 600 ? 1600 : 600; }

  function shrink(blob, size) {
    if (!window.createImageBitmap) return Promise.resolve(blob);
    return createImageBitmap(blob).then(function (bm) {
      var k = Math.min(1, size / Math.max(bm.width, bm.height));
      if (k === 1 && blob.size < 300000) return blob;
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bm.width * k));
      c.height = Math.max(1, Math.round(bm.height * k));
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || blob); }, 'image/jpeg', 0.85); });
    }).catch(function () { return blob; });
  }

  function getBlob(url) {
    return fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
      if (!r.ok) throw fail(r);
      return r.blob();
    });
  }

  function thumbLink(id) {
    if (thumbs[id]) return Promise.resolve(thumbs[id]);
    return api('/' + id, { fields: 'id, thumbnailLink' }).then(function (f) {
      if (f.thumbnailLink) thumbs[id] = f.thumbnailLink;
      return f.thumbnailLink || '';
    });
  }

  function download(id, mime, size) {
    var isImage = /^image\//.test(mime || 'image/');
    var viaPreview = thumbLink(id).then(function (link) {
      if (!link) throw new Error('no preview');
      return getBlob(link.replace(/=s\d+(-c)?$/, '') + '=s' + size);
    });
    return viaPreview.catch(function () {
      if (isImage) return getBlob(API + '/' + id + '?alt=media&supportsAllDrives=true');
      return videoFrame(id);                       // a video: take its first frame ourselves
    }).then(function (b) { return shrink(b, size); });
  }

  // ---------- video cover without downloading the whole video ----------
  // An MP4/MOV file is a row of boxes: ftyp, mdat (the picture data, almost the whole file), moov (the index).
  // Phone and camera files keep the index at the END, so the first frame needs the start of the file AND
  // the index. We fetch only those two parts (about 2 MB instead of ~25 MB), put them at their real
  // positions in a blank file of the same size, and let the browser decode the first frame.
  function range(id, from, to) {
    return fetch(API + '/' + id + '?alt=media&supportsAllDrives=true', {
      headers: { Authorization: 'Bearer ' + token, Range: 'bytes=' + from + '-' + to }
    }).then(function (r) {
      if (!r.ok) throw fail(r);
      return r.arrayBuffer();
    });
  }
  function boxes(buf, size) {          // top-level boxes: [{type, start, end}], as far as the bytes we have tell
    var v = new DataView(buf), out = [], pos = 0;
    while (pos + 8 <= buf.byteLength && pos < size) {
      var n = v.getUint32(pos), type = String.fromCharCode(v.getUint8(pos + 4), v.getUint8(pos + 5), v.getUint8(pos + 6), v.getUint8(pos + 7));
      if (n === 1) { if (pos + 16 > buf.byteLength) break; n = v.getUint32(pos + 8) * 4294967296 + v.getUint32(pos + 12); }
      else if (n === 0) n = size - pos;
      if (n < 8) break;
      out.push({ type: type, start: pos, end: pos + n });
      pos += n;
    }
    return { list: out, next: pos };
  }
  function frameOf(blob) {
    return new Promise(function (res, rej) {
      var v = document.createElement('video'), u = URL.createObjectURL(blob), done = false;
      function end(err, b) { if (done) return; done = true; clearTimeout(timer); URL.revokeObjectURL(u); v.removeAttribute('src'); v.load(); err ? rej(err) : res(b); }
      var timer = setTimeout(function () { end(new Error('video timeout')); }, 15000);
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onerror = function () { end(new Error('video decode')); };
      v.onloadeddata = function () { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); };
      v.onseeked = function () {
        try {
          var c = document.createElement('canvas');
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d').drawImage(v, 0, 0);
          c.toBlob(function (b) { b ? end(null, b) : end(new Error('no frame')); }, 'image/jpeg', 0.9);
        } catch (e) { end(e); }
      };
      v.src = u;
    });
  }
  function videoFrame(id, headSize) {
    var HEAD = headSize || 2 * 1048576;
    return api('/' + id, { fields: 'size' }).then(function (meta) {
      var size = Number(meta.size);
      if (!size) throw new Error('no size');
      return range(id, 0, Math.min(size, HEAD) - 1).then(function (head) {
        var b = boxes(head, size);
        var moov = b.list.filter(function (x) { return x.type === 'moov'; })[0];
        if (moov && moov.end <= head.byteLength) return new Blob([head]);         // index at the start
        if (moov) return range(id, head.byteLength, moov.end - 1).then(function (rest) { return new Blob([head, rest]); });
        // Index after the picture data: find where it starts, fetch it, place it at its real position.
        var at = b.next;
        if (at >= size) throw new Error('no index');
        return range(id, at, size - 1).then(function (tail) {
          return new Blob([head, new ArrayBuffer(at - head.byteLength), tail]);
        });
      }).then(frameOf).catch(function (e) {
        if (!headSize && size > HEAD) return videoFrame(id, 6 * 1048576);         // first frame needed more data
        throw e;
      });
    });
  }

  var queue = [], running = 0, pending = {};
  function pump() {
    while (running < 6 && queue.length) {
      var job = queue.shift();
      running++;
      download(job.id, job.mime, job.size).then(function (b) {
        idbPut(this.key, b);
        urls[this.key] = URL.createObjectURL(b);
        this.ok(urls[this.key]);
      }.bind(job), job.no).then(function () { running--; pump(); });
    }
  }

  // Object URL of a picture: from this visit, from the browser's memory, or loaded from Drive.
  function picture(id, mime, size) {
    var key = id + '@' + bucket(size);
    if (urls[key]) return Promise.resolve(urls[key]);
    if (pending[key]) return pending[key];
    pending[key] = idbGet(key).then(function (b) {
      if (b) { urls[key] = URL.createObjectURL(b); return urls[key]; }
      if (!token) throw new Error('signin');
      return new Promise(function (ok, no) { queue.push({ id: id, mime: mime, size: bucket(size), key: key, ok: ok, no: no }); pump(); });
    });
    pending[key].catch(function () {}).then(function () { delete pending[key]; });
    return pending[key];
  }

  // Fill an <img> when it comes near the screen. onFail(err) runs if there is no way to show it.
  var watch = null, jobs = new WeakMap();
  function start(img) {
    var j = jobs.get(img);
    if (!j) return;
    jobs.delete(img);
    picture(j.id, j.mime, j.size).then(function (u) { img.src = u; }, j.onFail);
  }
  function paint(img, id, mime, size, onFail) {
    var key = id + '@' + bucket(size);
    if (urls[key]) { img.src = urls[key]; return; }
    jobs.set(img, { id: id, mime: mime, size: size, onFail: onFail || function () {} });
    if (!('IntersectionObserver' in window)) { start(img); return; }
    if (!watch) {
      watch = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { watch.unobserve(en.target); start(en.target); } });
      }, { rootMargin: '400px' });
    }
    watch.observe(img);
  }

  window.Drive = {
    loadGis: loadGis,
    signIn: signIn,
    isSignedIn: function () { return !!token; },
    folders: folders,
    media: media,
    ensureThumbs: ensureThumbs,
    thumbUrl: thumbUrl,
    fileUrl: fileUrl,
    picture: picture,
    paint: paint
  };
})();
