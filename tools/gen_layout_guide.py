#!/usr/bin/env python3
"""
生成多帧 sprite strip 的 layout guide PNG，作为 images edit 的 layout-only input。

参考 hatch-pet 的 create_layout_guide：每帧画外框 + 安全区 + 中心十字虚线。
AI 看到这张图就被强制按 N 个等宽 slot 分布 N 个 pose，避免自由发挥构图。

prompt 要明确说"this guide is layout-only, do not draw the boxes/lines into output"，
不然 AI 会照抄网格线到生成结果里。

用法:
    python tools/gen_layout_guide.py walk 4 768 1024
        生成 walk row 4 帧布局图，cell 768x1024，输出到
        tools/layout_guides/walk.png
"""

import sys
from pathlib import Path
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GUIDE_DIR = PROJECT_ROOT / "tools" / "layout_guides"

SAFE_MARGIN_X = 60
SAFE_MARGIN_Y = 80


def draw_dashed_line(
    draw: ImageDraw.ImageDraw,
    p1: tuple[int, int],
    p2: tuple[int, int],
    fill: str,
    dash: int = 12,
    gap: int = 8,
    width: int = 2,
) -> None:
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        return
    step = dash + gap
    n = int(length // step) + 1
    for i in range(n):
        t1 = (i * step) / length
        t2 = min(1.0, (i * step + dash) / length)
        sx = x1 + dx * t1
        sy = y1 + dy * t1
        ex = x1 + dx * t2
        ey = y1 + dy * t2
        draw.line([(sx, sy), (ex, ey)], fill=fill, width=width)


def gen_layout_guide(
    state: str, frames: int, cell_w: int, cell_h: int, output: Path | None = None
) -> Path:
    width = frames * cell_w
    height = cell_h
    img = Image.new("RGB", (width, height), "#f7f7f7")
    draw = ImageDraw.Draw(img)

    for i in range(frames):
        left = i * cell_w
        right = left + cell_w - 1

        # 外框 (黑实线)
        draw.rectangle((left, 0, right, height - 1), outline="#111111", width=3)

        # 安全区 (蓝虚线): 内边距 SAFE_MARGIN_X / Y
        sl = left + SAFE_MARGIN_X
        st = SAFE_MARGIN_Y
        sr = right - SAFE_MARGIN_X
        sb = height - 1 - SAFE_MARGIN_Y
        # 用蓝色实线画安全区 (PIL 没有 dashed rectangle)
        draw.rectangle((sl, st, sr, sb), outline="#2f80ed", width=2)

        # 中心十字 (灰虚线)
        cx = left + cell_w // 2
        cy = height // 2
        draw_dashed_line(draw, (cx, st), (cx, sb), "#b8b8b8")
        draw_dashed_line(draw, (sl, cy), (sr, cy), "#b8b8b8")

    output = output or (GUIDE_DIR / f"{state}.png")
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output)
    print(
        f"[gen_layout_guide] {state}: {frames} frames {cell_w}x{cell_h}, "
        f"strip {width}x{height} -> {output}"
    )
    return output


def main() -> None:
    if len(sys.argv) < 5:
        print("Usage: gen_layout_guide.py STATE FRAMES CELL_W CELL_H", file=sys.stderr)
        sys.exit(1)
    state = sys.argv[1]
    frames = int(sys.argv[2])
    cell_w = int(sys.argv[3])
    cell_h = int(sys.argv[4])
    if cell_w * frames > 3840:
        print(
            f"WARNING: strip width {cell_w * frames}px exceeds OpenAI 3840 max edge",
            file=sys.stderr,
        )
    gen_layout_guide(state, frames, cell_w, cell_h)


if __name__ == "__main__":
    main()
