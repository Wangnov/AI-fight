#!/usr/bin/env python3
"""
读 pose JSON，跨帧计算关键指标 + 输出 markdown 报告。

输出：
  - 每帧的 head_y / ankle_y / hip_y / shoulder_w / torso_h / leg_spread / facing
  - 身份一致性：肩宽 + 躯干长度 + 头身比的方差
  - Walk cycle phase 识别：8 帧的 contact / down / passing / up 标签
  - Size 一致性：所有帧人物 bbox 高度

用法:
    .venv/bin/python tools/analyze_pose.py \
        --in tools/_pose/altman_pose.json \
        --out tools/_pose/altman_report.md
"""

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any


def kp(frame: dict, name: str) -> dict | None:
    """取 keypoint，低 visibility 也保留但标记"""
    return frame.get('keypoints', {}).get(name)


def midpoint(a: dict, b: dict) -> tuple[float, float]:
    return ((a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2)


def distance(a: dict, b: dict) -> float:
    dx = a['x'] - b['x']
    dy = a['y'] - b['y']
    return (dx * dx + dy * dy) ** 0.5


def analyze_frame(frame: dict) -> dict[str, Any] | None:
    if not frame.get('detected'):
        return None
    name = frame['frame']
    ls = kp(frame, 'left_shoulder')
    rs = kp(frame, 'right_shoulder')
    lh = kp(frame, 'left_hip')
    rh = kp(frame, 'right_hip')
    la = kp(frame, 'left_ankle')
    ra = kp(frame, 'right_ankle')
    nose = kp(frame, 'nose')
    le = kp(frame, 'left_ear')
    re = kp(frame, 'right_ear')
    lk = kp(frame, 'left_knee')
    rk = kp(frame, 'right_knee')
    lw = kp(frame, 'left_wrist')
    rw = kp(frame, 'right_wrist')
    if not all([ls, rs, lh, rh]):
        return {'frame': name, 'error': 'missing torso keypoints'}

    # 肩中点 / 髋中点
    sm_x, sm_y = midpoint(ls, rs)
    hm_x, hm_y = midpoint(lh, rh)
    shoulder_w = distance(ls, rs)
    torso_h = ((sm_y - hm_y) ** 2 + (sm_x - hm_x) ** 2) ** 0.5

    # 头顶 y：nose / ears 的最小 y（坐标系顶部 y=0）
    head_candidates = [k for k in [nose, le, re] if k and k['visibility'] > 0.3]
    head_y = min(k['y'] for k in head_candidates) if head_candidates else None

    # 脚踝最低 y：max y（底部）
    ankle_candidates = [k for k in [la, ra] if k and k['visibility'] > 0.3]
    ankle_y = max(k['y'] for k in ankle_candidates) if ankle_candidates else None

    # 角色总身高（head 到 ankle 的 y 距）
    body_h = (ankle_y - head_y) if head_y is not None and ankle_y is not None else None

    # 双脚分开距离（walk 关键指标：max=contact, min=passing）
    leg_spread = abs(la['x'] - ra['x']) if la and ra else None

    # 髋高度（用 hm_y 直接；y 越大越低，walk down=最低=hm_y 最大；up=最高=hm_y 最小）
    hip_y = hm_y

    # 朝向：用左/右耳 x 的相对位置 + 鼻子的 x。如果鼻子 x 偏向某侧 → 朝那侧
    facing = '?'
    if nose and ls and rs:
        # 侧视时鼻子明显偏向朝向那一侧
        nose_offset = nose['x'] - sm_x
        if nose_offset > 0.02:
            facing = 'right'
        elif nose_offset < -0.02:
            facing = 'left'
        else:
            # 鼻子在中间，看肩前后顺序：朝右走时 right_shoulder 在前 = x 大
            if ls['x'] - rs['x'] > 0.01:
                facing = 'left'  # 左肩在前 → 朝左
            elif rs['x'] - ls['x'] > 0.01:
                facing = 'right'

    # 哪只脚在前：x 偏 facing 方向那只
    front_foot = None
    if la and ra and facing in ('right', 'left'):
        if facing == 'right':
            front_foot = 'L' if la['x'] > ra['x'] else 'R'
        else:
            front_foot = 'L' if la['x'] < ra['x'] else 'R'

    # walk phase 识别（仅对 walk 帧有意义）
    return {
        'frame': name,
        'shoulder_w': round(shoulder_w, 4),
        'torso_h': round(torso_h, 4),
        'body_h': round(body_h, 4) if body_h else None,
        'head_y': round(head_y, 4) if head_y else None,
        'hip_y': round(hip_y, 4),
        'ankle_y': round(ankle_y, 4) if ankle_y else None,
        'leg_spread': round(leg_spread, 4) if leg_spread else None,
        'facing': facing,
        'front_foot': front_foot,
    }


def variance_pct(values: list[float]) -> float:
    if not values or len(values) < 2:
        return 0
    m = statistics.mean(values)
    if m == 0:
        return 0
    sd = statistics.stdev(values)
    return round(sd / m * 100, 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    data = json.loads(Path(args.inp).read_text())
    frames = data['frames']
    char = data['character']

    rows = []
    for f in frames:
        r = analyze_frame(f)
        if r is None:
            rows.append({'frame': f['frame'], 'error': 'NOT DETECTED'})
        else:
            rows.append(r)

    # 身份一致性指标
    valid = [r for r in rows if 'error' not in r]
    sw_var = variance_pct([r['shoulder_w'] for r in valid])
    th_var = variance_pct([r['torso_h'] for r in valid])
    bh_var = variance_pct([r['body_h'] for r in valid if r.get('body_h')])

    # walk 8 帧专项分析
    walk_rows = sorted(
        (r for r in valid if r['frame'].startswith(f'{char}_walk_')),
        key=lambda r: r['frame'],
    )

    # idle/walk 高度对比
    idle_rows = [r for r in valid if 'idle' in r['frame']]
    idle_body_h = [r['body_h'] for r in idle_rows if r.get('body_h')]
    walk_body_h = [r['body_h'] for r in walk_rows if r.get('body_h')]

    expected_facing = 'right' if char == 'altman' else 'left'

    # === 输出 markdown 报告 ===
    out = []
    out.append(f'# Pose 分析报告：{char}')
    out.append('')
    out.append(f'- 检测成功：{len(valid)}/{len(rows)}')
    out.append(f'- 期望朝向：**{expected_facing}**')
    out.append('')
    out.append('## 身份一致性（跨所有帧）')
    out.append(f'- 肩宽变异系数：**{sw_var}%**（< 8% 一致；> 15% 严重不一致）')
    out.append(f'- 躯干长变异系数：**{th_var}%**')
    out.append(f'- 角色总身高变异系数：**{bh_var}%**')
    out.append('')
    out.append('## Idle vs Walk 高度对比')
    out.append(f'- idle 平均身高：{round(statistics.mean(idle_body_h), 4) if idle_body_h else "N/A"}')
    out.append(f'- walk 平均身高：{round(statistics.mean(walk_body_h), 4) if walk_body_h else "N/A"}')
    if idle_body_h and walk_body_h:
        delta = (statistics.mean(idle_body_h) - statistics.mean(walk_body_h)) / statistics.mean(walk_body_h) * 100
        out.append(f'- 差异：**{round(delta, 1)}%**（>10% 表示明显脱节）')
    out.append('')
    out.append('## Walk 8 帧（按帧序）')
    out.append('| frame | facing | front_foot | hip_y | leg_spread | body_h | shoulder_w |')
    out.append('|-------|--------|------------|-------|------------|--------|------------|')
    for r in walk_rows:
        out.append(
            f'| {r["frame"].split("_walk_")[1]:>2} '
            f'| {r["facing"]:>5} '
            f'| {r["front_foot"] or "?":>1} '
            f'| {r["hip_y"]} '
            f'| {r["leg_spread"]} '
            f'| {r.get("body_h", "?")} '
            f'| {r["shoulder_w"]} |'
        )
    out.append('')

    # 朝向异常帧
    wrong_facing = [r for r in valid if r['facing'] != expected_facing and r['facing'] != '?']
    out.append('## 朝向异常帧（应该 ' + expected_facing + ' 但检测为别的）')
    if wrong_facing:
        for r in wrong_facing:
            out.append(f'- **{r["frame"]}**: facing={r["facing"]}')
    else:
        out.append('（无）')
    out.append('')

    # 不能识别的帧
    failed = [r for r in rows if 'error' in r]
    out.append('## 检测失败 / 异常帧')
    if failed:
        for r in failed:
            out.append(f'- {r["frame"]}: {r.get("error", "?")}')
    else:
        out.append('（无）')
    out.append('')

    # walk phase 识别（基于 hip_y + leg_spread）
    if len(walk_rows) >= 4:
        out.append('## Walk Cycle phase 推断（基于 hip 高度 + leg spread）')
        # contact = leg_spread 最大
        # passing = leg_spread 最小（双腿并近）
        # down = hip_y 最大（最低）
        # up = hip_y 最小（最高）
        spreads = sorted(walk_rows, key=lambda r: r['leg_spread'] or 0)
        hips = sorted(walk_rows, key=lambda r: r['hip_y'] or 0)
        out.append(f'- leg_spread 最小（passing 候选）：{spreads[0]["frame"]} ({spreads[0]["leg_spread"]})')
        out.append(f'- leg_spread 最大（contact 候选）：{spreads[-1]["frame"]} ({spreads[-1]["leg_spread"]})')
        out.append(f'- hip_y 最小（up 候选 / 最高点）：{hips[0]["frame"]} ({hips[0]["hip_y"]})')
        out.append(f'- hip_y 最大（down 候选 / 最低点）：{hips[-1]["frame"]} ({hips[-1]["hip_y"]})')

    out_path = Path(args.out)
    out_path.write_text('\n'.join(out))
    print(f'→ {out_path}')
    print('\n'.join(out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
