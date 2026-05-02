#!/usr/bin/env python3
"""
切 sprite strip：给定 N×cell_w × cell_h 的 strip PNG，按等宽 N 切成 N 张 cell PNG，
对每张做 chroma-key 抠透明 (默认 magenta #ff00ff)，输出到目标目录。

参考 hatch-pet 的 extract_strip_frames.py：
- chroma key 用 numpy 矢量化距离阈值
- bbox crop + center fit 到目标 cell 尺寸（去除大块透明区）

用法:
    python tools/extract_strip.py \\
        --strip /tmp/altman_walk_strip.png \\
        --frames 4 \\
        --cell-w 768 --cell-h 1024 \\
        --out-prefix public/sprites/altman/altman_walk_ \\
        --start-index 1
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def remove_chroma(image: Image.Image, key: tuple[int, int, int], threshold: float) -> Image.Image:
    """numpy 矢量化抠 chroma key 背景：颜色距离 ≤ threshold 的像素 alpha 设为 0"""
    rgba = image.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[..., :3].astype(np.int32)
    key_arr = np.array(key, dtype=np.int32)
    dist = np.sqrt(((rgb - key_arr) ** 2).sum(axis=-1))
    arr[..., 3] = np.where(dist <= threshold, 0, arr[..., 3])
    return Image.fromarray(arr, "RGBA")


def fit_to_cell(image: Image.Image, cell_w: int, cell_h: int, padding: int = 8) -> Image.Image:
    """bbox crop + center fit。如果 sprite 比 cell 大就缩小，否则保持原尺寸居中。"""
    bbox = image.getbbox()
    target = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    if bbox is None:
        return target

    sprite = image.crop(bbox)
    max_w = cell_w - padding * 2
    max_h = cell_h - padding * 2
    scale = min(max_w / sprite.width, max_h / sprite.height, 1.0)
    if scale < 1.0:
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
    left = (cell_w - sprite.width) // 2
    top = (cell_h - sprite.height) // 2
    target.alpha_composite(sprite, (left, top))
    return target


def parse_hex(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strip", required=True, help="输入 strip PNG 路径")
    ap.add_argument("--frames", type=int, required=True)
    ap.add_argument("--cell-w", type=int, required=True)
    ap.add_argument("--cell-h", type=int, required=True)
    ap.add_argument(
        "--out-prefix",
        required=True,
        help="输出文件名前缀，如 public/sprites/altman/altman_walk_",
    )
    ap.add_argument("--start-index", type=int, default=1, help="第一帧的编号 (默认 1)")
    ap.add_argument(
        "--digits", type=int, default=2, help="编号位数 (默认 2: 01, 02, ...)"
    )
    ap.add_argument("--chroma", default="#ff00ff", help="chroma key 颜色，默认 magenta")
    ap.add_argument("--threshold", type=float, default=60.0, help="chroma 距离阈值")
    ap.add_argument(
        "--no-fit",
        action="store_true",
        help="不做 bbox crop+fit（保留 strip 原始 cell 切片，仅抠透明）",
    )
    args = ap.parse_args()

    strip = Image.open(args.strip).convert("RGBA")
    expected_w = args.frames * args.cell_w
    if strip.width != expected_w or strip.height != args.cell_h:
        print(
            f"WARNING: strip is {strip.width}x{strip.height}, "
            f"expected {expected_w}x{args.cell_h}; will rescale to expected"
        )
        strip = strip.resize((expected_w, args.cell_h), Image.Resampling.LANCZOS)

    chroma = parse_hex(args.chroma)
    out_prefix = Path(args.out_prefix)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)

    for i in range(args.frames):
        left = i * args.cell_w
        cell = strip.crop((left, 0, left + args.cell_w, args.cell_h))
        cell = remove_chroma(cell, chroma, args.threshold)
        if not args.no_fit:
            cell = fit_to_cell(cell, args.cell_w, args.cell_h)
        idx = args.start_index + i
        out_path = Path(f"{args.out_prefix}{idx:0{args.digits}d}.png")
        cell.save(out_path)
        print(f"[extract_strip] frame {idx} -> {out_path}")


if __name__ == "__main__":
    main()
