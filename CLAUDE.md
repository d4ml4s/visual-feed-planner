# Visual Feed Planner: project rules

A visual planner for an Instagram-style feed: a 3-column grid of tiles (post, carousel or video)
that I can add, remove, move and fill from my image library. I'm the user, and I plan visually.
Started from "Doc 2" of the older social media plan project; it is now its own app.
"Visual Feed Planner" is the working name. The final name is set when the GitHub repo is created.

See `README.md` for structure and how to run it.

## Tech (fixed)
- Only HTML, CSS and JavaScript. No frameworks, no build step, no database.
- No server of our own. The plan (tile order, dates, titles, which file is in which tile) lives in the browser's localStorage, and later also as one plan file in Google Drive (Feature 5), so a cleared cache loses nothing.
- Media lives in one shared Google Drive folder that the app reads live (browser → Google directly, Google sign-in). The Library = what is in that folder right now. Media files are never copied into this repo.
- Google connection (working): a Google Cloud project in Testing mode, read-only scope `drive.readonly`, test users = the user's Google accounts. `js/config.js` holds only the client ID and the library folder ID (public by design). No API key is used: the library is our own panel, not Google's Picker. Both are locked to `http://localhost:8000` and `https://d4ml4s.github.io`. The sign-in token is kept in sessionStorage for that browser tab only, so a refresh keeps you signed in; it expires after about 1 hour, then one click renews it. Google may ask again about once a week in Testing mode.
- Pictures (`Drive.paint` / `Drive.picture`): only pictures on screen load, 6 at a time. Google's small preview is fetched with the sign-in; if the browser refuses it, the image file itself. Each picture is shrunk (600 px for grid + library, 1600 px for the large view) and kept in the browser's IndexedDB (`vfp-pictures`), so the grid shows it at once next time, even before sign-in. Video previews come only from Google's preview.
- The library folder has one folder per product, each with `4-5` (posts/carousels) and `9-16` (reels) subfolders.
- Hosted on GitHub Pages from its own **public** repo `visual-feed-planner` (https://d4ml4s.github.io/visual-feed-planner/). All paths are relative. Everything committed is public, code and history; the page has `noindex`. The user's data is protected by Google sign-in (only test users), not by the page.
- This folder is its own Git repo. `TURING COLLEGE 2026/` is a plain container folder with no Git; every project in it has its own repo.
- The UI is in Turkish. We talk in English.

## Hard rules
- **No brand names in anything published** (repo, app, page titles, demo data). The example brand is only local test data. The app has its own name. GitHub Pages serves every committed file (this one too), so brand-specific notes live in `CLAUDE.local.md`, which is gitignored.
- **The master Excel is read-only** (path in `CLAUDE.local.md`). Read it any way that cannot write it; never edit, save, copy over or re-export it. If the plan needs a change, the user updates it in its own session.
- **Leave the old folders alone:** the master plan folder (path in `CLAUDE.local.md`) and `..\social media plan visualization\`. Read from them if needed; save everything new in this folder.
- **No media or brand example data in Git.** The Doc 2 skeleton (`data/seed.js`) is gitignored; so are `media/` and video files.
- **No secrets in the repo.** The Google client ID is public by design and locked to the site's address. Never add an API key or a client secret (`client_secret*.json` is gitignored).
- **No personal email in Git.** Commits use the GitHub no-reply address (set in this repo's git config).
- **The repo is public.** Before every push, check what is staged for brand names, media, personal data and secrets.

## Content rules (agreed, don't revisit)
- The example brand's content rules are in `CLAUDE.local.md`.
- Words on screen are plain and short.

## Design rules (starting point, will develop)
- Clean white and black, the Doc 2 look: one continuous 3-column grid, 4:5 tiles, a black week band on a week's first tile, a pinned week bar and week tabs. No page title or legend at the top: the Drive / Yedek buttons, then the tabs.
- Each tile is one post: single image, carousel (swipeable) or video. Uploading any of them works the same way.
- Empty slots are dashed. Full tiles never accept drops.
- Phone: two modes, Görüntüle (always at start, nothing can change) and Düzenle, switched with one round button at the bottom right. No bar: vertical space goes to the grid. The computer has no modes (hover buttons, drag to move, double-click for the calendar).
- No accidental changes while scrolling: touches that move or start while the page is moving are not taps.

## Starting data
- The app opens with the Doc 2 skeleton (tile order, dates, titles, images) from `data/seed.js`, made once by `tools/make_seed.py` from the old Doc 2 page. Saved edits in localStorage win over the skeleton.
- The local `media/` copy was deleted (2026-11-18). After "Drive'a bağlan" the skeleton's images and videos are linked to the same files in the Drive library (see Feature 1), so the skeleton shows the Doc 2 content again. Before sign-in, tiles show a grey box with the title.
- On the published site there is no skeleton (it is never committed), so the grid is empty until Feature 5 brings the plan from Drive (or an Excel backup is loaded).

## Roadmap

How features are named: **Feature N: short name**, and its parts **N.1, N.2…** Each part is one commit
(message starts with `Feature N.x:`). A whole feature is one branch `feature-N-name` and one pull request.

- Setup (done): Git, Google Drive connection (read-only), public repo + Pages, project skills (`.claude/skills/check-feature` + `tools/check.py`, Playwright for Python using the installed Chrome). UI skills already available: `frontend-design`, `design-skills:design-critique`, `interaction-design`, `accessibility-audit`, `ux-writing`.
- **Feature 1: Add and fill tiles** (merged, PR #1)
  - **1.1 Add a tile:** "+" on the left/right of a full tile (hover on a computer, first tap on a phone). It asks the date: left = same day or the day before, right = same day or the day after, or Vazgeç.
  - **1.2 Library panel (Kütüphane):** our own panel, no API key: product folder chips, Tümü / 4:5 / 9:16, live thumbnails, pick in order.
  - **1.3 Fill a tile:** drag onto an empty tile (computer) or tap the tile + Yerleştir (phone). 1 image = post, 1 video = reel, 2+ = carousel in picked order. Full tiles refuse (red "Dolu"). Tiles store only Drive file ids; thumbnails load after sign-in.
  - **1.4 Delete a tile:** small "×" at the bottom right (hover on a computer, first tap on a phone); a notice offers "Geri al" for 7 seconds. (Brought forward from Feature 2 at the user's request.)
  - **1.5 Picture memory + staying signed in:** pictures shown once are kept small in the browser and appear at once next time, even before sign-in; a refresh keeps the sign-in (same tab, about 1 hour).
  - **1.6 Doc 2 cards found automatically:** most Doc 2 cards sit in the library under product names, not day codes. `tools/link_cards.py` compares the original cards with a local copy of the library's `4-5` files picture by picture and writes each card's library path into the skeleton (`"drive": "Kolye/4-5/<file>"`). Run it once; folder paths are given as arguments (they are in `CLAUDE.local.md`). Result: all 115 cards + 18 reels link.
  - **Doc 2 → Drive:** after sign-in, skeleton tiles still pointing at the old local copies are linked once to the same files in the Drive library: cards by the library path from 1.6 (or their day code `2026-11-14_04_…`), reels by product name (the Drive videos have a product code in front). Linked tiles keep only the Drive id.
  - **1.7 Video covers + mixed carousels:** if Google's video preview is refused, the app fetches only the start of the video and its index (about 2 MB of ~25 MB), takes the first frame as the cover and remembers it. A carousel can mix pictures and videos: video slides show ▶ and play in the large view.
- **Feature 2: Safety blanket** (branch `feature-2-safety`). "Yedek" button in the header opens one panel.
  - **2.1 Versions (Geçmiş):** every saved change is kept in IndexedDB `vfp-versions` with a short reason and the tile count: the last 30, plus the newest of each day for 30 days. "Geri yükle" brings one back (with "Geri al"); a restored plan is used exactly as it was.
  - **2.2 Excel:** "Excel'e aktar" downloads `feed-plan-<date>.xlsx`: a readable "Plan" sheet (one row per tile) + a hidden "Yedek" sheet with the exact plan as JSON. "Excel'den yükle" restores only from that hidden copy (edits in the Plan sheet are not read), after showing what is in the file. SheetJS 0.20.3 from cdn.sheetjs.com with an integrity hash, loaded only when needed.
  - **2.3 Archive:** "×" on a full tile archives it (`archived` time on the tile; hidden from the grid, kept in the plan); on an empty tile it deletes it. Both offer "Geri al" for 7 seconds. The "Arşiv" list has "Geri getir" (back in its place) and "Sil" (for good; Geçmiş still has it).
  - **2.4 Plan start and end:** one-time tidy-up (plan version 2): tiles before 12 Nov 2026 archived, the undated empty last tile removed; the old state is kept in Geçmiş as "Güncellemeden önce". A "+ Yeni kutu" tile after the last tile adds at the end; the date question also has "Başka gün" (any date, e.g. a new month); "+" now shows on empty tiles too. Week tabs follow the dates (only shown tiles count).
- **Feature 3: Feed fixes** (branch `feature-3-feed-fixes`)
  - **3.1 Labels removed:** no more "Aynı ürün" / "Benzer" on tiles or in the large view. The `match` data stays in saved plans, unused.
  - **3.2 Week ruler follows the tiles:** tabs, the black week band and the pinned bar show the first to last tile date of each week ("H5 30 Kas–1 Ara", one day = "H7 14 Ara"); theme chips still use the calendar week. Weeks with no tiles get no tab. At the bottom of the page the last week is current, at the top the first; a tapped tab is current at once; the highlighted tab scrolls into view in the tab row.
- **Feature 4: Edit mode and moving tiles** (branch `feature-4-edit-move`)
  - **4.1 Top cleaned up:** title, subtitle and the Carousel / Reel / Boş kutu key removed (the title stays hidden for screen readers).
  - **4.2 Phone modes:** round switch bottom right. Görüntüle: a tap opens the tile; no + / × / "+ Yeni kutu". Düzenle: + and × always visible, a tap on an empty tile opens the Kütüphane, a single tap on a full tile does nothing. Touches that move, or start within 150 ms of a page scroll, are ignored.
  - **4.3 Computer: drag to move:** a pink line on the left/right edge of the tile under the pointer (or on "+ Yeni kutu" = the end) shows where it lands. A moved tile takes the date of its new place (the tile before it, or the one after it when it lands first). "Geri al" restores place and date.
  - **4.4 Phone: tap-tap to move (Düzenle):** double tap a full tile → it lifts; tap a tile → the line on the side tapped; bottom bar "Buraya taşı" / "Vazgeç". Same date rule.
  - **4.5 Phone: long hold → calendar (Düzenle):** hold a tile ~0.5 s → "Hangi güne taşınsın?"; the tile moves after that day's tiles and takes that date. The finger lifting after the hold never presses anything in the calendar.
  - **4.6 Phone: buttons only on the tapped tile (Düzenle):** all buttons at once were too crowded. The first tap shows that tile's + and × (black outline), like hover on a computer; a second tap on an empty tile opens the Kütüphane; a tap outside the tiles hides them. Double tap (move) and hold (calendar) unchanged. This replaces "always visible" from 4.2.
  - **4.7 Computer: double-click → calendar:** double-clicking a tile opens the same "Hangi güne taşınsın?" calendar as the phone's hold. A single click waits ~0.25 s (so a double-click never opens the large view or the Kütüphane first), then works as before.
  - **4.8 Drive sentence removed:** "Görseller Google Drive'dan gelir." is gone (phone and computer). The status spot next to the buttons stays empty and takes no space; it still shows "Bağlandı" and sign-in errors.
- **Feature 5: Plan saved in Drive:** the same plan on every device and person. Until then: the Excel backup.

## Workflow
0. Every change to a file the page loads: raise the `?v=` number on all links in `index.html` (browsers keep old copies otherwise).
1. Plan → present → user approves → build → present → approve or update.
2. One feature at a time. Finish and check it (phone 390 px + desktop 1280 px screenshots, checklist, no console errors) before starting the next.
3. Commit and push each working feature.

## Working with the user
- **Don't assume.** When something is unclear (dates, counts, wording, behaviour), ask before building. Structure first, design second.
- Show changes visually: preview at phone width before saying it's done.
- Say clearly what is done and what is not done.
