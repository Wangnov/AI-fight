#!/bin/bash
# 批量生成两人 combo1 投射物 cast/throw 共 4 帧
# Altman: codex_cast → codex_throw（投 PR 文件夹）
# Dario:  mythos_cast → mythos_release（召唤紫橙大门 + 释放漏洞碎片）
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill
REF_DIR=/tmp/pose_refs
OUT_DIR=/tmp/pose_outs
mkdir -p "$REF_DIR" "$OUT_DIR"

for char in altman dario; do
  for i in 1 2; do
    "$ROOT/.venv/bin/python" "$ROOT/tools/build_pose_ref.py" \
      --base "$ROOT/public/sprites/$char/${char}_idle_01.png" \
      --action combo1 \
      --skel-frame "$i" \
      --char "$char" \
      --out "$REF_DIR/${char}_combo1_$(printf '%02d' "$i")_ref.png"
  done
done

ALTMAN_DESC="lean wiry male arcade fighter, messy dark curly hair, sharp angular face, narrow pointed chin, intense piercing eyes, clean-shaven; teal-aqua-green sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots; bold thick black outlines, saturated cel-shaded flat colors, polished arcade 2D fighting game illustration style, NOT pixel art, NOT 8-bit"
DARIO_DESC="stocky combat-ready male arcade fighter, messy curly brown hair, round face, BLACK ROUND-FRAME GLASSES (must be clearly visible), clean-shaven; deep saturated orange sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots; bold thick black outlines, saturated cel-shaded flat colors, polished arcade 2D fighting game illustration style, NOT pixel art, NOT 8-bit"

get_key () {
  local char="$1"; local i="$2"
  if [ "$char" = "altman" ]; then
    [ "$i" = "1" ] && echo "codex_cast" || echo "codex_throw"
  else
    [ "$i" = "1" ] && echo "mythos_cast" || echo "mythos_release"
  fi
}

gen_pose () {
  local char="$1"
  local i="$2"
  local idx
  idx=$(printf '%02d' "$i")
  local ref="$REF_DIR/${char}_combo1_${idx}_ref.png"
  local key
  key=$(get_key "$char" "$i")
  local out="$OUT_DIR/${char}_${key}.png"
  local log="$OUT_DIR/${char}_${key}_log.json"
  local desc
  if [ "$char" = "altman" ]; then desc="$ALTMAN_DESC"; else desc="$DARIO_DESC"; fi

  local prompt="Convert the character on the right into the EXACT pose shown by the white stick-figure skeleton on the left. The output is a single full-body sprite of the character casting/throwing a projectile (NOT the skeleton itself).

CHARACTER (preserve identity from right reference): $desc.

POSE TARGET (match left skeleton precisely): every body part — head, shoulders, elbows, wrists, hips, knees, ankles — must be at the position shown by the corresponding skeleton joint dot. The skeleton shows a CASTING/THROWING animation frame: hands extended forward in front of body (cast), or both hands pushed forward at maximum reach with body leaning forward (throw).

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
  if [ -f "$out" ]; then echo "DONE $char $key"; else echo "FAIL $char $key"; fi
}

export -f gen_pose get_key
export SKILL OUT_DIR REF_DIR ALTMAN_DESC DARIO_DESC

echo "=== Generating 4 pose-driven combo1 frames ==="
for char in altman dario; do
  for i in 1 2; do
    gen_pose "$char" "$i" &
  done
done
wait

echo "=== Chroma extract + replace ==="
for char in altman dario; do
  for i in 1 2; do
    key=$(get_key "$char" "$i")
    raw="$OUT_DIR/${char}_${key}.png"
    out="$ROOT/public/sprites/${char}/${char}_${key}.png"
    cd "$SKILL"
    node scripts/gpt_image_2_skill.cjs --json \
      transparent extract --input "$raw" --out "$out" \
      --method chroma --matte-color "#ff00ff" --profile generic --strict \
      > /tmp/combo1_extract_${char}_${key}.json 2>&1
    cd "$ROOT"
    echo "  EXTRACTED $char $key"
  done
done

echo "=== Normalize ==="
"$ROOT/.venv/bin/python" "$ROOT/tools/normalize_sprite.py" --dir "$ROOT/public/sprites/altman" --in-place 2>&1 | grep -E "codex"
"$ROOT/.venv/bin/python" "$ROOT/tools/normalize_sprite.py" --dir "$ROOT/public/sprites/dario" --in-place 2>&1 | grep -E "mythos"

echo "=== ALL DONE ==="
