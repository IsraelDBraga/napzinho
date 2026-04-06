#!/usr/bin/env python3
"""Generate PWA icons for Napzinho (purple gradient + moon)."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG_TOP = (83, 74, 183)
BG_BOT = (127, 119, 221)


def make_icon(size: int, safe: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.08) if safe else 0
    box = [pad, pad, size - pad - 1, size - pad - 1]
    for y in range(box[1], box[3] + 1):
        t = (y - box[1]) / max(1, box[3] - box[1])
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        draw.line([(box[0], y), (box[2], y)], fill=(r, g, b, 255))
    # Moon: white circle + smaller purple circle offset (crescent illusion)
    cx, cy = size // 2, size // 2
    r = int(size * 0.2)
    off = int(size * 0.07)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 250, 245, 255))
    draw.ellipse([cx - r + off, cy - r - off // 3, cx + r + off, cy + r - off // 3], fill=(BG_BOT[0], BG_BOT[1], BG_BOT[2], 255))
    return img


def main():
    make_icon(192, False).save(OUT / "icon-192.png")
    make_icon(512, False).save(OUT / "icon-512.png")
    make_icon(512, True).save(OUT / "maskable-512.png")
    make_icon(180, False).save(OUT / "apple-touch-icon.png")
    print("Wrote icons to", OUT)


if __name__ == "__main__":
    main()
