---
name: check-feature
description: Check a Visual Feed Planner change before it is called done. Screenshots at phone (390 px) and desktop (1280 px) width, console errors, horizontal scroll, the feature checklist, and a safety scan before commit + push. Use after building or changing a feature, or when asked to "check", "test" or "screenshot" the app.
---

# Check a feature

Follow these steps in order. Report what passed, what failed and what was not checked.

1. **Server.** Make sure `python -m http.server 8000` is running in the project root. Google sign-in only works on port 8000.
2. **Screenshots + errors.** Run:
   ```
   python tools/check.py <scratchpad>/check
   ```
   Add `--full` for the whole page, or pass a URL (e.g. `http://localhost:8000/#hafta-3`).
   Look at both PNGs with the Read tool. The script fails on console errors or horizontal scroll.
   It needs Playwright for Python (`pip install --user playwright`); it uses the installed Chrome.
3. **Checklist.** Walk through the feature's checklist from its approved plan. Anything that needs a
   Google sign-in can only be checked by the user: say so and give them exact steps.
4. **Look.** Check against the design rules in `CLAUDE.md`: Doc 2 look, 4:5 tiles, dashed empty slots,
   Turkish labels plain and short, tap targets at least 40 px on the phone, readable at 390 px.
5. **Show the user** the phone screenshot first, then desktop. Wait for their approval.
6. **Safety scan before commit** (the repo is public):
   ```
   git add -A
   git status --short
   git diff --cached | grep -i -E "<brand names from CLAUDE.local.md>|GOCSPX|client_secret|@gmail" || echo clean
   ```
   Nothing from `data/`, `media/`, `CLAUDE.local.md`, no images or videos, no personal email.
7. **Commit + push** only after the user approved: one commit per feature, message says what changed.
   Then confirm the Pages build (`gh api repos/d4ml4s/visual-feed-planner/pages/builds/latest --jq .status`).
