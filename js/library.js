/* "Drive'a bağlan": sign in and show what is in the media library (connection test before F1). */
(function () {
  'use strict';
  var btn = document.getElementById('dconnect');
  var status = document.getElementById('dstatus');
  var list = document.getElementById('dlist');
  if (!btn || !window.Drive) return;

  window.Drive.loadGis().catch(function (e) { status.textContent = e.message; });

  function say(text, bad) {
    status.textContent = text;
    status.classList.toggle('bad', !!bad);
  }

  function show(lib) {
    var total = { images: 0, videos: 0 };
    list.innerHTML = '';
    lib.folders.forEach(function (f) {
      total.images += f.images; total.videos += f.videos;
      var li = document.createElement('li');
      var n = document.createElement('b'); n.textContent = f.name;
      var c = document.createElement('span'); c.textContent = f.images + ' görsel · ' + f.videos + ' video';
      li.append(n, c);
      list.appendChild(li);
    });
    list.hidden = false;
    say('Bağlandı: ' + lib.folders.length + ' klasör · ' + total.images + ' görsel · ' + total.videos + ' video');
    btn.textContent = 'Yenile';
  }

  btn.addEventListener('click', function () {
    var step = window.Drive.isSignedIn() ? Promise.resolve() : window.Drive.signIn();
    btn.disabled = true;
    step.then(function () {
      say('Kütüphane okunuyor…');
      return window.Drive.library();
    }).then(show).catch(function (e) {
      say(e.message, true);
    }).then(function () { btn.disabled = false; });
  });
})();
