"""Generate responsive WebP variants for every location photo.

For each ``locations/<slug>/images/*.jpg`` this writes, next to the original:

    <name>-480.webp    thumbnail for cards, map popups and the gallery strip
    <name>-1200.webp   main gallery image (originals are at most 1200px wide)

Originals are kept untouched as the source of truth. Existing variants are
skipped unless ``--force`` is given, so re-running is cheap.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
LOCATIONS_DIR = ROOT / "locations"
SIZES = (480, 1200)
QUALITY = {480: 78, 1200: 80}
SOURCE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def variants_for(src: Path) -> list[tuple[int, Path]]:
    return [(w, src.with_name(f"{src.stem}-{w}.webp")) for w in SIZES]


def process(src: Path, force: bool) -> dict:
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        width, height = im.size
        written = 0
        for target_w, out in variants_for(src):
            if out.exists() and not force:
                continue
            copy = im.copy()
            if width > target_w:
                copy.thumbnail((target_w, target_w * 10), Image.LANCZOS)
            copy.save(out, "WEBP", quality=QUALITY[target_w], method=6)
            written += 1
    return {"width": width, "height": height, "written": written}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="regenerate existing variants")
    parser.add_argument("--manifest", type=Path, default=ROOT / "data" / "images.json",
                        help="where to write the image dimension manifest")
    args = parser.parse_args()

    manifest: dict[str, dict] = {}
    total_written = 0
    for src in sorted(LOCATIONS_DIR.glob("*/images/*")):
        if src.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        info = process(src, args.force)
        total_written += info["written"]
        rel = src.relative_to(ROOT).as_posix()
        manifest[rel] = {"width": info["width"], "height": info["height"]}
    with open(args.manifest, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print(f"{len(manifest)} source images, {total_written} variants written, manifest -> {args.manifest.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
