#!/usr/bin/env python3
"""Generate the site-wide social preview cards, assets/og-card.png and assets/og-card-es.png (1200x630).

    python3 scripts/make_og_card.py

Needs Pillow and the Georgia fonts (present on macOS; set FONT_DIR if yours live elsewhere).
Edit the strings below to change the card, rerun, and commit the PNG. Social sites cache
cards, so after changing it, refresh the link in Facebook's Sharing Debugger.
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = os.environ.get("FONT_DIR", "/System/Library/Fonts/Supplemental/")

TITLE = ("Eyes on", "Hawkeye")
# per language: (file name, eyebrow, tagline lines). Keep in step with site_tagline in _data/i18n/*.yml.
CARDS = {
    "en": ("og-card.png", "COMMUNITY RECORDS PROJECT  ·  BELVIDERE, ILLINOIS", ("Belvidere’s data center,", "in the public record.")),
    "es": ("og-card-es.png", "PROYECTO COMUNITARIO DE REGISTROS  ·  BELVIDERE, ILLINOIS", ("El centro de datos de Belvidere,", "en el registro público.")),
}
DOMAIN = "eyesonhawkeye.com"

BG, ORANGE, CREAM = (22, 21, 15), (224, 89, 42), (250, 247, 242)   # same palette as the site's dark theme
MUTED, DIM = (190, 184, 172), (150, 144, 132)
S = 2  # draw at 2x, then downsample for smooth edges


def make(lang):
    filename, EYEBROW, TAGLINE = CARDS[lang]
    im = Image.new("RGB", (1200 * S, 630 * S), BG)
    d = ImageDraw.Draw(im)
    font = lambda name, size: ImageFont.truetype(FONT_DIR + name, size * S)

    def spaced(x, y, text, f, fill, track):
        for ch in text:
            d.text((x * S, y * S), ch, font=f, fill=fill)
            x += d.textlength(ch, font=f) / S + track

    d.rectangle([0, 0, 14 * S, 630 * S], fill=ORANGE)
    spaced(84, 92, EYEBROW, font("Georgia Bold.ttf", 24), ORANGE, 2.2)
    tf = font("Georgia Bold.ttf", 132)
    d.text((80 * S, 150 * S), TITLE[0], font=tf, fill=CREAM)
    d.text((80 * S, 282 * S), TITLE[1], font=tf, fill=CREAM)
    gf = font("Georgia Italic.ttf", 40)
    d.text((84 * S, 452 * S), TAGLINE[0], font=gf, fill=MUTED)
    d.text((84 * S, 502 * S), TAGLINE[1], font=gf, fill=MUTED)
    spaced(84, 566, DOMAIN, font("Georgia.ttf", 26), DIM, 1.5)

    # the ring-and-dot mark, same as the favicon
    cx, cy, r, w = 940 * S, 315 * S, 150 * S, 46 * S * 150 // 148
    d.ellipse([cx - r - w // 2, cy - r - w // 2, cx + r + w // 2, cy + r + w // 2], fill=ORANGE)
    d.ellipse([cx - r + w // 2, cy - r + w // 2, cx + r - w // 2, cy + r - w // 2], fill=BG)
    r2 = 72 * S
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=CREAM)

    out = ROOT / "assets" / filename
    im.resize((1200, 630), Image.LANCZOS).save(out, optimize=True)
    print(f"Wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


def main():
    for lang in CARDS:
        make(lang)


if __name__ == "__main__":
    main()
