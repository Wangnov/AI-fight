#!/usr/bin/env python3
"""
Walk cycle 8 帧标准火柴人骨架坐标定义 + 渲染。

每帧 14 个关键点（OpenPose 风格简化版）：
  head, neck, l/r shoulder, l/r elbow, l/r wrist, l/r hip, l/r knee, l/r ankle

设计原则（基于动画原理 4 个 phase × 左右脚 = 8 帧）：
  contact: 双腿最大叉开，hip 中等高度，counterpose 手臂最大摆
  down:    支撑腿弯曲承重，hip 最低，自由腿抬起后摆
  passing: 自由腿过中线，hip 上升，手臂经过身体中线
  up:      支撑腿伸直推高，hip 最高，自由腿摆到前方

cell: 1024×1024，地面线 y=950（留 74px 底 padding），人物身高 ~800px，
center x=512。所有关键点都是面向 RIGHT 走时的设计（朝左走时 PIL 翻转）。
"""

from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict
from PIL import Image, ImageDraw


CELL_W = 1024
CELL_H = 1024
GROUND_Y = 950
CENTER_X = 512


class KP(TypedDict):
    x: int
    y: int


# 关节连接定义（用于画线）
SKELETON_LINES = [
    ('head', 'neck'),
    ('neck', 'l_shoulder'), ('neck', 'r_shoulder'),
    ('l_shoulder', 'l_elbow'), ('l_elbow', 'l_wrist'),
    ('r_shoulder', 'r_elbow'), ('r_elbow', 'r_wrist'),
    ('neck', 'hip_center'),
    ('hip_center', 'l_hip'), ('hip_center', 'r_hip'),
    ('l_hip', 'l_knee'), ('l_knee', 'l_ankle'),
    ('r_hip', 'r_knee'), ('r_knee', 'r_ankle'),
]

# 不同关节用不同颜色（OpenPose ControlNet 标准配色思路）
JOINT_COLORS = {
    'head': (255, 200, 0),      # 黄
    'neck': (255, 0, 0),        # 红
    'l_shoulder': (255, 100, 100), 'r_shoulder': (100, 100, 255),  # 红 vs 蓝（区分左右）
    'l_elbow': (255, 150, 100), 'r_elbow': (100, 150, 255),
    'l_wrist': (255, 200, 100), 'r_wrist': (100, 200, 255),
    'hip_center': (200, 200, 0),
    'l_hip': (255, 100, 200), 'r_hip': (100, 200, 255),
    'l_knee': (255, 150, 200), 'r_knee': (150, 200, 255),
    'l_ankle': (255, 200, 200), 'r_ankle': (200, 200, 255),
}


# === 8 帧 walk cycle (face right) 关键点坐标 ===
# 设计要点：
# - hip_y 起伏：contact=600(中) → down=640(低) → passing=600(中) → up=560(高)
# - leg_spread：contact=最大、down=中、passing=最小（双腿交叉）、up=大（已分开）
# - 手臂 counterpose：腿前 → 对侧手臂前

# 朝右走："前" = 屏幕右 = x 大；"后" = 屏幕左 = x 小
# counterpose 规律：左腿前 → 右臂前 / 右腿前 → 左臂前
def _frame_contact_l() -> dict[str, KP]:
    """左脚踩地在前(屏幕右侧)，右脚后蹬(屏幕左侧)。最大叉开。
    Counterpose = 右臂前(右侧)、左臂后(左侧)。"""
    return {
        'head':       KP(x=520, y=110),  # 略前倾
        'neck':       KP(x=515, y=215),
        'l_shoulder': KP(x=510, y=220),  # 注意：纯侧视下两肩 x 接近，但保留小差异
        'r_shoulder': KP(x=520, y=220),
        'l_elbow':    KP(x=420, y=380),  # 左臂后摆 = 屏幕左
        'r_elbow':    KP(x=620, y=350),  # 右臂前摆 = 屏幕右
        'l_wrist':    KP(x=380, y=490),
        'r_wrist':    KP(x=700, y=300),
        'hip_center': KP(x=515, y=600),
        'l_hip':      KP(x=510, y=600),
        'r_hip':      KP(x=520, y=600),
        'l_knee':     KP(x=590, y=780),  # 左腿在前(右)，膝直
        'r_knee':     KP(x=440, y=780),  # 右腿在后(左)，膝直
        'l_ankle':    KP(x=655, y=945),  # 左脚跟刚踩地，在前
        'r_ankle':    KP(x=380, y=940),  # 右脚尖蹬地，在后
    }


def _frame_down_l() -> dict[str, KP]:
    """左脚承重弯曲(在前)，hip 最低。右脚抬起后摆(已开始 swing forward)。"""
    return {
        'head':       KP(x=525, y=145),  # 最低 + 前倾
        'neck':       KP(x=518, y=245),
        'l_shoulder': KP(x=515, y=250),
        'r_shoulder': KP(x=520, y=250),
        'l_elbow':    KP(x=425, y=395),
        'r_elbow':    KP(x=615, y=370),
        'l_wrist':    KP(x=385, y=505),
        'r_wrist':    KP(x=695, y=320),
        'hip_center': KP(x=515, y=640),  # 最低
        'l_hip':      KP(x=510, y=640),
        'r_hip':      KP(x=520, y=640),
        'l_knee':     KP(x=560, y=820),  # 左膝弯曲承重，仍偏前
        'r_knee':     KP(x=480, y=750),  # 右脚抬起，膝弯，仍后但开始上来
        'l_ankle':    KP(x=580, y=945),  # 左脚平踩地
        'r_ankle':    KP(x=460, y=860),  # 右脚离地后摆
    }


def _frame_passing_l() -> dict[str, KP]:
    """右腿(自由腿)过中线，hip 回升。手臂经过身体中线。"""
    return {
        'head':       KP(x=515, y=100),
        'neck':       KP(x=515, y=215),
        'l_shoulder': KP(x=510, y=225),
        'r_shoulder': KP(x=520, y=220),
        'l_elbow':    KP(x=475, y=355),  # 左臂从后往前过中线
        'r_elbow':    KP(x=560, y=355),  # 右臂从前往后过中线
        'l_wrist':    KP(x=455, y=475),
        'r_wrist':    KP(x=575, y=465),
        'hip_center': KP(x=515, y=595),
        'l_hip':      KP(x=510, y=595),
        'r_hip':      KP(x=520, y=595),
        'l_knee':     KP(x=520, y=775),  # 支撑腿直立
        'r_knee':     KP(x=525, y=720),  # 自由腿抬到中线，膝盖前
        'l_ankle':    KP(x=525, y=945),  # 直立踩地
        'r_ankle':    KP(x=510, y=820),  # 抬起在中线
    }


def _frame_up_l() -> dict[str, KP]:
    """支撑腿(左)伸直推高，hip 最高。右腿已摆到前方。手臂反向：左臂前/右臂后。"""
    return {
        'head':       KP(x=510, y=85),   # 最高 + 略后仰
        'neck':       KP(x=510, y=195),
        'l_shoulder': KP(x=505, y=210),
        'r_shoulder': KP(x=515, y=210),
        'l_elbow':    KP(x=590, y=350),  # 左臂前（反转）
        'r_elbow':    KP(x=425, y=375),  # 右臂后
        'l_wrist':    KP(x=655, y=295),
        'r_wrist':    KP(x=380, y=475),
        'hip_center': KP(x=510, y=560),  # 最高
        'l_hip':      KP(x=505, y=560),
        'r_hip':      KP(x=515, y=560),
        'l_knee':     KP(x=515, y=760),  # 左腿完全伸直
        'r_knee':     KP(x=600, y=720),  # 右腿摆到前
        'l_ankle':    KP(x=520, y=945),  # 左脚跟开始抬
        'r_ankle':    KP(x=680, y=895),  # 右脚摆到前
    }


def _mirror_lr(frame: dict[str, KP]) -> dict[str, KP]:
    """对一帧做左右脚 + 左右臂的语义镜像（不是几何翻转，是 swap left/right keypoints）。
    用于从 contact_L 生成 contact_R 等。"""
    swap_pairs = [
        ('l_shoulder', 'r_shoulder'),
        ('l_elbow', 'r_elbow'),
        ('l_wrist', 'r_wrist'),
        ('l_hip', 'r_hip'),
        ('l_knee', 'r_knee'),
        ('l_ankle', 'r_ankle'),
    ]
    out: dict[str, KP] = {}
    for k, v in frame.items():
        out[k] = KP(x=v['x'], y=v['y'])  # copy
    # 把左侧的 keypoint 内容跟右侧互换（保持 x/y 不变，只换 left/right 标签）
    # 但是这样朝向没变。其实 walk cycle 中 contact_R = contact_L 几何镜像 by x（朝走方向走时左右脚 swap = 几何左右翻转 around x=center）
    # 为了让骨架 visual 完全镜像（左右脚位置交换），我们 reflect x around CENTER_X
    for name, point in frame.items():
        out[name] = KP(x=2 * CENTER_X - point['x'], y=point['y'])
    # 然后 swap left <-> right 命名（让"左肩"还是真正的左肩）
    swapped: dict[str, KP] = dict(out)
    for a, b in swap_pairs:
        swapped[a], swapped[b] = out[b], out[a]
    return swapped


# === Jab 3 帧（朝右走时的设计；朝左走时整体几何镜像）===
# jab_01: startup（蓄力姿势，双拳贴胸，膝微弯）
# jab_02: active（出拳，右拳完全前伸最远端，左拳收回护面）
# jab_03: recovery（拳收回中，准备回 idle）

def _frame_jab_01() -> dict[str, KP]:
    """蓄力 — 双拳收回贴胸前，膝微弯准备出招。"""
    return {
        'head':       KP(x=510, y=125),  # 略低 + 略前倾
        'neck':       KP(x=515, y=225),
        'l_shoulder': KP(x=505, y=235),
        'r_shoulder': KP(x=525, y=235),
        'l_elbow':    KP(x=465, y=380),  # 左肘内收
        'r_elbow':    KP(x=565, y=380),  # 右肘内收（蓄力位）
        'l_wrist':    KP(x=480, y=480),  # 左拳贴胸偏低
        'r_wrist':    KP(x=560, y=475),  # 右拳贴胸（蓄力）
        'hip_center': KP(x=515, y=605),
        'l_hip':      KP(x=505, y=605),
        'r_hip':      KP(x=525, y=605),
        'l_knee':     KP(x=490, y=775),  # 微弯
        'r_knee':     KP(x=540, y=775),
        'l_ankle':    KP(x=470, y=945),  # 微马步
        'r_ankle':    KP(x=575, y=945),
    }


def _frame_jab_02() -> dict[str, KP]:
    """出拳到位 — 右拳完全前伸（朝右最远），身体前倾 momentum，左拳护脸。"""
    return {
        'head':       KP(x=530, y=110),  # 头前倾 + 上抬看出拳方向
        'neck':       KP(x=520, y=215),
        'l_shoulder': KP(x=500, y=225),
        'r_shoulder': KP(x=535, y=215),  # 右肩前伸
        'l_elbow':    KP(x=460, y=350),  # 左肘后收
        'r_elbow':    KP(x=655, y=275),  # 右肘前伸
        'l_wrist':    KP(x=485, y=455),  # 左拳护胸
        'r_wrist':    KP(x=805, y=215),  # 右拳完全伸出最远端 + 上拉
        'hip_center': KP(x=515, y=600),
        'l_hip':      KP(x=505, y=600),
        'r_hip':      KP(x=525, y=600),
        'l_knee':     KP(x=475, y=775),
        'r_knee':     KP(x=580, y=775),  # 右脚前撑
        'l_ankle':    KP(x=440, y=945),  # 左脚后蹬
        'r_ankle':    KP(x=625, y=945),  # 右脚前撑
    }


def _frame_jab_03() -> dict[str, KP]:
    """拳收回中 — 介于 jab_01 和 jab_02 之间，从 active 回到 stance。"""
    return {
        'head':       KP(x=515, y=120),
        'neck':       KP(x=515, y=220),
        'l_shoulder': KP(x=505, y=230),
        'r_shoulder': KP(x=525, y=225),
        'l_elbow':    KP(x=470, y=370),
        'r_elbow':    KP(x=600, y=325),  # 右肘收回中
        'l_wrist':    KP(x=485, y=465),
        'r_wrist':    KP(x=685, y=295),  # 右拳收回中（介于伸出和贴胸之间）
        'hip_center': KP(x=515, y=605),
        'l_hip':      KP(x=505, y=605),
        'r_hip':      KP(x=525, y=605),
        'l_knee':     KP(x=485, y=775),
        'r_knee':     KP(x=545, y=775),
        'l_ankle':    KP(x=465, y=945),
        'r_ankle':    KP(x=580, y=945),
    }


def get_jab_sequence(facing: str = 'right') -> list[dict[str, KP]]:
    """返回 3 帧 jab 序列，按 jab_01..03 顺序。"""
    base = [_frame_jab_01(), _frame_jab_02(), _frame_jab_03()]
    if facing == 'left':
        out = []
        for f in base:
            mirrored = {k: KP(x=2 * CENTER_X - v['x'], y=v['y']) for k, v in f.items()}
            out.append(mirrored)
        return out
    return base


def get_walk_cycle(facing: str = 'right') -> list[dict[str, KP]]:
    """返回 8 帧 walk cycle，按 walk_01..08 顺序。
    facing='right' 默认设计；'left' 对所有 x 关于 CENTER_X 翻转（维持 left/right 标签为解剖学含义）。"""
    base = [
        _frame_contact_l(),   # 1
        _frame_down_l(),      # 2
        _frame_passing_l(),   # 3
        _frame_up_l(),         # 4
        _mirror_lr(_frame_contact_l()),   # 5: contact_R
        _mirror_lr(_frame_down_l()),      # 6: down_R
        _mirror_lr(_frame_passing_l()),   # 7: passing_R
        _mirror_lr(_frame_up_l()),         # 8: up_R
    ]
    if facing == 'left':
        # 整体几何镜像（朝左走）
        out = []
        for f in base:
            mirrored: dict[str, KP] = {}
            for k, v in f.items():
                mirrored[k] = KP(x=2 * CENTER_X - v['x'], y=v['y'])
            # 同时 swap l_/r_ 命名（因为镜像后左右脚视觉位置对调，但解剖学上仍然是同一只脚）
            # 实际上对于"朝左走时左脚仍然是左脚"，几何 mirror 后左肩在屏幕右、右肩在屏幕左
            # 这是预期的 — 我们不再 swap 命名
            out.append(mirrored)
        return out
    return base


def render_frame(frame: dict[str, KP], img: Image.Image | None = None,
                  offset_x: int = 0) -> None:
    """在已有 img 上以 offset_x 位置绘制单帧骨架。"""
    if img is None:
        raise ValueError('img required')
    draw = ImageDraw.Draw(img)
    # 骨架线
    for a, b in SKELETON_LINES:
        if a not in frame or b not in frame:
            continue
        pa = (frame[a]['x'] + offset_x, frame[a]['y'])
        pb = (frame[b]['x'] + offset_x, frame[b]['y'])
        draw.line([pa, pb], fill=(255, 255, 255), width=8)
    # 关节圆点
    for name, p in frame.items():
        x, y = p['x'] + offset_x, p['y']
        color = JOINT_COLORS.get(name, (255, 255, 255))
        r = 12 if name in ('head', 'neck', 'hip_center') else 8
        draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=color)
    # head 多画一个圆圈（作为头部标识）
    head = frame['head']
    hx, hy = head['x'] + offset_x, head['y']
    draw.ellipse([(hx - 35, hy - 50), (hx + 35, hy + 20)], outline=(255, 200, 0), width=4)


def render_strip(frames: list[dict[str, KP]], out_path: Path) -> None:
    """把 N 帧并排渲染成单 strip PNG。"""
    n = len(frames)
    img = Image.new('RGB', (CELL_W * n, CELL_H), (10, 10, 20))  # 深蓝底
    for i, f in enumerate(frames):
        render_frame(f, img, offset_x=i * CELL_W)
        # slot 边界（细灰线）
        draw = ImageDraw.Draw(img)
        if i > 0:
            draw.line([(i * CELL_W, 0), (i * CELL_W, CELL_H)], fill=(40, 40, 60), width=2)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f'  → {out_path}')


def main() -> None:
    out_dir = Path(__file__).parent / '_skeleton'

    # Altman: facing right
    altman_cycle = get_walk_cycle('right')
    for i, label in enumerate(['walk_a', 'walk_b', 'walk_c', 'walk_d']):
        slot1 = altman_cycle[i * 2]
        slot2 = altman_cycle[i * 2 + 1]
        render_strip([slot1, slot2], out_dir / f'altman_{label}_skel.png')

    dario_cycle = get_walk_cycle('left')
    for i, label in enumerate(['walk_a', 'walk_b', 'walk_c', 'walk_d']):
        slot1 = dario_cycle[i * 2]
        slot2 = dario_cycle[i * 2 + 1]
        render_strip([slot1, slot2], out_dir / f'dario_{label}_skel.png')

    render_strip(altman_cycle, out_dir / 'altman_walk_full.png')
    render_strip(dario_cycle, out_dir / 'dario_walk_full.png')

    # === Jab 3 帧总览（也支持单独导出每帧用于 build_pose_ref） ===
    altman_jabs = get_jab_sequence('right')
    render_strip(altman_jabs, out_dir / 'altman_jab_full.png')
    dario_jabs = get_jab_sequence('left')
    render_strip(dario_jabs, out_dir / 'dario_jab_full.png')


if __name__ == '__main__':
    main()
