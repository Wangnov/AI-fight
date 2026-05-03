#!/bin/bash
# 用 pose ref（骨架+base 横向拼接）批量生成两人 8 帧 walk cycle
# 每帧独立 generate，16 路并发（DuckCoding 高并发支持）
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill
REF_DIR=/tmp/pose_refs
OUT_DIR=/tmp/pose_outs
mkdir -p "$REF_DIR" "$OUT_DIR"

# 1. 准备每人 8 帧 ref（左骨架 + 右 base 拼接）
for char in altman dario; do
  for i in 1 2 3 4 5 6 7 8; do
    "$ROOT/.venv/bin/python" "$ROOT/tools/build_pose_ref.py" \
      --base "$ROOT/public/sprites/$char/${char}_idle_01.png" \
      --skel-frame "$i" \
      --char "$char" \
      --out "$REF_DIR/${char}_walk_$(printf '%02d' "$i")_ref.png"
  done
done

# 2. 角色描述 + facing 配置
ALTMAN_DESC="lean wiry male arcade fighter, messy dark curly hair, sharp angular face, narrow pointed chin, intense piercing eyes, clean-shaven; teal-aqua-green sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots; bold thick black outlines, saturated cel-shaded flat colors, polished arcade 2D fighting game illustration style, NOT pixel art, NOT 8-bit"
DARIO_DESC="stocky combat-ready male arcade fighter, messy curly brown hair, round face, BLACK ROUND-FRAME GLASSES (must be clearly visible), clean-shaven; deep saturated orange sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots; bold thick black outlines, saturated cel-shaded flat colors, polished arcade 2D fighting game illustration style, NOT pixel art, NOT 8-bit"

# 3. 单帧 generate 函数
gen_pose () {
  local char="$1"
  local i="$2"
  local idx
  idx=$(printf '%02d' "$i")
  local ref="$REF_DIR/${char}_walk_${idx}_ref.png"
  local out="$OUT_DIR/${char}_walk_${idx}.png"
  local log="$OUT_DIR/${char}_walk_${idx}_log.json"
  local desc
  if [ "$char" = "altman" ]; then desc="$ALTMAN_DESC"; else desc="$DARIO_DESC"; fi

  local prompt="Convert the character on the right into the exact pose shown by the white stick-figure skeleton on the left. The output is a single full-body sprite of the character (NOT the skeleton).

CHARACTER (preserve from right reference): $desc.

POSE TARGET (match left skeleton): every body part — head, shoulders, elbows, wrists, hips, knees, ankles — must be at the position shown by the corresponding skeleton joint dot. Match leg spread, hip height, arm swing direction, head position EXACTLY as in the skeleton.

Background: pure flat magenta #ff00ff covering the entire output canvas.

DO NOT include skeleton lines, joint dots, head circle, the divider line, or anything from the reference layout in the output. The output is ONLY the fully drawn character sprite at 1024×1024."

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

export -f gen_pose
export SKILL OUT_DIR REF_DIR ALTMAN_DESC DARIO_DESC

# 4. 16 路并发
echo "=== Generating 16 pose-driven walk frames ==="
for char in altman dario; do
  for i in 1 2 3 4 5 6 7 8; do
    gen_pose "$char" "$i" &
  done
done
wait

echo "=== ALL DONE ==="
ls -lh "$OUT_DIR"/*.png 2>/dev/null | grep -v _log
