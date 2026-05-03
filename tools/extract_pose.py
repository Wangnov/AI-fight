#!/usr/bin/env python3
"""
扫描所有 character sprite，用 MediaPipe Pose 检测每张图的 33 个关键点，
输出 JSON 供 LLM 跨帧分析一致性。

输出 keypoints 坐标已归一化到 [0, 1]（mediapipe 默认就是 normalized 坐标）。
visibility 在 [0, 1]，<0.5 视为低置信度。

用法:
    .venv/bin/python tools/extract_pose.py \
        --dir public/sprites/altman \
        --out tools/_pose/altman_pose.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

# mediapipe Pose 33 个关键点的语义名称（POSE_LANDMARKS 的索引顺序）
LANDMARK_NAMES = [
    'nose',
    'left_eye_inner', 'left_eye', 'left_eye_outer',
    'right_eye_inner', 'right_eye', 'right_eye_outer',
    'left_ear', 'right_ear',
    'mouth_left', 'mouth_right',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_pinky', 'right_pinky',
    'left_index', 'right_index',
    'left_thumb', 'right_thumb',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle',
    'left_heel', 'right_heel',
    'left_foot_index', 'right_foot_index',
]


def detect_pose(img_path: Path, detector) -> dict[str, Any]:
    """新版 mediapipe Tasks API：PoseLandmarker.detect(mp.Image)"""
    import mediapipe as mp
    img = Image.open(img_path).convert('RGBA')
    bg = Image.new('RGBA', img.size, (180, 180, 180, 255))
    bg.alpha_composite(img)
    rgb = bg.convert('RGB')
    arr = np.array(rgb)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)

    result = detector.detect(mp_image)
    keypoints: dict[str, Any] = {}
    has_landmarks = bool(result.pose_landmarks)

    if has_landmarks:
        # 取第一个人（通常只一个）
        landmarks = result.pose_landmarks[0]
        for i, lm in enumerate(landmarks):
            keypoints[LANDMARK_NAMES[i]] = {
                'x': round(float(lm.x), 4),
                'y': round(float(lm.y), 4),
                'z': round(float(lm.z), 4),
                # 新版用 presence 代替 visibility，但有的版本两个都有
                'visibility': round(float(getattr(lm, 'visibility', 1.0)), 3),
                'presence': round(float(getattr(lm, 'presence', 1.0)), 3),
            }

    return {
        'frame': img_path.stem,
        'image_size': img.size,
        'detected': has_landmarks,
        'keypoints': keypoints,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument(
        '--complexity', type=int, default=2, choices=[0, 1, 2],
        help='mediapipe pose model complexity (2=high accuracy)'
    )
    ap.add_argument(
        '--min-detection-confidence', type=float, default=0.3,
        help='降低阈值适配卡通风格'
    )
    args = ap.parse_args()

    src_dir = Path(args.dir)
    if not src_dir.is_dir():
        print(f'not a dir: {src_dir}', file=sys.stderr)
        return 1

    pngs = sorted(p for p in src_dir.glob('*.png') if not p.name.startswith('_'))
    if not pngs:
        print('no PNGs', file=sys.stderr)
        return 1

    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    model_path = Path(__file__).parent / '_pose' / 'models' / 'pose_landmarker_heavy.task'
    if not model_path.exists():
        print(f'model missing: {model_path}', file=sys.stderr)
        return 1

    base_options = mp_python.BaseOptions(model_asset_path=str(model_path))
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=args.min_detection_confidence,
        min_pose_presence_confidence=args.min_detection_confidence,
        min_tracking_confidence=args.min_detection_confidence,
        output_segmentation_masks=False,
    )
    detector = vision.PoseLandmarker.create_from_options(options)

    frames = []
    for p in pngs:
        try:
            result = detect_pose(p, detector)
        except Exception as e:
            print(f'  ! {p.name}: {e}')
            result = {'frame': p.stem, 'detected': False, 'error': str(e), 'keypoints': {}}
        frames.append(result)
        det = '✓' if result['detected'] else '✗'
        print(f'  {det} {p.name}')

    detector.close()

    out = {
        'character': src_dir.name,
        'total_frames': len(frames),
        'detected_frames': sum(1 for f in frames if f['detected']),
        'frames': frames,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f'\n→ {out_path}  ({out["detected_frames"]}/{out["total_frames"]} detected)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
