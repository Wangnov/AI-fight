#!/usr/bin/env python3
"""
统一所有 character sprite 的"人物 bbox 高度":
  - 检测 alpha 非透明区域的 bbox
  - 按 bbox 高度缩放到 cell 高的指定 ratio (默认 88%)
  - 在新 cell 里水平居中、底部对齐到 cell 底（保留 bottom_padding）

这样 Fighter 用 anchor (0.5, 1) + 统一 scale 时，所有动作的人物
看起来高度一致、脚底位置一致，不会出现 idle 巨人 / walk 矮子的脱节。

用法:
    python tools/normalize_sprite.py --dir public/sprites/altman
    python tools/normalize_sprite.py --dir public/sprites/dario
"""

import argparse
import sys
from pathlib import Path
from PIL import Image


def normalize(
    src: Path,
    dst: Path,
    cell_size: int = 1024,
    target_height_ratio: float = 0.88,
    bottom_padding: int = 24,
) -> tuple[int, int, int, int]:
    """返回 (orig_h, new_h, scale_pct, bbox_y_offset)"""
    img = Image.open(src).convert('RGBA')
    if img.size != (cell_size, cell_size):
        # 不强制 cell_size，但记录
        cell_w, cell_h = img.size
    else:
        cell_w, cell_h = cell_size, cell_size

    bbox = img.getbbox()
    if not bbox:
        # 全透明，跳过
        img.save(dst)
        return (0, 0, 100, 0)

    left, top, right, bottom = bbox
    crop_w = right - left
    crop_h = bottom - top
    crop = img.crop(bbox)

    target_h = int(cell_h * target_height_ratio)
    scale = target_h / crop_h
    new_w = max(1, round(crop_w * scale))
    new_h = max(1, round(crop_h * scale))
    resized = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

    out = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
    x = (cell_w - new_w) // 2
    y = cell_h - new_h - bottom_padding
    if y < 0:
        y = 0
    out.alpha_composite(resized, (x, y))
    out.save(dst)
    return (crop_h, new_h, int(scale * 100), top)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True, help='character sprite 目录')
    ap.add_argument(
        '--target-ratio', type=float, default=0.88, help='人物 bbox 占 cell 高的比例（默认 0.88）'
    )
    ap.add_argument(
        '--bottom-padding', type=int, default=24, help='cell 底部留白（默认 24）'
    )
    ap.add_argument(
        '--exclude',
        nargs='*',
        default=['knockdown', 'lose', 'sit_down', 'lean_back'],
        help='跳过这些 frame keys（这些 pose 本身就是低姿态，标准化会扭曲）',
    )
    ap.add_argument(
        '--in-place', action='store_true', help='覆盖原文件（默认输出到 _normalized/）'
    )
    args = ap.parse_args()

    src_dir = Path(args.dir)
    if not src_dir.is_dir():
        print(f'not a dir: {src_dir}', file=sys.stderr)
        return 1

    pngs = sorted(p for p in src_dir.glob('*.png') if not p.name.startswith('_'))

    if args.in_place:
        out_dir = src_dir
    else:
        out_dir = src_dir.parent / f'{src_dir.name}_normalized'
        out_dir.mkdir(exist_ok=True)

    for src in pngs:
        # 跳过低姿态帧（normalize 会让"倒地"姿势变高大不合理）
        skip = any(ex in src.stem for ex in args.exclude)
        if skip:
            print(f'  SKIP {src.name} (low-pose frame)')
            if not args.in_place:
                # 也复制过去保持完整集
                Image.open(src).save(out_dir / src.name)
            continue
        dst = out_dir / src.name
        result = normalize(src, dst, target_height_ratio=args.target_ratio, bottom_padding=args.bottom_padding)
        print(f'  NORM {src.name}: {result[0]}px → {result[1]}px ({result[2]}% scale)')

    print(f'\nDone -> {out_dir}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
