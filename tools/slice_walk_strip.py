"""
切 walk strip 1024x1024 → 4 个 1024x1024 transparent walk frames

流程：
  1. chroma extract(magenta → transparent)
  2. alpha column projection 找 4 个 cluster bbox（鲁棒切片，不依赖严格 256 等分）
  3. 每个 cluster 居中 paste 到 1024x1024 canvas
  4. 朝向统一（如果某帧 head 在 cx 左侧 → 水平翻转使所有帧 face right）
  5. 高度等高 normalize（max bbox height）+ 底部对齐
"""
import sys, os
import numpy as np
from PIL import Image
import argparse

def chroma_to_alpha(rgb_im, remove_yellow=True, edge_clean_passes=2):
    """Magenta + (optional) yellow grid lines → transparent，
    并清理 anti-alias 边缘的 magenta 紫色残留像素。

    检测策略：
      1. 严格 magenta：R>180 & G<100 & B>180
      2. anti-alias magenta tint：R-G > 60 AND B-G > 60（紫色调像素）
      3. yellow grid line：R>200 & G>180 & B<80
      4. edge erosion：1 像素 morphological erode 收掉 sub-pixel 边
    """
    arr = np.array(rgb_im.convert("RGB")).astype(np.int16)
    R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]

    is_mag = (R > 180) & (G < 100) & (B > 180)
    # anti-alias magenta tint: 紫色调（R 和 B 都比 G 高很多）
    is_purple_tint = (R - G > 60) & (B - G > 60) & (R > 120) & (B > 120)
    bg = is_mag | is_purple_tint

    if remove_yellow:
        is_yellow = (R > 200) & (G > 180) & (B < 80)
        bg = bg | is_yellow

    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # 1px erosion 干掉残留边
    for _ in range(edge_clean_passes):
        a_im = Image.fromarray(alpha, "L")
        from PIL import ImageFilter
        a_im = a_im.filter(ImageFilter.MinFilter(3))  # 3x3 erode
        alpha = np.array(a_im)

    rgba = np.dstack([arr.astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


def cleanup_magenta_tint(rgba_im):
    """Resize 后的最终 cleanup: 把 alpha 边缘 magenta-tinted 像素 alpha 归零 + despill 残余紫调。"""
    arr = np.array(rgba_im).astype(np.int16)
    R, G, B, A = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    # 强 magenta tint: alpha 设 0
    strong = (R - G > 80) & (B - G > 80) & (R > 140) & (B > 140) & (A > 0)
    arr[strong, 3] = 0
    # 弱 magenta tint: despill（把 R 和 B clip 到 G+40）+ alpha 减半
    weak = (R - G > 30) & (B - G > 30) & (R > 100) & (B > 100) & (A > 0) & ~strong
    arr[weak, 0] = np.minimum(arr[weak, 0], arr[weak, 1] + 40)
    arr[weak, 2] = np.minimum(arr[weak, 2], arr[weak, 1] + 40)
    arr[weak, 3] = arr[weak, 3] // 2
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA")


def find_yellow_separators(rgb_im, expected_xs=(256, 512, 768), tol_x=40):
    """
    在 RGB 图里找 yellow 竖线位置（YELLOW = (255, ~240, 0)）
    返回 yellow 中心 x 列表，按位置排序
    """
    arr = np.array(rgb_im.convert("RGB"))
    # yellow mask: R>200, G>180, B<80
    ymask = (arr[..., 0] > 200) & (arr[..., 1] > 180) & (arr[..., 2] < 80)
    col_yellow = ymask.sum(axis=0)
    # 找 col_yellow 高峰（>100 像素 yellow per col）
    peaks = []
    in_peak = False
    start = 0
    for x in range(len(col_yellow)):
        if col_yellow[x] > 100 and not in_peak:
            start = x; in_peak = True
        elif col_yellow[x] <= 100 and in_peak:
            peaks.append((start + x) // 2)
            in_peak = False
    if in_peak:
        peaks.append((start + len(col_yellow)) // 2)
    print(f"  yellow peaks found at: {peaks}")
    return peaks

def find_clusters(rgba, n=4, gap_thresh=8):
    """
    用 alpha column projection 找 n 个非空 cluster
    返回 [(x0, x1), ...]
    """
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    col_sum = alpha.sum(axis=0)
    threshold = col_sum.max() * 0.03
    is_filled = col_sum > threshold
    # 找连续 True 段
    segments = []
    start = None
    for x in range(len(is_filled)):
        if is_filled[x] and start is None:
            start = x
        elif not is_filled[x] and start is not None:
            if x - start >= gap_thresh:  # 段够长才算
                segments.append((start, x))
            else:
                pass
            start = None
    if start is not None:
        segments.append((start, len(is_filled)))
    return segments

def head_offset(rgba):
    """
    检测人物头部相对身体中心的水平偏移（>0 = head 在右 = face right）
    """
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    bbox_mask = alpha > 0
    if not bbox_mask.any(): return 0
    cols = bbox_mask.any(axis=0)
    rows = bbox_mask.any(axis=1)
    x0, x1 = np.where(cols)[0][[0, -1]]
    y0, y1 = np.where(rows)[0][[0, -1]]
    body_cx = (x0 + x1) / 2
    # head: 上 25%
    h = y1 - y0
    head_y1 = y0 + int(h * 0.25)
    head_mask = bbox_mask[y0:head_y1, :]
    head_cols = head_mask.any(axis=0)
    if not head_cols.any(): return 0
    h_xs = np.where(head_cols)[0]
    head_cx = (h_xs[0] + h_xs[-1]) / 2
    return head_cx - body_cx

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='1024x1024 walk strip PNG (magenta bg)')
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--char', required=True, help='altman or dario')
    ap.add_argument('--prefix', default='walk', help='walk_01..04 prefix')
    ap.add_argument('--n', type=int, default=4)
    ap.add_argument('--target-h', type=int, default=901, help='normalized sprite height (901 of 1024)')
    ap.add_argument('--unify-direction', choices=['right', 'left', 'auto'], default='auto',
                    help='auto = trust generation prompt, no mirror; right/left = force mirror to direction')
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    src = Image.open(args.input).convert("RGB")

    # 优先：yellow grid line 切片（v3+ 有 grid 时用）
    yellow_peaks = find_yellow_separators(src)
    rgba = chroma_to_alpha(src)
    print(f"[1] Chroma extracted: {rgba.size}")

    if len(yellow_peaks) == args.n - 1:
        # 用 yellow lines 切：前后 + n-1 lines = n cells
        boundaries = [0] + yellow_peaks + [rgba.width]
        segs = [(boundaries[i]+4, boundaries[i+1]-4) for i in range(args.n)]  # 跳过 yellow line 厚度
        print(f"[2a] Using yellow grid: {segs}")
    else:
        segs = find_clusters(rgba, n=args.n)
        print(f"[2b] Cluster fallback: {len(segs)} found: {segs}")
        if len(segs) != args.n:
            print(f"WARN expected {args.n} got {len(segs)}; falling back to equal split")
            cw = rgba.width // args.n
            segs = [(i*cw, (i+1)*cw) for i in range(args.n)]

    # 切 + 居中 paste
    # 顶部 60px = #1-#4 黑底黄字 label 区，底部 6px = yellow border，跳过
    LABEL_TOP = 60
    LABEL_BOT = 8
    cells = []
    for (s, e) in segs:
        cell = rgba.crop((s, LABEL_TOP, e, rgba.height - LABEL_BOT))
        bb = cell.getbbox()
        if not bb:
            continue
        cropped = cell.crop(bb)
        cells.append(cropped)

    # 朝向统一（默认 auto = 信任 prompt，不 mirror）
    if args.unify_direction != 'auto':
        target_face = args.unify_direction
        for i, c in enumerate(cells):
            offset = head_offset(c)
            face = 'right' if offset > 0 else 'left'
            if face != target_face:
                print(f"  cell {i+1}: face {face}, mirroring → {target_face}")
                cells[i] = c.transpose(Image.FLIP_LEFT_RIGHT)
            else:
                print(f"  cell {i+1}: face {face} OK")
    else:
        print("  unify-direction=auto, trusting generation prompt (no mirror)")

    # 等高 normalize + 居中底部对齐
    max_h = max(c.height for c in cells)
    target_h = args.target_h
    print(f"[3] Cell heights: {[c.height for c in cells]}, max={max_h}, target={target_h}")
    for i, c in enumerate(cells):
        scale = target_h / c.height
        nw = int(c.width * scale)
        nh = target_h
        resized = c.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        # 居中水平 + 底部对齐到 y=1000（保留 24px 底部 padding 跟 idle 一致）
        px = (1024 - nw) // 2
        py = 1000 - nh
        canvas.paste(resized, (px, py), resized)
        # Final cleanup: 去除 LANCZOS resize 染上去的 magenta tint
        canvas = cleanup_magenta_tint(canvas)
        out_path = os.path.join(args.out_dir, f"{args.char}_{args.prefix}_{i+1:02d}.png")
        canvas.save(out_path)
        bb = canvas.getbbox()
        print(f"  saved {out_path} bbox={bb}")

if __name__ == '__main__':
    main()
