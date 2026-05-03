#!/usr/bin/env python3
"""
Walk cycle 8-frame strip prompt 模板。

参照动画原理 (Richard Williams, Animator's Survival Kit) 的 4 个 key pose × 左右脚 = 8 帧:
  contact_L → down_L → passing_L → up_L → contact_R → down_R → passing_R → up_R

每帧描述精确到肢体几何位置（哪只脚抬起/支撑、髋高、手臂前后、躯干角度），
而不用抽象动画术语，让 AI 能照画出来。

每个 strip 2 帧（OpenAI 2:1 比例可保画风），共 4 个 strip。
"""

# 共用前缀：identity lock + style lock + layout 约束
def build_prompt(character_brief: str, body_color: str, slot1: dict, slot2: dict, facing: str = 'RIGHT') -> str:
    walk_dir = 'right' if facing == 'RIGHT' else 'left'
    walk_dir_caps = facing
    front_side = 'right' if facing == 'RIGHT' else 'left'
    back_side = 'left' if facing == 'RIGHT' else 'right'
    return f"""This input image already shows 2 IDENTICAL poses of the same arcade fighting game character on a flat magenta background, in 2 equal slots side by side. Critical: keep slot layout, slot widths, magenta background, and the character's identity EXACTLY as input.

CHARACTER: {character_brief}

TASK: Replace the pose inside each slot with a DISTINCT walk-cycle key pose described below. Both frames are part of one continuous walk cycle moving forward to the {walk_dir_caps} side of the screen ({walk_dir} = the WALKING DIRECTION).

== SLOT 1 (LEFT) — {slot1['name']} ==
{slot1['description']}

== SLOT 2 (RIGHT) — {slot2['name']} ==
{slot2['description']}

CRITICAL — ART STYLE PRESERVATION:
- Do NOT change the art style. Do NOT convert to pixel art, 8-bit, retro game sprite, or any low-detail style.
- Preserve EXACTLY the bold thick black outlines, saturated cel-shaded flat colors, lean wiry muscle definition with visible forearm tendons and pectorals, and the polished arcade 2D fighting game illustration style of the input image.
- Output frames must be at the same resolution and detail level as the input image — full quality per slot.
- Same character face, same hairstyle, same {body_color} sleeveless muscle tee, same black tactical cargo pants with belt straps and pockets, same black fingerless gloves, same black combat boots across BOTH frames.

LAYOUT (CRITICAL):
- Output exactly 2 separate full-body frames left-to-right in one horizontal row at 2048x1024 total.
- Each pose centered in its 1024x1024 slot, no pose crosses into the neighboring slot.
- Background: pure flat magenta #ff00ff covering the entire canvas.
- The 2 poses must clearly differ from each other — different leg positions, different hip heights, different arm positions.
- All character poses face {walk_dir_caps} (the walking direction). The character's nose, chest, and toes ALL point to the {walk_dir} side of the canvas.

ABSOLUTELY NO: speed lines, motion blur, motion arcs, afterimages, dust, smoke, shadows under feet, contact shadows, drop shadows, glow, halo, sparkles, text, labels, frame numbers, slot borders, grid lines, scenery, or any visible guide marks. Pure character on pure flat magenta background only.
"""


# ============ 8 个 key pose 的精确肢体几何描述 ============
# 用第三人称画面式描述，避免抽象动画术语
# 注意：character 朝右走，"前" = 角色右侧（屏幕右侧），"后" = 角色左侧（屏幕左侧）
# left foot / right foot 是角色解剖学意义的左右脚

POSES = {
    "contact_L": {
        "name": "CONTACT (left foot in front)",
        "description": """The LEFT foot has just touched the ground in FRONT of the body, heel landing first with toes lifted up off the ground. The RIGHT foot is BEHIND the body, balanced on its toes (heel raised high), pushing off the ground. Both legs are STRAIGHT and at MAXIMUM SPREAD — the widest scissor stance of the entire walk cycle. Hips at NEUTRAL middle height. Body upright with very slight forward lean. The RIGHT arm swings FORWARD up to chest level (counterpose to left leg forward), elbow slightly bent, fist relaxed. The LEFT arm swings BACKWARD behind the body to the rearmost position, elbow slightly bent. Arms at their widest swing of the cycle. Head level, looking forward."""
    },
    "down_L": {
        "name": "DOWN / RECOIL (weight on left leg, hips lowest)",
        "description": """The LEFT foot is now firmly PLANTED FLAT on the ground absorbing weight (no longer just heel — full sole down). The LEFT knee is BENT significantly (about 130 degrees) to absorb impact, body compressing down. The RIGHT foot has LIFTED off the ground, knee bent, foot still BEHIND the body but starting to swing forward. Hips at LOWEST point of the entire cycle — body looks SHORTER, hips and spine bent forward at compressed angle. Arms still in same direction as previous frame: RIGHT arm forward at maximum swing, LEFT arm back at maximum swing — but body is compressed lower. Head at LOWEST point. Body has clear forward weight transfer feeling."""
    },
    "passing_L": {
        "name": "PASSING (right leg crosses under hips)",
        "description": """The RIGHT (free) leg is now passing DIRECTLY UNDER THE HIPS, knee bent at about 90 degrees with foot lifted off the ground at mid-shin height. The LEFT (supporting) leg is now STRAIGHT and vertical — body stacked vertically on the left leg. Hips RISING from the previous low point, body returning to upright posture. Arms now passing through the body's CENTER LINE near the torso, almost vertical — the right arm is coming back from forward position, the left arm is coming forward from rear position. Head rising. The legs visually almost cross / overlap from the side view because both are near body centerline."""
    },
    "up_L": {
        "name": "UP / HIGH POINT (left leg extends pushing body up)",
        "description": """The LEFT (supporting) leg is now FULLY EXTENDED straight, with the LEFT HEEL beginning to LIFT off the ground (rising up onto the toes/ball of the foot) — pushing the entire body UPWARD. The RIGHT leg has now swung all the way FORWARD, leg extended forward, RIGHT HEEL is about to land in front of the body. Hips at the HIGHEST point of the entire cycle. Body upright with very slight BACKWARD LEAN (opposite of contact). Arms now REVERSED from earlier: the LEFT arm is now swinging FORWARD up to chest level, the RIGHT arm is now pulled BACKWARD behind body. Head at HIGHEST point of cycle."""
    },
    "contact_R": {
        "name": "CONTACT (right foot in front)",
        "description": """The RIGHT foot has just touched the ground in FRONT of the body, heel landing first with toes lifted up off the ground. The LEFT foot is BEHIND the body, balanced on its toes (heel raised high), pushing off. Both legs STRAIGHT and at MAXIMUM SPREAD — widest scissor stance. Hips at NEUTRAL middle height. Body upright with very slight forward lean. The LEFT arm swings FORWARD up to chest level (counterpose to right leg forward), elbow slightly bent. The RIGHT arm swings BACKWARD to rearmost position. Arms at widest swing. Head level."""
    },
    "down_R": {
        "name": "DOWN / RECOIL (weight on right leg, hips lowest)",
        "description": """The RIGHT foot is now firmly PLANTED FLAT on the ground absorbing weight. The RIGHT knee is BENT significantly (about 130 degrees) to absorb impact, body compressing down. The LEFT foot has LIFTED off the ground, knee bent, foot still BEHIND the body starting to swing forward. Hips at LOWEST point — body looks SHORTER, spine bent forward at compressed angle. Arms still in same direction: LEFT arm forward at max swing, RIGHT arm back at max swing — but body compressed. Head at LOWEST point."""
    },
    "passing_R": {
        "name": "PASSING (left leg crosses under hips)",
        "description": """The LEFT (free) leg is now passing DIRECTLY UNDER THE HIPS, knee bent at 90 degrees with foot lifted at mid-shin height. The RIGHT (supporting) leg is STRAIGHT and vertical — body stacked vertically on the right leg. Hips RISING. Arms passing through body CENTER LINE near the torso, almost vertical — the left arm coming back from forward, right arm coming forward from rear. Legs visually nearly crossing/overlapping from side view."""
    },
    "up_R": {
        "name": "UP / HIGH POINT (right leg extends pushing body up)",
        "description": """The RIGHT (supporting) leg FULLY EXTENDED straight, RIGHT HEEL LIFTING off ground (rising onto toes) — pushing body UP. The LEFT leg has now swung all the way FORWARD, LEFT HEEL about to land in front. Hips at HIGHEST point of cycle. Body upright with slight BACKWARD LEAN. Arms REVERSED: RIGHT arm now swinging FORWARD to chest level, LEFT arm pulled BACKWARD. Head at HIGHEST point."""
    },
}


# 4 个 strip 的 slot 配对
STRIPS = [
    ("walk_a", "contact_L", "down_L"),
    ("walk_b", "passing_L", "up_L"),
    ("walk_c", "contact_R", "down_R"),
    ("walk_d", "passing_R", "up_R"),
]


def get_strip_prompt(character_brief: str, body_color: str, strip_id: str, facing: str = 'RIGHT') -> str:
    matches = [s for s in STRIPS if s[0] == strip_id]
    if not matches:
        raise ValueError(f"unknown strip_id: {strip_id}; choose one of {[s[0] for s in STRIPS]}")
    _, slot1_id, slot2_id = matches[0]
    return build_prompt(
        character_brief=character_brief,
        body_color=body_color,
        slot1={"name": POSES[slot1_id]["name"], "description": POSES[slot1_id]["description"]},
        slot2={"name": POSES[slot2_id]["name"], "description": POSES[slot2_id]["description"]},
        facing=facing,
    )


CHARACTER_ALTMAN = {
    "brief": "lean wiry male arcade fighter with messy dark curly hair, sharp angular face, narrow pointed chin, intense piercing eyes, clean-shaven",
    "body_color": "TEAL-AQUA-GREEN",
}

CHARACTER_DARIO = {
    "brief": "stocky combat-ready male arcade fighter with messy curly brown hair, round face, BLACK ROUND-FRAME GLASSES (must remain prominently visible), clean-shaven",
    "body_color": "DEEP SATURATED ORANGE",
}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: walk_cycle_prompts.py <strip_id> [altman|dario]")
        sys.exit(1)
    strip_id = sys.argv[1]
    char_id = sys.argv[2] if len(sys.argv) > 2 else "altman"
    char = CHARACTER_ALTMAN if char_id == "altman" else CHARACTER_DARIO
    facing = 'LEFT' if char_id == 'dario' else 'RIGHT'
    print(get_strip_prompt(char["brief"], char["body_color"], strip_id, facing=facing))
