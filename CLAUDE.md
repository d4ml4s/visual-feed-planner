# Visual Feed Planner: project rules

A visual planner for an Instagram-style feed: a 3-column grid of tiles (post, carousel or video)
that I can add, remove, move and fill from my image library. I'm the user, and I plan visually.
Started from "Doc 2" of the older social media plan project; it is now its own app.
"Visual Feed Planner" is the working name. The final name is set when the GitHub repo is created.

See `README.md` for structure and how to run it.

## Tech (fixed)
- Only HTML, CSS and JavaScript. No frameworks, no build step, no database.
- No server of our own. The plan (tile order, dates, titles, which file is in which tile) lives in the browser's localStorage, and later also as one plan file in Google Drive (F4), so a cleared cache loses nothing.
- Media lives in one shared Google Drive folder that the app reads live (browser → Google directly, Google sign-in). The Library = what is in that folder right now. Media files are never copied into this repo.
- Hosted on GitHub Pages from its own private repo. All paths are relative.
- This folder is its own Git repo. `TURING COLLEGE 2026/` is a plain container folder with no Git; every project in it has its own repo.
- The UI is in Turkish. We talk in English.

## Hard rules
- **No brand names in anything published** (repo, app, page titles, demo data). The example brand is only local test data. The app has its own name. GitHub Pages serves every committed file (this one too), so brand-specific notes live in `CLAUDE.local.md`, which is gitignored.
- **The master Excel is read-only** (path in `CLAUDE.local.md`). Read it any way that cannot write it; never edit, save, copy over or re-export it. If the plan needs a change, the user updates it in its own session.
- **Leave the old folders alone:** the master plan folder (path in `CLAUDE.local.md`) and `..\social media plan visualization\`. Read from them if needed; save everything new in this folder.
- **No media or brand example data in Git.** The Doc 2 skeleton (`data/seed.js`) and its local media stand-in (`media/`) are gitignored.
- **No secrets in the repo.** The Google client ID and API key are public by design and locked to the site's address; never add a client secret.

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
- Until the Doc 2 media is in the Drive folder, the skeleton's images come from the local `media/` copy. After that the skeleton points to Drive and `media/` is deleted.

## Roadmap
- Setup: Git → GitHub repo (private) → Google Drive setup → project skills.
- **F1** Tiles: "+" left/right of a tile inserts an empty slot; empty slots are filled from Drive (drag-drop on a computer, tap + choose on a phone); full tiles refuse drops.
- **F2** Mode bar + move: Görüntüle · Ekle · Taşı · Sil, only the active mode's actions work; Sil has "Geri al".
- **F4** Plan saved to Drive, the same on every device and person. Until then: "Yedeği indir / yükle".

## Workflow
1. Plan → present → user approves → build → present → approve or update.
2. One feature at a time. Finish and check it (phone 390 px + desktop 1280 px screenshots, checklist, no console errors) before starting the next.
3. Commit and push each working feature.

## Working with the user
- **Don't assume.** When something is unclear (dates, counts, wording, behaviour), ask before building. Structure first, design second.
- Show changes visually: preview at phone width before saying it's done.
- Say clearly what is done and what is not done.
