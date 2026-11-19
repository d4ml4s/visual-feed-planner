# Visual Feed Planner

A visual planner for an Instagram-style feed. Tiles sit in a 3-column grid, and each tile is one post: a single image, a carousel or a video. You plan by adding, removing, moving and filling tiles. The UI is in Turkish.

**Live:** https://d4ml4s.github.io/visual-feed-planner/ (not indexed by search engines)

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no server.
- The plan is saved in the browser (localStorage). Later it is also saved to Google Drive (Feature 3).
- Media comes live from a shared Google Drive folder, read-only, after Google sign-in ("Drive'a bağlan"). No media is stored in this repo.
- Only Google accounts added as test users can open the library. Anyone else sees an empty grid.

## Run it locally

```
python -m http.server 8000
```

Then open http://localhost:8000. Google sign-in only works from `http://localhost:8000` and `https://d4ml4s.github.io`, so use exactly that port.

## Structure

```
index.html          page shell (Turkish labels)
css/style.css       look: white + black, 3-column 4:5 grid, week bands, large viewer
js/storage.js       loads and saves the plan (localStorage); falls back to the local skeleton
js/app.js           renders the grid, week tabs, pinned week bar and the large viewer
js/config.js        Google client ID + library folder ID (public by design; no API key)
js/drive.js         Google sign-in (read-only), folder listing, thumbnails, video files
js/library.js       the Kütüphane panel: folders, 4:5 / 9:16 filter, pick in order, drag or Yerleştir
tools/make_seed.py  one-off: builds a local starting skeleton from an older project page
tools/check.py      feature check: phone (390 px) + desktop (1280 px) screenshots, console errors
.claude/skills/     project skill "check-feature" (the check routine before every commit)
data/seed.js        local starting skeleton (gitignored, never published)
```

## Check a change

Needs Playwright for Python once (`pip install --user playwright`); it uses the installed Chrome.

```
python tools/check.py <folder outside the repo> [URL] [--full]
```

## Google setup (done once)

- Google Cloud project with the Drive API turned on.
- OAuth consent screen in **Testing** mode; the users who may sign in are added as test users.
- A web OAuth client restricted to `http://localhost:8000` and `https://d4ml4s.github.io`. No client secret and no API key are used.
- Scope: `drive.readonly`. The app can see files, never change them.

## Plan data

```
{ version, weekZero: "YYYY-MM-DD", themes: [{from, to, name, color}],
  tiles: [{ id, kind: "carousel" | "post" | "reel" | "empty", date, title,
            images: [{src, name}], video?, match?: "same" | "similar", style?, label?, note }] }
```

## Roadmap

- [x] Git, Google Drive connection, public repo + GitHub Pages
- [x] Project skills: feature check with phone + desktop screenshots
- [ ] **Feature 1: Add and fill tiles** (in review)
  - 1.1 Add a tile: "+" left/right of a full tile, asks the date
  - 1.2 Library panel (Kütüphane): Drive folders, 4:5 / 9:16, pick in order
  - 1.3 Fill a tile: drag (computer) or tap + Yerleştir (phone); full tiles refuse
  - 1.4 Delete a tile: "×" on the tile, with "Geri al"
  - Doc 2 starting plan: its images and videos are linked to the Drive library after sign-in
- [ ] **Feature 2: Mode bar, move and delete:** 2.1 mode bar (Görüntüle · Ekle · Taşı · Sil), 2.2 move, 2.3 Sil mode
- [ ] **Feature 3: Plan saved in Drive:** the same plan on every device

Naming: **Feature N** = one branch + one pull request; **N.1, N.2…** = its parts, one commit each (`Feature N.x: …`).

## Workflow

Plan → approve → build → check (phone + desktop) → commit + push, one feature at a time.
