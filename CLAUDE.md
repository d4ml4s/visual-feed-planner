# Visual Feed Planner: project rules

A visual planner for an Instagram-style feed: a 3-column grid of tiles (post, carousel or video)
that I can add, remove, move and fill from my image library. I'm the user, and I plan visually.
Started from "Doc 2" of the older social media plan project; it is now its own app.
"Visual Feed Planner" is the working name. The final name is set when the GitHub repo is created.

See `README.md` for structure and how to run it.

## Tech (fixed)
- Only HTML, CSS and JavaScript. No frameworks, no build step, no database.
- No server of our own. The plan (tile order, dates, titles, which file is in which tile) lives in the browser's localStorage, and later also as one plan file in Google Drive (Feature 3), so a cleared cache loses nothing.
- Media lives in one shared Google Drive folder that the app reads live (browser → Google directly, Google sign-in). The Library = what is in that folder right now. Media files are never copied into this repo.
- Google connection (working): a Google Cloud project in Testing mode, read-only scope `drive.readonly`, test users = the user's Google accounts. `js/config.js` holds only the client ID and the library folder ID (public by design). No API key is used: the library is our own panel, not Google's Picker. Both are locked to `http://localhost:8000` and `https://d4ml4s.github.io`. The sign-in token stays in memory only (about 1 hour), never saved. Users need to sign in again after that, and Google may ask again about once a week in Testing mode.
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
- Clean white and black, the Doc 2 look: one continuous 3-column grid, 4:5 tiles, a black week band on a week's first tile, a pinned week bar and week tabs.
- Each tile is one post: single image, carousel (swipeable) or video. Uploading any of them works the same way.
- Empty slots are dashed. Full tiles never accept drops.
- A mode bar at the top that never collapses (Görüntüle · Ekle · Taşı · Sil) prevents accidental moves and deletes.

## Starting data
- The app opens with the Doc 2 skeleton (tile order, dates, titles, images) from `data/seed.js`, made once by `tools/make_seed.py` from the old Doc 2 page. Saved edits in localStorage win over the skeleton.
- The local `media/` copy was deleted (2026-11-18). After "Drive'a bağlan" the skeleton's images and videos are linked to the same files in the Drive library (see Feature 1), so the skeleton shows the Doc 2 content again. Before sign-in, tiles show a grey box with the title.
- On the published site there is no skeleton (it is never committed), so the grid is empty until Feature 3 brings the plan from Drive.

## Roadmap

How features are named: **Feature N: short name**, and its parts **N.1, N.2…** Each part is one commit
(message starts with `Feature N.x:`). A whole feature is one branch `feature-N-name` and one pull request.

- Setup (done): Git, Google Drive connection (read-only), public repo + Pages, project skills (`.claude/skills/check-feature` + `tools/check.py`, Playwright for Python using the installed Chrome). UI skills already available: `frontend-design`, `design-skills:design-critique`, `interaction-design`, `accessibility-audit`, `ux-writing`.
- **Feature 1: Add and fill tiles** (built, PR #1 in review, branch `f1-tiles`)
  - **1.1 Add a tile:** "+" on the left/right of a full tile (hover on a computer, first tap on a phone). It asks the date: left = same day or the day before, right = same day or the day after, or Vazgeç.
  - **1.2 Library panel (Kütüphane):** our own panel, no API key: product folder chips, Tümü / 4:5 / 9:16, live thumbnails, pick in order.
  - **1.3 Fill a tile:** drag onto an empty tile (computer) or tap the tile + Yerleştir (phone). 1 image = post, 1 video = reel, 2+ = carousel in picked order. Full tiles refuse (red "Dolu"). Tiles store only Drive file ids; thumbnails load after sign-in.
  - **1.4 Delete a tile:** small "×" at the bottom right (hover on a computer, first tap on a phone); a notice offers "Geri al" for 7 seconds. (Brought forward from Feature 2 at the user's request.)
  - **Doc 2 → Drive:** after sign-in, skeleton tiles still pointing at the old local copies are linked once to the same files in the Drive library: carousel cards by their day code (`2026-11-14_04_…`), reels by product name (the Drive videos have a product code in front). Linked tiles keep only the Drive id.
- **Feature 2: Mode bar, move and delete**
  - 2.1 Mode bar that never collapses: Görüntüle · Ekle · Taşı · Sil; only the active mode's actions work.
  - 2.2 Move (Taşı): drag any tile to a new place (long-press on a phone).
  - 2.3 Sil mode: the "×" from 1.4 only works in Sil mode.
- **Feature 3: Plan saved in Drive:** the same plan on every device and person. Until then: "Yedeği indir / yükle".
  (Called "F4" in older notes; the old "F3 Drive" became part of Feature 1.)

## Workflow
1. Plan → present → user approves → build → present → approve or update.
2. One feature at a time. Finish and check it (phone 390 px + desktop 1280 px screenshots, checklist, no console errors) before starting the next.
3. Commit and push each working feature.

## Working with the user
- **Don't assume.** When something is unclear (dates, counts, wording, behaviour), ask before building. Structure first, design second.
- Show changes visually: preview at phone width before saying it's done.
- Say clearly what is done and what is not done.
