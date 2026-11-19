"""Find each skeleton card's twin in a local copy of the Drive library, by comparing the pictures.

The Doc 2 skeleton (data/seed.js) points at cards like media/2026-11-12_01.jpg that are no longer here.
The same pictures are in the Drive library under other names (e.g. "<code> <product> - model 2 - 4x5.jpg").
This tool compares the original cards with the library's 4-5 files and writes the matching library path
into the skeleton ("drive": "Kolye/4-5/<file>"). After sign-in the app links that Drive file.

Reads only (never writes) the two folders. Writes only data/seed.js.

    python tools/link_cards.py --cards <folder with YYYY-MM-DD_NN_*.jpg cards> --library <local copy of the Drive library>
"""
import argparse, json, os, pathlib, re, sys
from PIL import Image, ImageChops, ImageOps, ImageStat

HERE = pathlib.Path(__file__).resolve().parent.parent
SEED = HERE / "data" / "seed.js"


def gray(path, size):
    im = Image.open(path)
    im.draft("L", (size[0] * 4, size[1] * 4))
    return ImageOps.exif_transpose(im).convert("L").resize(size, Image.LANCZOS)


def dhash(path):
    p = gray(path, (9, 8)).tobytes()
    return sum(1 << i for i in range(64) if p[(i // 8) * 9 + i % 8] > p[(i // 8) * 9 + i % 8 + 1])


def rms(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).rms[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cards", required=True)
    ap.add_argument("--library", required=True)
    ap.add_argument("--max-rms", type=float, default=8.0, help="larger = looser match")
    a = ap.parse_args()

    lib = []
    for root, _, files in os.walk(a.library):
        rel_dir = os.path.relpath(root, a.library).replace(os.sep, "/")
        if "4-5" not in rel_dir.split("/"):
            continue
        for f in files:
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                full = os.path.join(root, f)
                lib.append((rel_dir + "/" + f, full, dhash(full)))
    print(f"library 4-5 files: {len(lib)}")

    found = {}
    for f in sorted(os.listdir(a.cards)):
        m = re.match(r"(\d{4}-\d{2}-\d{2}_\d{2})_", f)
        if not m:
            continue
        full = os.path.join(a.cards, f)
        h = dhash(full)
        short = sorted(lib, key=lambda x: bin(h ^ x[2]).count("1"))[:5]
        card = gray(full, (64, 80))
        scored = sorted((rms(card, gray(x[1], (64, 80))), x[0]) for x in short)
        if scored[0][0] <= a.max_rms:
            found[m.group(1)] = scored[0][1]
        else:
            print(f"  no match: {f} (best {scored[0][0]:.1f})")

    text = SEED.read_text(encoding="utf-8")
    head, body = text.split("window.SEED = ", 1)
    seed = json.loads(body.rstrip().rstrip(";"))
    linked = missing = 0
    for t in seed["tiles"]:
        for im in t.get("images", []):
            m = re.search(r"(\d{4}-\d{2}-\d{2}_\d{2})\.\w+$", im.get("src", ""))
            if not m:
                continue
            if m.group(1) in found:
                im["drive"] = found[m.group(1)]
                linked += 1
            else:
                missing += 1
    SEED.write_text(head + "window.SEED = " + json.dumps(seed, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"cards matched {len(found)} · skeleton images linked {linked} · without match {missing}")


if __name__ == "__main__":
    sys.exit(main())
