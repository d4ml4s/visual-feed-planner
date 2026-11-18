# Visual Feed Planner

A visual planner for an Instagram-style feed. Tiles sit in a 3-column grid, and each tile is one post: a single image, a carousel or a video. You plan by adding, removing, moving and filling tiles. The UI is in Turkish.

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no server.
- The plan is saved in the browser (localStorage). Later it is also saved to Google Drive.
- Media comes live from a shared Google Drive folder, read-only, after Google sign-in ("Drive'a bağlan"). No media is stored in this repo.
- Hosted on GitHub Pages from this public repo: https://d4ml4s.github.io/visual-feed-planner/ (not indexed by search engines). Only approved Google accounts can open the library.

## Run it locally

```
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly also works for the baseline.

## Structure

```
index.html          page shell (Turkish labels)
css/style.css       look: white + black, 3-column 4:5 grid, week bands, large viewer
js/storage.js       loads and saves the plan (localStorage); falls back to the local skeleton
js/app.js           renders the grid, week tabs, pinned week bar and the large viewer
tools/make_seed.py  one-off: builds a local starting skeleton from an older project page
data/seed.js        local starting skeleton (gitignored, never published)
media/              local media stand-in (gitignored, never published)
```

## Plan data

```
{ version, weekZero: "YYYY-MM-DD", themes: [{from, to, name, color}],
  tiles: [{ id, kind: "carousel" | "post" | "reel" | "empty", date, title,
            images: [{src, name}], video?, match?: "same" | "similar", style?, label?, note }] }
```

## Roadmap

1. **F1 Tiles:** "+" left/right of a tile inserts an empty slot. Empty slots are filled from Drive (drag-drop on a computer, tap + choose on a phone). Full tiles refuse drops.
2. **F2 Mode bar + move:** Görüntüle · Ekle · Taşı · Sil.
3. **F4 Plan in Drive:** the same plan on every device.

## Workflow

Plan → approve → build → check (phone + desktop) → commit + push, one feature at a time.
