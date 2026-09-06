"""Render the favicon, app icons and the default social-sharing card.

Everything is drawn from the logo mark (a 3x3 grid with one dot "off the grid")
using Pillow, so no binary design files need to live in the repository. The
brand fonts are converted from the vendored woff2 files at run time.

Usage: python tools/make_icons.py
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "img"
FONT_DIR = ROOT / "assets" / "fonts"

INK = (22, 22, 22)
PAPER = (246, 244, 239)
BRASS = (245, 158, 11)
MUTED = (198, 193, 184)


def mark(size: int, background=INK, dots=PAPER, accent=BRASS, transparent=False) -> Image.Image:
    """The logo mark rendered at `size` pixels (supersampled for smooth edges)."""
    s = 4
    canvas = size * s
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    unit = canvas / 64
    if not transparent:
        draw.rounded_rectangle([0, 0, canvas - 1, canvas - 1], radius=int(14 * unit), fill=background)
    r = 4.5 * unit
    for cx in (18, 32, 46):
        for cy in (18, 32, 46):
            if (cx, cy) == (46, 46):
                continue
            draw.ellipse([cx * unit - r, cy * unit - r, cx * unit + r, cy * unit + r], fill=dots)
    ar = 6 * unit
    draw.ellipse([51 * unit - ar, 51 * unit - ar, 51 * unit + ar, 51 * unit + ar], fill=accent)
    return img.resize((size, size), Image.LANCZOS)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    """Load a vendored woff2 font by converting it to TTF in a temp dir."""
    try:
        from fontTools.ttLib import TTFont
    except ImportError:  # pragma: no cover - fallback keeps the script usable
        return ImageFont.load_default(size)
    ttf = Path(tempfile.gettempdir()) / f"{name}.ttf"
    if not ttf.exists():
        f = TTFont(str(FONT_DIR / f"{name}.woff2"))
        f.flavor = None
        f.save(str(ttf))
    return ImageFont.truetype(str(ttf), size)


def social_card(path: Path) -> None:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), INK)
    draw = ImageDraw.Draw(img)
    for x in range(20, w, 26):
        for y in range(20, h, 26):
            draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(40, 40, 40))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([820, 300, 1400, 880], fill=(245, 158, 11, 46))
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"))
    draw = ImageDraw.Draw(img)

    logo = mark(220, background=PAPER, dots=INK)
    img.paste(logo, (90, 205), logo)

    title_font = font("playfair-display-latin-700-normal", 88)
    tag_font = font("poppins-latin-400-normal", 30)
    small_font = font("poppins-latin-500-normal", 22)
    draw.text((360, 190), "Off The Grid", font=title_font, fill=PAPER)
    draw.text((360, 290), "NYC", font=title_font, fill=BRASS)
    draw.text((362, 410), "Proof NYC has depth of character", font=tag_font, fill=MUTED)
    draw.text((362, 470), "A hand-curated map of the city's quiet corners", font=small_font, fill=(150, 146, 138))
    draw.text((90, 560), "offthegridnyc.com", font=small_font, fill=(120, 116, 108))
    img.save(path, "PNG", optimize=True)


def main() -> int:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    mark(512).save(IMG_DIR / "icon-512.png", "PNG", optimize=True)
    mark(192).save(IMG_DIR / "icon-192.png", "PNG", optimize=True)
    mark(180).save(IMG_DIR / "apple-touch-icon.png", "PNG", optimize=True)
    mark(64).save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    social_card(IMG_DIR / "og-default.png")
    print("Wrote icons to assets/img, favicon.ico and assets/img/og-default.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
