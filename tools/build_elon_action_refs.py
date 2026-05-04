#!/usr/bin/env python3
"""Build KOF/SF action reference sheets and per-frame crops for Elon regeneration."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/wangnov/AI-fight")
SRC_DIR = ROOT / "tools/asset_refs/action_refs"
OUT_DIR = SRC_DIR / "elon_action_refs"

KYO = SRC_DIR / "kof_kyo_cleanpng.webp"
RYU = SRC_DIR / "ryu_full_sheet.png"


def label_image(im: Image.Image, label: str) -> Image.Image:
    out = im.convert("RGBA")
    draw = ImageDraw.Draw(out)
    draw.rectangle((0, 0, out.width, 24), fill=(0, 0, 0, 210))
    draw.text((6, 5), label, fill=(255, 255, 255, 255), font=ImageFont.load_default())
    return out


def pad_crop(src: Image.Image, box: tuple[int, int, int, int], label: str) -> Image.Image:
    crop = src.crop(box).convert("RGBA")
    canvas = Image.new("RGBA", (256, 256), (244, 244, 244, 255))
    # Preserve action pixels, not resolution; nearest keeps the action shape sharp.
    scale = min(220 / crop.width, 210 / crop.height)
    crop = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.NEAREST,
    )
    canvas.alpha_composite(crop, ((256 - crop.width) // 2, 32 + (200 - crop.height) // 2))
    return label_image(canvas, label)


def grow(box: tuple[int, int, int, int], pad: int = 6) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    return (max(0, x1 - pad), max(0, y1 - pad), x2 + pad, y2 + pad)


def make_sheet(name: str, frames: list[tuple[str, Image.Image]]) -> None:
    cell_w, cell_h = 256, 256
    sheet = Image.new("RGBA", (cell_w * len(frames), cell_h), (235, 235, 235, 255))
    for i, (_label, frame) in enumerate(frames):
        sheet.alpha_composite(frame, (i * cell_w, 0))
        if i:
            ImageDraw.Draw(sheet).line((i * cell_w, 0, i * cell_w, cell_h), fill=(0, 0, 0, 180), width=2)
    sheet.convert("RGB").save(OUT_DIR / f"{name}_sheet.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    kyo = Image.open(KYO).convert("RGBA")
    ryu = Image.open(RYU).convert("RGBA")

    # Crops are intentionally coarse enough to show neighboring timing context,
    # but each key also gets a focused per-frame crop.
    specs: dict[str, list[tuple[str, Image.Image]]] = {
        "walk": [
            ("walk_01", pad_crop(kyo, grow((2, 249, 34, 328)), "walk_01 contact")),
            ("walk_02", pad_crop(kyo, grow((37, 249, 75, 325)), "walk_02 pass")),
            ("walk_03", pad_crop(kyo, grow((78, 249, 108, 331)), "walk_03 contact")),
            ("walk_04", pad_crop(kyo, grow((110, 249, 150, 327)), "walk_04 pass")),
        ],
        "jab": [
            ("jab_01", pad_crop(kyo, grow((344, 613, 394, 683)), "jab_01 guard")),
            ("jab_02", pad_crop(kyo, grow((398, 613, 450, 689)), "jab_02 extend")),
            ("jab_03", pad_crop(kyo, grow((453, 613, 505, 685)), "jab_03 recover")),
        ],
        "combo1": [
            ("orbit_cast", pad_crop(ryu, (60, 22, 155, 100), "combo1 cast")),
            ("orbit_throw", pad_crop(ryu, (155, 22, 250, 100), "combo1 release")),
        ],
        "combo2": [
            ("rocket_windup", pad_crop(kyo, grow((2, 421, 49, 483)), "combo2 windup")),
            ("rocket_swing", pad_crop(kyo, grow((344, 765, 374, 867)), "combo2 swing")),
        ],
        "states": [
            ("idle_02", pad_crop(kyo, (0, 0, 52, 82), "idle variant")),
            ("jump", pad_crop(kyo, (0, 540, 66, 640), "jump")),
            ("crouch", pad_crop(kyo, (0, 314, 58, 390), "crouch")),
            ("block", pad_crop(kyo, (0, 0, 52, 82), "block guard")),
            ("hit", pad_crop(kyo, (470, 0, 560, 90), "hit recoil")),
            ("knockdown", pad_crop(kyo, (350, 280, 470, 370), "knockdown")),
            ("lose", pad_crop(kyo, (500, 280, 650, 370), "lose ground")),
            ("win", pad_crop(kyo, (450, 90, 540, 180), "win arms up")),
        ],
        "ultimate": [
            ("keynote_pose", pad_crop(kyo, (0, 840, 70, 925), "present pose")),
            ("countdown_pose", pad_crop(kyo, (0, 312, 58, 390), "low press")),
            ("launch_pose", pad_crop(kyo, (340, 758, 402, 840), "launch up")),
            ("recover", pad_crop(kyo, (58, 0, 112, 82), "recover guard")),
        ],
    }

    for action, frames in specs.items():
        make_sheet(action, frames)
        for key, image in frames:
            image.convert("RGB").save(OUT_DIR / f"{key}_ref.png")

    print(f"built refs -> {OUT_DIR}")


if __name__ == "__main__":
    main()
