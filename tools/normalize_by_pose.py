"""
用 MediaPipe Pose 检测每个 sprite 的火柴人完整骨架长度
skeleton_length = head→shoulder + shoulder→hip + hip→knee + knee→ankle (avg L/R)

相比 torso 单段：
- 包含 head/legs，反映真实身体长度
- 用左右平均提高鲁棒性
- segment-level visibility filter，可以跳过被遮挡的部分
- 适用于站/蹲/弯/扭等各种 pose（只要 keypoint 可见）
"""
import os, sys, argparse
import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

MODEL_PATH = os.environ.get("POSE_MODEL", "/tmp/pose_landmarker_heavy.task")

_detector = None
def get_detector():
    global _detector
    if _detector is None:
        opts = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.3,
            min_pose_presence_confidence=0.3,
        )
        _detector = vision.PoseLandmarker.create_from_options(opts)
    return _detector

def _dist(p1, p2):
    return ((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2) ** 0.5

def detect_skeleton(img_path):
    """
    返回 dict: total, head, torso, thigh, shin, visibility 各项 + landmarks
    或 None
    """
    img = mp.Image.create_from_file(img_path)
    arr_view = img.numpy_view()
    h, w = arr_view.shape[:2]
    res = get_detector().detect(img)
    if not res.pose_landmarks:
        return None
    lm = res.pose_landmarks[0]
    pts = [(p.x * w, p.y * h) for p in lm]
    vis = [p.visibility for p in lm]
    
    # midpoints
    sm = ((pts[11][0]+pts[12][0])/2, (pts[11][1]+pts[12][1])/2)
    hm = ((pts[23][0]+pts[24][0])/2, (pts[23][1]+pts[24][1])/2)
    
    head = _dist(pts[0], sm)  # nose → shoulder mid
    torso = _dist(sm, hm)
    left_thigh = _dist(pts[23], pts[25])
    right_thigh = _dist(pts[24], pts[26])
    left_shin = _dist(pts[25], pts[27])
    right_shin = _dist(pts[26], pts[28])
    
    # visibility 加权平均腿（避免一边遮挡时偏向另一边）
    lt_v = (vis[23] + vis[25]) / 2
    rt_v = (vis[24] + vis[26]) / 2
    ls_v = (vis[25] + vis[27]) / 2
    rs_v = (vis[26] + vis[28]) / 2
    
    if lt_v + rt_v > 0:
        thigh = (left_thigh*lt_v + right_thigh*rt_v) / (lt_v + rt_v)
    else:
        thigh = (left_thigh + right_thigh) / 2
    if ls_v + rs_v > 0:
        shin = (left_shin*ls_v + right_shin*rs_v) / (ls_v + rs_v)
    else:
        shin = (left_shin + right_shin) / 2
    
    head_v = (vis[0] + vis[11] + vis[12]) / 3
    torso_v = (vis[11] + vis[12] + vis[23] + vis[24]) / 4
    leg_v = (lt_v + rt_v + ls_v + rs_v) / 4
    
    return {
        'total': head + torso + thigh + shin,
        'head': head,
        'torso': torso,
        'thigh': thigh,
        'shin': shin,
        'leg_height': thigh + shin,  # 髋到踝
        'head_to_ankle': head + torso + thigh + shin,
        'visibility': {
            'head': head_v,
            'torso': torso_v,
            'leg': leg_v,
            'overall': (head_v + torso_v + leg_v) / 3,
        }
    }

def normalize_sprite(src_path, target_total, max_w=920, max_h=1010, bottom_align=True, dry_run=False, min_vis=0.3):
    info = detect_skeleton(src_path)
    if not info:
        return None, "pose detection failed"
    if info['visibility']['overall'] < min_vis:
        return None, f"low visibility {info['visibility']['overall']:.2f}"
    cur_total = info['total']
    scale = target_total / cur_total
    src = Image.open(src_path).convert("RGBA")
    arr = np.array(src)
    A = arr[..., 3]
    ys, xs = np.where(A > 0)
    if len(ys) == 0:
        return None, "empty alpha"
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    crop = src.crop((x0, y0, x1+1, y1+1))
    new_w = int(crop.width * scale)
    new_h = int(crop.height * scale)
    cap_hit = None
    if new_w > max_w:
        s = max_w / crop.width
        new_w = max_w; new_h = int(crop.height * s); scale = s; cap_hit = 'width'
    if new_h > max_h:
        s = max_h / crop.height
        new_h = max_h; new_w = int(crop.width * s); scale = s; cap_hit = 'height'
    if not dry_run:
        resized = crop.resize((new_w, new_h), Image.LANCZOS)
        canvas = Image.new("RGBA", (1024, 1024), (0,0,0,0))
        px = (1024 - new_w) // 2
        py = 1000 - new_h if bottom_align else (1024 - new_h) // 2
        canvas.paste(resized, (px, py), resized)
        sys.path.insert(0, "/Users/wangnov/AI-fight/tools")
        from slice_walk_strip import cleanup_magenta_tint
        canvas = cleanup_magenta_tint(canvas)
        canvas.save(src_path)
    return {'scale': scale, 'cur_total': cur_total, 'new_size': (new_w, new_h), 'cap': cap_hit}, None
