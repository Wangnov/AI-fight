#!/usr/bin/env python3
"""
单帧 pose-driven ref：左半 1024×1024 骨架 + 右半 1024×1024 base 角色，
横向拼接成 2048×1024 ref 图。配合简洁 prompt 让 AI 转换右侧角色到左侧姿势。

跟 build_pose_template.py 不同：
- 不叠加，避免 AI 视觉冲突
- 单帧输出（每次 generate 出 1 帧 sprite）
- 用户实测此方法在 GPT-image-2 上可工作

用法:
    python tools/build_pose_ref.py \\
        --base public/sprites/altman/altman_idle_01.png \\
        --skel-frame 1 --char altman \\
        --out /tmp/altman_walk_01_ref.png
"""

import argparse
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from walk_skeleton import (
    get_walk_cycle, get_jab_sequence,
    render_frame, CELL_W, CELL_H, JOINT_COLORS, SKELETON_LINES,
)


def render_single_skeleton(frame_kp: dict, out: Path) -> None:
    img = Image.new('RGB', (CELL_W, CELL_H), (0, 0, 0))
    render_frame(frame_kp, img, offset_x=0)
    img.save(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True)
    ap.add_argument('--action', default='walk', choices=['walk', 'jab'])
    ap.add_argument('--skel-frame', type=int, required=True,
                     help='walk: 1..8; jab: 1..3')
    ap.add_argument('--char', required=True, choices=['altman', 'dario'])
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    facing = 'right' if args.char == 'altman' else 'left'
    if args.action == 'walk':
        cycle = get_walk_cycle(facing)
        if not (1 <= args.skel_frame <= 8):
            raise SystemExit('walk skel-frame must be 1..8')
    else:
        cycle = get_jab_sequence(facing)
        if not (1 <= args.skel_frame <= 3):
            raise SystemExit('jab skel-frame must be 1..3')
    frame_kp = cycle[args.skel_frame - 1]

    # 1. 渲染单帧骨架 1024×1024
    skel_img = Image.new('RGB', (CELL_W, CELL_H), (0, 0, 0))
    render_frame(frame_kp, skel_img)

    # 2. 准备 base 角色 1024×1024（保持 magenta 底）
    base = Image.open(args.base).convert('RGBA')
    bbox = base.getbbox()
    if bbox:
        base_crop = base.crop(bbox)
    else:
        base_crop = base
    target_h = int(CELL_H * 0.85)
    scale = target_h / base_crop.height
    new_w, new_h = max(1, round(base_crop.width * scale)), max(1, round(base_crop.height * scale))
    base_resized = base_crop.resize((new_w, new_h), Image.Resampling.LANCZOS)
    base_panel = Image.new('RGBA', (CELL_W, CELL_H), (255, 0, 255, 255))
    base_panel.alpha_composite(
        base_resized,
        ((CELL_W - new_w) // 2, CELL_H - new_h - 24),
    )

    # 3. 横向拼接 2048×1024
    out_img = Image.new('RGB', (CELL_W * 2, CELL_H), (0, 0, 0))
    out_img.paste(skel_img, (0, 0))
    out_img.paste(base_panel.convert('RGB'), (CELL_W, 0))

    # 4. 加分隔线让两边更清楚
    draw = ImageDraw.Draw(out_img)
    draw.line([(CELL_W, 0), (CELL_W, CELL_H)], fill=(80, 80, 80), width=4)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out_img.save(out)
    print(f'  → {out}  ({out_img.size})')


if __name__ == '__main__':
    main()
