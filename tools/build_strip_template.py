#!/usr/bin/env python3
"""
合成 strip 模板：把 base sprite 复制 N 份贴入 layout guide 的 N 个 slot，
作为 images edit 的单 ref-image 输入。

这是 hatch-pet 多 ref 路径在我们 CLI 仅支持单 ref 时的折中方案：
AI 看到"layout 网格 + 每 slot 已经是 base 角色"，只需要 pose-edit 就能
输出 N 帧 strip，比纯空 layout guide 锁身份效果更强。

用法:
    python tools/build_strip_template.py \\
        --base public/sprites/altman/altman_idle_01.png \\
        --layout tools/layout_guides/walk.png \\
        --frames 4 --cell-w 768 --cell-h 1024 \\
        --out /tmp/altman_walk_template.png
"""

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="base sprite PNG (透明背景或 magenta)")
    ap.add_argument("--layout", required=True, help="layout guide PNG")
    ap.add_argument("--frames", type=int, required=True)
    ap.add_argument("--cell-w", type=int, required=True)
    ap.add_argument("--cell-h", type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--padding",
        type=int,
        default=80,
        help="base 在 cell 内的 padding（每边），默认 80",
    )
    args = ap.parse_args()

    layout = Image.open(args.layout).convert("RGB")
    expected_w = args.frames * args.cell_w
    if layout.size != (expected_w, args.cell_h):
        raise SystemExit(
            f"layout {layout.size} != expected ({expected_w}, {args.cell_h})"
        )

    # 用 magenta 重画底（替换 layout 的灰底），方便 AI 理解为 chroma key 背景
    template = Image.new("RGB", layout.size, "#ff00ff")

    base = Image.open(args.base).convert("RGBA")
    # 把 base 缩放到 cell 大小（保持纵横比，留 padding）
    max_w = args.cell_w - args.padding * 2
    max_h = args.cell_h - args.padding * 2
    bbox = base.getbbox()
    if bbox:
        base_cropped = base.crop(bbox)
    else:
        base_cropped = base
    scale = min(max_w / base_cropped.width, max_h / base_cropped.height, 1.0)
    if scale < 1.0:
        new_size = (
            max(1, round(base_cropped.width * scale)),
            max(1, round(base_cropped.height * scale)),
        )
        base_cropped = base_cropped.resize(new_size, Image.Resampling.LANCZOS)

    # 在每个 slot 里粘 base
    for i in range(args.frames):
        left = i * args.cell_w + (args.cell_w - base_cropped.width) // 2
        top = (args.cell_h - base_cropped.height) // 2
        # alpha 合成到 magenta 底
        rgba_target = Image.new("RGBA", layout.size, (255, 0, 255, 255))
        rgba_target.alpha_composite(template.convert("RGBA"))
        # 逐个粘贴
    # 上面循环做错了，重写
    composed = Image.new("RGBA", layout.size, (255, 0, 255, 255))
    for i in range(args.frames):
        left = i * args.cell_w + (args.cell_w - base_cropped.width) // 2
        top = (args.cell_h - base_cropped.height) // 2
        composed.alpha_composite(base_cropped, (left, top))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    composed.convert("RGB").save(out, "PNG")
    print(f"[build_strip_template] {args.frames}x {args.cell_w}x{args.cell_h} -> {out}")


if __name__ == "__main__":
    main()
