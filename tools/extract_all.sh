#!/bin/bash
# 批量切片 walk strips（8 strips → 16 frames）+ 抠透明所有 raw single frames
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill

cd "$ROOT"

# === 1. 切 8 个 walk strips ===
# 每个 strip 2 frames，按规则编号 walk_01..08
slice_walk () {
  local char="$1"
  local letter="$2"   # a/b/c/d
  local idx_start="$3"
  python3 tools/extract_strip.py \
    --strip "/tmp/${char}_walk_${letter}_strip.png" \
    --frames 2 --cell-w 1024 --cell-h 1024 \
    --out-prefix "public/sprites/${char}/${char}_walk_" \
    --start-index "$idx_start" \
    --digits 2
}

for char in altman dario; do
  slice_walk "$char" a 1   # walk_01 (contact_L) + walk_02 (down_L)
  slice_walk "$char" b 3   # walk_03 (passing_L) + walk_04 (up_L)
  slice_walk "$char" c 5   # walk_05 (contact_R) + walk_06 (down_R)
  slice_walk "$char" d 7   # walk_07 (passing_R) + walk_08 (up_R)
done

# === 2. 抠 23 个 single frames 透明 ===
extract_alpha () {
  local char="$1"
  local frame="$2"
  local raw="/tmp/raw_${char}_${frame}.png"
  local out="public/sprites/${char}/${char}_${frame}.png"
  if [ ! -f "$raw" ]; then
    echo "MISSING raw $char $frame"
    return
  fi
  cd "$SKILL"
  node scripts/gpt_image_2_skill.cjs --json \
    transparent extract \
    --input "$raw" \
    --out "$ROOT/$out" \
    --method chroma --matte-color "#ff00ff" --profile generic --strict > /tmp/extract_${char}_${frame}.json 2>&1
  cd "$ROOT"
  echo "DONE extract $char $frame"
}

export -f extract_alpha
export ROOT SKILL

# 并发抠透明
for char in altman dario; do
  for frame in jump crouch block knockdown; do
    extract_alpha "$char" "$frame" &
  done
done
# 招式专用帧（每个角色对应 7 帧大招或组合技）
for frame in codex_cast codex_throw benchmark_windup benchmark_swing sit_down lean_back burst recover; do
  extract_alpha altman "$frame" &
done
for frame in mythos_cast mythos_release constitution_cast constitution_swing judge_pose slam recover; do
  extract_alpha dario "$frame" &
done
wait

echo "=== ALL EXTRACTIONS DONE ==="
ls public/sprites/altman/ | wc -l
echo " Altman files"
ls public/sprites/dario/ | wc -l
echo " Dario files"
ls public/sprites/vfx/ | wc -l
echo " VFX files"
