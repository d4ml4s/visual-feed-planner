# Visual Feed Planner

A visual planner for an Instagram-style feed. Tiles sit in a 3-column grid, and each tile is one post: a single image, a carousel or a video. You plan by adding, removing, moving and filling tiles. The UI is in Turkish.

**Live:** https://d4ml4s.github.io/visual-feed-planner/ (not indexed by search engines)

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no server.
- The plan is saved in the browser (localStorage). Later it is also saved to Google Drive (F4).
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
js/config.js        Google client ID, API key, project number, library folder ID (public by design)
js/drive.js         Google sign-in (read-only) and reading the library folder
js/library.js       the "Drive'a bağlan" button and the library overview
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

- Google Cloud project with the Drive API and Picker API turned on.
- OAuth consent screen in **Testing** mode; the users who may sign in are added as test users.
- A web OAuth client (no client secret is used) and an API key, both restricted to `http://localhost:8000` and `https://d4ml4s.github.io`.
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
- [ ] **F1 Tiles:** "+" left/right of a tile inserts an empty slot. Empty slots are filled from Drive (drag-drop on a computer, tap + choose on a phone). Full tiles refuse drops.
- [ ] **F2 Mode bar + move:** Görüntüle · Ekle · Taşı · Sil.
- [ ] **F4 Plan in Drive:** the same plan on every device.

## Workflow

Plan → approve → build → check (phone + desktop) → commit + push, one feature at a time.
