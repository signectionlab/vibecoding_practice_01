#!/usr/bin/env python3
"""그리드 스프라이트 시트를 캐릭터별 개별 PNG로 분할합니다."""

from PIL import Image
import os
import shutil

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "assets", "sprites")

SHEETS = {
    "정면.png": {"rows": 1, "cols": 2, "action": "front", "chars": ["bia", "or"]},
    "달리기.png": {"rows": 2, "cols": 5, "action": "run", "chars": ["bia", "or"]},
    "회복.png": {"rows": 1, "cols": 2, "action": "recover", "chars": ["bia", "or"]},
    "장애물.png": {"rows": 1, "cols": 2, "action": "hit", "chars": ["bia", "or"]},
}

PADDING = 8


def trim_with_padding(img, padding=PADDING):
    alpha = img.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(img.width, x1 + padding)
    y1 = min(img.height, y1 + padding)
    return img.crop((x0, y0, x1, y1))


def normalize_frames(frames):
    max_w = max(f.width for f in frames)
    max_h = max(f.height for f in frames)
    normalized = []
    for frame in frames:
        canvas = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 0))
        ox = (max_w - frame.width) // 2
        oy = (max_h - frame.height) // 2
        canvas.paste(frame, (ox, oy), frame)
        normalized.append(canvas)
    return normalized


def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG")
    print(f"  saved {os.path.relpath(path, BASE)} ({img.width}x{img.height})")


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)

    run_frames = {"bia": [], "or": []}

    for filename, cfg in SHEETS.items():
        path = os.path.join(BASE, filename)
        if not os.path.exists(path):
            print(f"Skip missing: {filename}")
            continue

        img = Image.open(path).convert("RGBA")
        w, h = img.size
        cell_w, cell_h = w // cfg["cols"], h // cfg["rows"]

        print(f"\nProcessing {filename} ({cfg['rows']}x{cfg['cols']})")

        for r in range(cfg["rows"]):
            for c in range(cfg["cols"]):
                char = cfg["chars"][r] if cfg["rows"] > 1 else cfg["chars"][c]
                x0, y0 = c * cell_w, r * cell_h
                cell = img.crop((x0, y0, x0 + cell_w, y0 + cell_h))
                trimmed = trim_with_padding(cell)

                if cfg["action"] == "run":
                    run_frames[char].append((c + 1, trimmed))
                else:
                    save_png(trimmed, os.path.join(OUT, char, f"{cfg['action']}.png"))

    for char, frames in run_frames.items():
        frames.sort(key=lambda x: x[0])
        normalized = normalize_frames([f[1] for f in frames])
        for i, frame in enumerate(normalized, start=1):
            save_png(frame, os.path.join(OUT, char, "run", f"{i:02d}.png"))

    print("\nDone!")


if __name__ == "__main__":
    main()
