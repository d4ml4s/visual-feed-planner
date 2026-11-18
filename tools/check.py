"""Feature check: screenshots at phone and desktop width + console errors.

Uses Playwright with the Chrome already installed (no extra browser download).
Needs the local server running:  python -m http.server 8000

    python tools/check.py OUT_DIR [URL] [--full]

OUT_DIR  where screenshots go (keep it OUTSIDE the repo, e.g. a temp folder)
URL      default http://localhost:8000/#top
--full   capture the whole page instead of one screen

Prints one line per check and exits with 1 if the page logged errors.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

SIZES = {
    "phone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
    "desktop": dict(viewport={"width": 1280, "height": 800}),
}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    out = Path(args[0])
    url = args[1] if len(args) > 1 else "http://localhost:8000/#top"
    full = "--full" in sys.argv
    out.mkdir(parents=True, exist_ok=True)
    problems = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for name, opts in SIZES.items():
            page = browser.new_context(**opts).new_page()
            errors, missing = [], []
            # 404s are reported as "missing" (the local media/ copy is gone on purpose), not as errors.
            page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errors.append(m.text))
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("response", lambda r: r.status >= 400 and missing.append(r.url))
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(500)
            shot = out / f"{name}.png"
            page.screenshot(path=str(shot), full_page=full)
            tiles = page.locator(".tile").count()
            wide = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
            media = [u for u in missing if "/media/" in u]
            other = [u for u in missing if "/media/" not in u]
            print(f"{name}: {shot} | tiles={tiles} | horizontal-scroll={'YES' if wide else 'no'} "
                  f"| errors={len(errors)} | missing media={len(media)} (expected) | other missing={len(other)}")
            for e in errors:
                print(f"  error: {e}")
            for u in other:
                print(f"  missing: {u}")
            problems += len(errors) + len(other) + (1 if wide else 0)
        browser.close()
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
