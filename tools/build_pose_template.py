#!/usr/bin/env python3
"""
合成 strip 模板，每 slot 是 base sprite（半透明）+ 火柴人骨架（醒目覆盖）：
  - base 作身份基础（角色脸/服装/风格的视觉提示）
  - skeleton 强制姿态目标（每帧的肢体位置）
  - magenta 底（chroma key 抠透明）

输出尺寸跟原模板一致：N × cell_w × cell_h（如 2×1024×1024 = 2048×1024）。

用法:
    python tools/build_pose_template.py \\
        --base public/sprites/altman/altman_idle_01.png \\
        --skel tools/_skeleton/altman_walk_a_skel.png \\
        --out /tmp/altman_walk_a_pose_template.png
"""

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True, help='base sprite (idle_01)')
    ap.add_argument('--skel', required=True, help='skeleton strip PNG')
    ap.add_argument('--out', required=True)
    ap.add_argument('--base-alpha', type=float, default=0.35,
                     help='base 在 cell 内的透明度（0=不显示，1=完全显示）')
    args = ap.parse_args()

    skel = Image.open(args.skel).convert('RGBA')
    strip_w, strip_h = skel.size
    # 推断 frame 数量：skel 是 N × 1024 宽
    cell_w = 1024
    n_frames = strip_w // cell_w
    cell_h = strip_h
    if strip_w % cell_w != 0:
        raise SystemExit(f'skel width {strip_w} 不是 1024 的整数倍')

    # magenta 底
    composed = Image.new('RGBA', (strip_w, strip_h), (255, 0, 255, 255))

    # base 处理
    base_orig = Image.open(args.base).convert('RGBA')
    bbox = base_orig.getbbox()
    if bbox:
        base_crop = base_orig.crop(bbox)
    else:
        base_crop = base_orig
    # 缩到 cell 内（保持 0.85 ratio 留 padding）
    target_h = int(cell_h * 0.85)
    scale = target_h / base_crop.height
    new_w = max(1, round(base_crop.width * scale))
    new_h = max(1, round(base_crop.height * scale))
    base_resized = base_crop.resize((new_w, new_h), Image.Resampling.LANCZOS)
    # 应用 base alpha
    if args.base_alpha < 1.0:
        a = base_resized.split()[3]
        a = a.point(lambda v: int(v * args.base_alpha))
        base_resized.putalpha(a)

    # 在每个 slot 内画 base 居中底部对齐
    for i in range(n_frames):
        x = i * cell_w + (cell_w - new_w) // 2
        y = cell_h - new_h - 24  # bottom padding
        composed.alpha_composite(base_resized, (x, y))

    # 骨架叠在最上层（skel PNG 已经是黑底 + 白线，把黑底过滤掉只留线条）
    # 处理：skel 的暗色像素视作透明，亮色保留
    skel_arr = skel.load()
    for y in range(strip_h):
        for x in range(strip_w):
            r, g, b, a = skel_arr[x, y]
            # 黑底 (10,10,20) → 转透明；亮色（线 255,255,255 + 关节有色彩）→ 保留
            brightness = max(r, g, b)
            if brightness < 30:
                skel_arr[x, y] = (r, g, b, 0)
            else:
                # 高亮像素 → 完全不透明的描边
                skel_arr[x, y] = (r, g, b, 255)

    composed.alpha_composite(skel)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    composed.convert('RGB').save(out, 'PNG')
    print(f'  → {out}')


if __name__ == '__main__':
    main()
