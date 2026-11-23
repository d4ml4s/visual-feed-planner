/* Feature 6: Turkish / English.
 * Turkish is the source language: every text in the code is written in Turkish and passed through t().
 * In English, t() looks the Turkish text up in EN below; anything missing stays Turkish (never blank).
 * Texts with parts that change use {names}: t('Carousel eklendi ({n}).', { n: 3 }).
 * The page's own texts carry data-t="<Turkish>" (text) or data-ta="<Turkish>" (aria-label).
 * The user's plan (titles, themes, labels) is content, not app text: it is never translated.
 * The choice is remembered in this browser (localStorage "vfp.lang"); Turkish is the default.
 */
(function () {
  'use strict';
  var KEY = 'vfp.lang';
  var lang = 'tr';
  try { if (localStorage.getItem(KEY) === 'en') lang = 'en'; } catch (e) { /* blocked: Turkish */ }

  var EN = {
    // ---- page ----
    "Instagram akışını görsel olarak planla. Veriler bu tarayıcıda kalır.": "Plan your Instagram feed visually. Your data stays in this browser.",
    "Google Drive kütüphanesi": "Google Drive library",
    "Drive'a bağlan": "Connect Drive",
    "Yedek": "Backup",
    "Haftalar": "Weeks",
    "Henüz kutu yok.": "No tiles yet.",
    "Büyük görünüm": "Large view",
    "Kapat ✕": "Close ✕",
    "Kütüphane": "Library",
    "Boyut": "Size",
    "Tümü": "All",
    "4:5 gönderi": "4:5 post",
    "9:16 reel": "9:16 reel",
    "Dosya seç": "Pick files",
    "Temizle": "Clear",
    "Yerleştir": "Place",
    "Yeni kutu": "New tile",
    "Hangi gün?": "Which day?",
    "Başka gün": "Another day",
    "Ekle": "Add",
    "Vazgeç": "Cancel",
    "Planın kopyaları. Hiçbir şey kaybolmaz.": "Copies of your plan. Nothing gets lost.",
    "Planı Excel dosyası olarak indir; başka bir cihazda ya da temizlenen tarayıcıda geri yükle. Yüklerken dosyadaki gizli tam kopya kullanılır.":
      "Download the plan as an Excel file; load it back on another device or in a cleared browser. Loading uses the hidden exact copy inside the file.",
    "Excel'e aktar": "Export to Excel",
    "Excel'den yükle": "Load from Excel",
    "Yükle": "Load",
    "Arşiv": "Archive",
    "Geçmiş": "History",
    "Her değişiklik kaydedilir: son 30 kayıt ve 30 gün boyunca her günün sonuncusu. Bu tarayıcıda saklanır.":
      "Every change is saved: the last 30, plus the last one of each day for 30 days. Kept in this browser.",
    "Düzenle": "Edit",
    "Düzenlemeyi bitir": "Finish editing",
    "Plan iki yerde değişti": "The plan changed in two places",
    "Hangisi kalsın? Diğeri Geçmiş'e kaydedilir.": "Which one should stay? The other is kept in History.",
    "Drive'daki": "Drive's copy",
    "Bu cihazdaki": "This device's",
    "Hangi güne taşınsın?": "Move to which day?",
    "Gün": "Day",
    "Taşı": "Move",
    "Kutuyu taşı": "Move the tile",
    "Buraya taşı": "Move here",
    "Dile geç": "Language",
    "English'e geç": "Switch to English",
    "Türkçeye geç": "Switch to Turkish",

    // ---- grid and editing (app.js) ----
    "Görmek için Drive'a bağlan": "Connect Drive to see it",
    "Görsel yok": "No picture",
    "Boş kutu": "Empty tile",
    "Hafta {n}": "Week {n}",
    "Soluna boş kutu ekle": "Add an empty tile to the left",
    "Sağına boş kutu ekle": "Add an empty tile to the right",
    "Carousel": "Carousel",
    "Reel": "Reel",
    "Gönderi": "Post",
    "Boş": "Empty",
    "Sona yeni kutu ekle": "Add a new tile at the end",
    "Kaydedilemedi: tarayıcı hafızası dolu.": "Couldn't save: the browser's storage is full.",
    "Boş kutuyu sil": "Delete the empty tile",
    "Kutuyu arşive kaldır": "Move the tile to the archive",
    "Boş kutu silindi.": "Empty tile deleted.",
    "Geri al": "Undo",
    "Kutu arşive kaldırıldı.": "Tile moved to the archive.",
    "Arşivden silindi.": "Deleted from the archive.",
    "Sona yeni kutu": "New tile at the end",
    "Soluna yeni kutu": "New tile to the left",
    "Sağına yeni kutu": "New tile to the right",
    "Aynı gün": "Same day",
    "Bir gün önce": "One day before",
    "Bir gün sonra": "One day after",
    "Tarihsiz ekle": "Add without a date",
    "Bu kutu dolu.": "This tile is full.",
    "Carousel eklendi ({n}).": "Carousel added ({n}).",
    "Reel eklendi.": "Reel added.",
    "Gönderi eklendi.": "Post added.",
    "Tarihsiz kutu": "Undated tile",
    "Doc 2 görselleri Drive'a bağlandı: {n}": "Doc 2 pictures linked to Drive: {n}",
    " · bulunamayan: {n}": " · not found: {n}",
    "Doc 2 görsellerinden {n} tanesi Drive'da bulunamadı.": "{n} Doc 2 pictures were not found in Drive.",
    "Doc 2 görselleri bağlanamadı: {e}": "Couldn't link the Doc 2 pictures: {e}",
    "Düzenleme açık.": "Editing is on.",
    "Görüntüleme: değişiklik yapılamaz.": "Viewing: nothing can change.",
    "Doldurmak için Düzenle'ye geç.": "Switch to Edit to fill it.",
    "Kutu taşındı.": "Tile moved.",
    "Kutu taşındı: {d}.": "Tile moved: {d}.",
    "Nereye? Bir kutuya dokun.": "Where to? Tap a tile.",
    "Soluna: {d}": "Left of: {d}",
    "Sağına: {d}": "Right of: {d}",
    "En sona": "At the end",
    "şimdi {d}": "now {d}",
    "tarihsiz": "undated",
    "Önce dosyayı Drive klasörüne ekle, sonra Kütüphane'den seç.": "Add the file to the Drive folder first, then pick it in the Library.",
    "{d}: doldur": "{d}: fill",

    // ---- Geçmiş reasons (stored in Turkish, shown in the current language) ----
    "Değişiklik": "Change",
    "Kutu eklendi": "Tile added",
    "Kutu dolduruldu": "Tile filled",
    "Kutu arşivlendi": "Tile archived",
    "Boş kutu silindi": "Empty tile deleted",
    "Geri alındı": "Undone",
    "Arşivden geri getirildi": "Brought back from the archive",
    "Arşivden silindi": "Deleted from the archive",
    "Kutu taşındı": "Tile moved",
    "Doc 2 görselleri Drive'a bağlandı": "Doc 2 pictures linked to Drive",
    "Önceki hali": "Previous state",
    "Güncellemeden önce": "Before the update",
    "Başlangıç 12 Kasım; boş son kutu silindi": "Start 12 November; empty last tile removed",
    "Açılış": "Opening",
    "Excel'den yüklendi": "Loaded from Excel",
    "Bu cihazdaki (çakışmada bırakıldı)": "This device's (left in a conflict)",
    "Bu cihazdaki seçildi": "This device's chosen",

    // ---- Yedek panel (backup.js) ----
    "IndexedDB yok": "No IndexedDB",
    "Bugün {t}": "Today {t}",
    "Dün {t}": "Yesterday {t}",
    "Henüz kayıt yok. Her değişiklik burada saklanır.": "Nothing saved yet. Every change is kept here.",
    "{n} kutu": "{n} tiles",
    " · arşiv {n}": " · archive {n}",
    "Şimdiki": "Current",
    "Geri yükle": "Restore",
    "Bu tarayıcıda geçmiş saklanamıyor. Excel yedeği kullan.": "This browser can't keep a history. Use the Excel backup.",
    "Plan geri yüklendi: {w}.": "Plan restored: {w}.",
    "Arşiv boş. Silinen dolu kutular buraya gelir.": "The archive is empty. Deleted full tiles come here.",
    "Geri getir": "Bring back",
    "Sil": "Delete",
    "Arşivden tamamen sil": "Delete from the archive for good",
    "Excel aracı yüklenemedi": "The Excel tool couldn't load",
    "Excel aracı yüklenemedi (internet?)": "The Excel tool couldn't load (internet?)",
    "Sıra": "No.",
    "Tarih": "Date",
    "Tür": "Type",
    "Başlık": "Title",
    "Dosyalar": "Files",
    "Durum": "Status",
    "Hafta": "Week",
    "Excel indirildi.": "Excel downloaded.",
    "Bu dosyada yedek yok. Yalnızca bu uygulamanın Excel'i yüklenebilir.": "This file has no backup. Only this app's Excel can be loaded.",
    "Yedek okunamadı.": "The backup couldn't be read.",
    "{f}: {n} kutu{r}{a}. Şimdiki planın yerine geçsin mi? Şimdiki hali Geçmiş'e kaydedilir.":
      "{f}: {n} tiles{r}{a}. Replace the current plan? The current state is kept in History.",
    ", arşivde {n}": ", {n} in the archive",
    "Plan Excel'den yüklendi.": "Plan loaded from Excel.",

    // ---- Kütüphane (library.js) ----
    "Hedef: {d}": "Target: {d}",
    "Boş bir kutuya dokun": "Tap an empty tile",
    "Boş bir kutuya sürükle": "Drag onto an empty tile",
    "Klasörler yükleniyor…": "Loading folders…",
    "Kütüphanede klasör yok.": "The library has no folders.",
    "Dosyalar yükleniyor…": "Loading files…",
    "Bu seçimde dosya yok.": "No files in this selection.",
    "Klasörün kendisi": "The folder itself",
    "Daha fazla göster ({n})": "Show more ({n})",
    "{n} seçili": "{n} picked",

    // ---- Drive plan (sync.js) ----
    "Drive'a kaydedildi {t}": "Saved to Drive {t}",
    "Plan kaydı için Drive izni gerekli": "Drive permission needed to save the plan",
    "Drive kontrol ediliyor…": "Checking Drive…",
    "Bu hesapta plan yok": "No plan in this account",
    "Kaydediliyor…": "Saving…",
    "Plan Drive'a kaydedildi: Visual Feed Planner / plan.json": "Plan saved to Drive: Visual Feed Planner / plan.json",
    "Drive'daki plan okunamadı.": "The plan in Drive couldn't be read.",
    "Drive'dan alındı {t}": "Taken from Drive {t}",
    "Bağlantı yok, sonra kaydedilecek": "No connection, will save later",
    "Drive: {e}": "Drive: {e}",
    "Drive'a tekrar bağlan": "Reconnect Drive",
    "Bu cihazdaki plan Drive'a kaydedildi.": "This device's plan was saved to Drive.",
    "Drive'a bağlanınca plan 'Visual Feed Planner / plan.json' dosyasına kaydedilir.": "After connecting Drive, the plan is saved to 'Visual Feed Planner / plan.json'.",
    "Hesap: …": "Account: …",
    "Hesap: {a}": "Account: {a}",
    "Dosya: Visual Feed Planner / plan.json": "File: Visual Feed Planner / plan.json",
    " · son kayıt {t}": " · last saved {t}",
    " · kaydedilmemiş değişiklik var": " · unsaved changes",
    "Drive'a kaydet": "Save to Drive",
    "Bu cihazdaki planı şimdi Drive'a yazar. Drive'daki önceki hali Geçmiş'e kaydedilir.": "Writes this device's plan to Drive now. Drive's previous copy is kept in History.",
    "Drive'da aç": "Open in Drive",
    "telefon": "phone",
    "bilgisayar": "computer",

    // ---- Google (drive.js) ----
    "Google yüklenemedi. İnternet bağlantını kontrol et.": "Google couldn't load. Check your internet connection.",
    "Google henüz yüklenmedi. Birkaç saniye sonra tekrar dene.": "Google hasn't loaded yet. Try again in a few seconds.",
    "Giriş yapılamadı.": "Couldn't sign in.",
    "Giriş penceresi kapandı.": "The sign-in window was closed.",
    "Oturum süresi doldu. Tekrar bağlan.": "The sign-in ran out. Connect again.",
    "Bu dosyaya erişim yok. Kütüphanenin sahibi olan hesapla mı giriş yaptın?": "No access to this file. Did you sign in with the account that owns the library?",
    "Drive hatası ({n}).": "Drive error ({n})."
  };

  // Stored texts that start with a fixed part (Geçmiş reasons with a time or device in them).
  var STARTS = [
    ["Drive'dan alındı (", "Taken from Drive ("],
    ["Geri yüklendi (", "Restored ("],
    ["Drive'daki (çakışmada bırakıldı, ", "Drive's copy (left in a conflict, "],
    ["Drive'daki (Drive'a kaydet'ten önce, ", "Drive's copy (before 'Save to Drive', "]
  ];

  var NAMES = {
    tr: {
      AYK: ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
      AY: ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
      GUNK: ['Paz', 'Pzt', 'Sal', 'Çar', 'Prş', 'Cum', 'Cmt'],
      GUNL: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    },
    en: {
      AYK: ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      AY: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      GUNK: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      GUNL: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    }
  };

  function fill(s, v) {
    return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s;
  }
  /** App text: Turkish source → current language. */
  function t(s, v) { return fill(lang === 'en' && EN[s] != null ? EN[s] : s, v); }
  /** A text that was stored in Turkish (Geçmiş reasons, device names): shown in the current language. */
  function stored(s) {
    if (lang !== 'en' || !s) return s;
    if (EN[s] != null) return EN[s];
    for (var i = 0; i < STARTS.length; i++) {
      if (s.indexOf(STARTS[i][0]) === 0) {
        return STARTS[i][1] + s.slice(STARTS[i][0].length).replace(/\btelefon\b/g, 'phone').replace(/\bbilgisayar\b/g, 'computer');
      }
    }
    return s;
  }
  function names(k) { return NAMES[lang][k]; }

  /** Puts the page's own texts into the current language. */
  function apply(root) {
    root = root || document;
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
    root.querySelectorAll('[data-ta]').forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-ta'))); });
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t(meta.getAttribute('data-t-content') || meta.getAttribute('content')));
    var sw = document.getElementById('lang');
    if (sw) {
      sw.textContent = lang === 'en' ? 'TR' : 'EN';
      sw.setAttribute('aria-label', lang === 'en' ? t('Türkçeye geç') : t("English'e geç"));
      sw.setAttribute('lang', lang === 'en' ? 'tr' : 'en');
    }
  }
  /** Sets a page element's text and keeps it in step with later language switches. */
  function text(n, s, v) {
    if (!n) return;
    if (v) { n.removeAttribute('data-t'); n.textContent = t(s, v); return; }
    n.setAttribute('data-t', s);
    n.textContent = t(s);
  }
  function set(l) {
    lang = l === 'en' ? 'en' : 'tr';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* not remembered */ }
    apply();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
  }

  window.I18N = { t: t, stored: stored, names: names, apply: apply, text: text, set: set, lang: function () { return lang; } };
  window.t = t;

  document.addEventListener('DOMContentLoaded', function () {
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('data-t-content', meta.getAttribute('content'));
    var sw = document.getElementById('lang');
    if (sw) sw.addEventListener('click', function () { set(lang === 'en' ? 'tr' : 'en'); });
    apply();
  });
})();
