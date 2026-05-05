#!/usr/bin/env python3
"""
Normalize Elon Mask sprites using several checks, not raw alpha bbox alone:

1. material bbox: alpha >= 64, so weak glow/fringe pixels do not define scale.
2. semantic caps: crouch/jump/knockdown/ultimate low poses have their own max height.
3. horizontal cap: Elon frames generated too wide, so cap material width without
   shrinking standing height.
4. ground alignment: material bbox bottom lands on a consistent baseline.

This is intentionally character-specific because it compensates for the current
Elon generation batch rather than redefining the whole project's sprite rules.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class FrameRule:
    max_material_w: int
    max_material_h: int
    bottom_padding: int = 24
    center_x: int = 512
    min_material_h: int | None = None
    preserve_aspect: bool = False


DEFAULT_RULE = FrameRule(max_material_w=640, max_material_h=910, min_material_h=880)
RULES: dict[str, FrameRule] = {
    "idle_01": FrameRule(max_material_w=640, max_material_h=910, min_material_h=880),
    "idle_02": FrameRule(max_material_w=640, max_material_h=910, min_material_h=880),
    "block": FrameRule(max_material_w=600, max_material_h=910, min_material_h=880),
    "walk_01": FrameRule(max_material_w=560, max_material_h=910, min_material_h=880),
    "walk_02": FrameRule(max_material_w=560, max_material_h=910, min_material_h=880),
    "walk_03": FrameRule(max_material_w=560, max_material_h=910, min_material_h=880),
    "walk_04": FrameRule(max_material_w=560, max_material_h=910, min_material_h=880),
    "jab_01": FrameRule(max_material_w=620, max_material_h=910, min_material_h=880),
    "jab_02": FrameRule(max_material_w=660, max_material_h=910, min_material_h=880),
    "jab_03": FrameRule(max_material_w=620, max_material_h=910, min_material_h=880),
    # Low grounded poses must read low and must touch the ground line.
    "crouch": FrameRule(max_material_w=620, max_material_h=760, min_material_h=740),
    "countdown_pose": FrameRule(max_material_w=620, max_material_h=760, min_material_h=720),
    "rocket_windup": FrameRule(max_material_w=650, max_material_h=820, min_material_h=780),
    "orbit_cast": FrameRule(max_material_w=700, max_material_h=840, min_material_h=820),
    "orbit_throw": FrameRule(max_material_w=700, max_material_h=860, min_material_h=840),
    # Airborne poses should not stay full standing height.
    "jump": FrameRule(max_material_w=600, max_material_h=660, min_material_h=635),
    "launch_pose": FrameRule(max_material_w=600, max_material_h=870, min_material_h=850),
    "rocket_swing": FrameRule(max_material_w=600, max_material_h=860, min_material_h=840),
    # Grounded defeat poses are intentionally wide and low.
    # Defeat poses must stay anatomical. Non-uniform scale makes the body look
    # horizontally stretched, which is very visible in-ground.
    "knockdown": FrameRule(
        max_material_w=950,
        max_material_h=430,
        min_material_h=395,
        preserve_aspect=True,
    ),
    "lose": FrameRule(
        max_material_w=900,
        max_material_h=500,
        min_material_h=440,
        preserve_aspect=True,
    ),
}


def bbox_from_alpha(alpha: np.ndarray, threshold: int) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha >= threshold)
    if xs.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def expand_box(
    box: tuple[int, int, int, int],
    pad: int,
    width: int,
    height: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    return max(0, x1 - pad), max(0, y1 - pad), min(width, x2 + pad), min(height, y2 + pad)


def composite_clipped(out: Image.Image, src: Image.Image, x: int, y: int) -> None:
    """Composite src even when its soft fringe extends outside the output cell."""
    dst_x1 = max(0, x)
    dst_y1 = max(0, y)
    dst_x2 = min(out.width, x + src.width)
    dst_y2 = min(out.height, y + src.height)
    if dst_x1 >= dst_x2 or dst_y1 >= dst_y2:
        return

    src_x1 = dst_x1 - x
    src_y1 = dst_y1 - y
    src_x2 = src_x1 + (dst_x2 - dst_x1)
    src_y2 = src_y1 + (dst_y2 - dst_y1)
    out.alpha_composite(src.crop((src_x1, src_y1, src_x2, src_y2)), (dst_x1, dst_y1))


def scrub_transparent_rgb(image: Image.Image) -> Image.Image:
    arr = np.array(image)
    # The transparent verifier treats alpha <= 5 as effectively transparent.
    # Clear those RGB values too so compression cannot preserve colored fringe.
    arr[arr[:, :, 3] <= 5, :3] = 0
    return Image.fromarray(arr, "RGBA")


def normalize_one(path: Path, rule: FrameRule, dry_run: bool) -> str:
    image = Image.open(path).convert("RGBA")
    arr = np.array(image)
    alpha = arr[:, :, 3]
    material = bbox_from_alpha(alpha, 64)
    if material is None:
        return f"SKIP {path.name}: empty"

    # Crop from the material body plus padding. Using alpha>=1 here would let
    # faint extraction halos define the crop, which is exactly what made low
    # poses fail to land on the ground line.
    full = expand_box(material, 14, image.width, image.height)
    mat_x1, mat_y1, mat_x2, mat_y2 = material
    mat_w = mat_x2 - mat_x1
    mat_h = mat_y2 - mat_y1

    sx = min(1.0, rule.max_material_w / mat_w)
    sy = min(1.0, rule.max_material_h / mat_h)
    if rule.preserve_aspect:
        scale = min(sx, sy)
        sx = scale
        sy = scale

    crop = image.crop(full)
    new_w = max(1, round(crop.width * sx))
    new_h = max(1, round(crop.height * sy))
    resized = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

    resized_alpha = np.array(resized)[:, :, 3]
    visible = bbox_from_alpha(resized_alpha, 8)
    if visible is not None:
        visible = expand_box(visible, 2, resized.width, resized.height)
        resized = resized.crop(visible)
        new_w, new_h = resized.size
        resized_alpha = np.array(resized)[:, :, 3]

    resized_material = bbox_from_alpha(resized_alpha, 64)
    if resized_material is None:
        return f"SKIP {path.name}: vanished"

    if rule.min_material_h is not None:
        rmx1, rmy1, rmx2, rmy2 = resized_material
        resized_mat_w = rmx2 - rmx1
        resized_mat_h = rmy2 - rmy1
        if resized_mat_h < rule.min_material_h:
            grow = rule.min_material_h / resized_mat_h
            grow = min(grow, rule.max_material_h / resized_mat_h)
            grow = min(grow, rule.max_material_w / resized_mat_w)
            if grow > 1.001:
                resized = resized.resize(
                    (
                        max(1, round(resized.width * grow)),
                        max(1, round(resized.height * grow)),
                    ),
                    Image.Resampling.LANCZOS,
                )
                new_w, new_h = resized.size
                resized_alpha = np.array(resized)[:, :, 3]
                resized_material = bbox_from_alpha(resized_alpha, 64)
                if resized_material is None:
                    return f"SKIP {path.name}: vanished after grow"

    rmx1, rmy1, rmx2, rmy2 = resized_material
    desired_bottom = image.height - rule.bottom_padding
    desired_center = rule.center_x
    paste_x = round(desired_center - (rmx1 + rmx2) / 2)
    paste_y = round(desired_bottom - rmy2)

    # The gameplay anchor is the material body, not the faint extraction fringe.
    # Keep material pixels inside the frame, but allow low-alpha halo/crop slack
    # to be clipped so grounded poses can actually land on the baseline.
    if paste_x + rmx1 < 0:
        paste_x = -rmx1
    if paste_x + rmx2 > image.width:
        paste_x = image.width - rmx2
    if paste_y + rmy1 < 0:
        paste_y = -rmy1
    if paste_y + rmy2 > image.height:
        paste_y = image.height - rmy2

    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    composite_clipped(out, resized, paste_x, paste_y)
    out = scrub_transparent_rgb(out)

    after_alpha = np.array(out)[:, :, 3]
    after_material = bbox_from_alpha(after_alpha, 64)
    if after_material is None:
        return f"SKIP {path.name}: output empty"
    ax1, ay1, ax2, ay2 = after_material
    after_w = ax2 - ax1
    after_h = ay2 - ay1
    after_bottom = image.height - ay2

    if not dry_run:
        out.save(path)

    changed = sx < 0.999 or sy < 0.999 or abs(after_bottom - rule.bottom_padding) > 1
    prefix = "FIX" if changed else "OK "
    return (
        f"{prefix} {path.name}: material {mat_w}x{mat_h} -> "
        f"{after_w}x{after_h}, scale=({sx:.3f},{sy:.3f}), bottom={after_bottom}"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="/Users/wangnov/AI-fight/public/sprites/elon")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sprite_dir = Path(args.dir)
    for path in sorted(sprite_dir.glob("elon_*.png")):
        key = path.stem.removeprefix("elon_")
        rule = RULES.get(key, DEFAULT_RULE)
        print(normalize_one(path, rule, args.dry_run))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
