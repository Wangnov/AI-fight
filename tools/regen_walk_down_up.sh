#!/bin/bash
# 只重生 down/up 4 帧（walk_02/04/06/08），骨架已加大 hip 起伏
# 加 prompt 文字描述强化"deep crouch / tall stride"
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill
REF_DIR=/tmp/pose_refs
OUT_DIR=/tmp/pose_outs
mkdir -p "$REF_DIR" "$OUT_DIR"

# down/up 帧对应 walk index 2,4,6,8
TARGET_FRAMES=(2 4 6 8)

# 重生 ref（骨架已加大）
for char in altman dario; do
  for i in "${TARGET_FRAMES[@]}"; do
    "$ROOT/.venv/bin/python" "$ROOT/tools/build_pose_ref.py" \
      --base "$ROOT/public/sprites/$char/${char}_idle_01.png" \
      --action walk \
      --skel-frame "$i" \
      --char "$char" \
      --out "$REF_DIR/${char}_walk_$(printf '%02d' "$i")_ref.png"
  done
done

ALTMAN_DESC="lean wiry male arcade fighter, messy dark curly hair, sharp angular face, narrow pointed chin, intense piercing eyes, clean-shaven; teal-aqua-green sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots; bold thick black outlines, saturated cel-shaded flat colors, polished arcade 2D fighting game illustration style, NOT pixel art, NOT 8-bit"
DARIO_DESC="stocky combat-ready male arcade fighter, messy curly brown hair, round face, BLACK ROUND-FRAME GLASSES (must be clearly visible), clean-shaven; deep saturated orange sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots; bold thick black outlines, saturated cel-shaded flat colors, polished arcade 2D fighting game illustration style, NOT pixel art, NOT 8-bit"

# 按帧 index 给不同 emphasis 描述
get_phase_emphasis () {
  local i="$1"
  case "$i" in
    2|6) echo "DEEP CROUCH POSE: hips lowered to about thigh level, both knees bent significantly absorbing weight, body compressed downward, shorter overall stance — like a person mid-step recoiling under their own weight" ;;
    4|8) echo "TALL STRIDE POSE: body fully extended at peak height, supporting leg pushed straight up onto toes/ball-of-foot, hip at maximum elevation, front leg reaching forward — like a person mid-step at the highest point of the walk" ;;
    *)   echo "" ;;
  esac
}

gen_pose () {
  local char="$1"
  local i="$2"
  local idx
  idx=$(printf '%02d' "$i")
  local ref="$REF_DIR/${char}_walk_${idx}_ref.png"
  local out="$OUT_DIR/${char}_walk_${idx}.png"
  local log="$OUT_DIR/${char}_walk_${idx}_log.json"
  local desc emphasis
  if [ "$char" = "altman" ]; then desc="$ALTMAN_DESC"; else desc="$DARIO_DESC"; fi
  emphasis=$(get_phase_emphasis "$i")

  local prompt="Convert the character on the right into the EXACT pose shown by the white stick-figure skeleton on the left. The output is a single full-body sprite of the character (NOT the skeleton).

CHARACTER (preserve identity from right reference): $desc.

CRITICAL POSE EMPHASIS: $emphasis. The skeleton's hip dot position is the most important — match the hip height EXACTLY. Body parts above and below scale accordingly.

POSE TARGET (match left skeleton precisely): every body part — head, shoulders, elbows, wrists, hips, knees, ankles — must be at the position shown by the corresponding skeleton joint dot.

Background: pure flat magenta #ff00ff covering the entire output canvas.

DO NOT include skeleton lines, joint dots, head circle, or anything from the reference layout in the output. The output is ONLY the fully drawn character sprite at 1024×1024."

  cd "$SKILL"
  node scripts/gpt_image_2_skill.cjs --json --provider DuckCoding \
    images edit \
    --ref-image "$ref" \
    --prompt "$prompt" \
    --out "$out" \
    --size 1024x1024 \
    --quality high \
    --format png \
    --input-fidelity high > "$log" 2>&1
  if [ -f "$out" ]; then echo "DONE $char walk_$idx"; else echo "FAIL $char walk_$idx"; fi
}

export -f gen_pose get_phase_emphasis
export SKILL OUT_DIR REF_DIR ALTMAN_DESC DARIO_DESC

echo "=== Regen 8 down/up frames ==="
for char in altman dario; do
  for i in "${TARGET_FRAMES[@]}"; do
    gen_pose "$char" "$i" &
  done
done
wait

echo "=== Chroma extract + replace ==="
for char in altman dario; do
  for i in "${TARGET_FRAMES[@]}"; do
    idx=$(printf '%02d' "$i")
    raw="$OUT_DIR/${char}_walk_${idx}.png"
    out="$ROOT/public/sprites/${char}/${char}_walk_${idx}.png"
    cd "$SKILL"
    node scripts/gpt_image_2_skill.cjs --json \
      transparent extract --input "$raw" --out "$out" \
      --method chroma --matte-color "#ff00ff" --profile generic --strict \
      > /tmp/walk_du_extract_${char}_${idx}.json 2>&1
    cd "$ROOT"
    echo "  EXTRACTED $char walk_$idx"
  done
done

echo "=== ALL DONE — skip normalize for these frames to preserve down/up height differences ==="
echo "If you want walk frames matched in size with idle, run normalize_sprite.py manually."
