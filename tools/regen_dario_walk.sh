#!/bin/bash
# 重新生成 Dario 的 4 个 walk strip（facing LEFT，修复之前 prompt 写死 RIGHT 导致两个角色都朝右走的 bug）
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill
PROMPTS_TMP=/tmp/walk_prompts_dario
mkdir -p "$PROMPTS_TMP"

# 写 prompt 文件（强制 facing=LEFT）
for strip in walk_a walk_b walk_c walk_d; do
  python3 "$ROOT/tools/walk_cycle_prompts.py" "$strip" dario \
    > "$PROMPTS_TMP/${strip}.txt"
done

gen_strip () {
  local strip="$1"
  local prompt_file="$PROMPTS_TMP/${strip}.txt"
  local template="/tmp/dario_walk_template.png"
  local out="/tmp/dario_${strip}_strip.png"
  local log="/tmp/dario_${strip}_log.json"

  cd "$SKILL"
  node scripts/gpt_image_2_skill.cjs --json --provider DuckCoding \
    images edit \
    --ref-image "$template" \
    --prompt "$(cat "$prompt_file")" \
    --out "$out" \
    --size 2048x1024 \
    --quality high \
    --format png \
    --input-fidelity high > "$log" 2>&1
  if [ -f "$out" ]; then
    echo "DONE dario $strip -> $out"
  else
    echo "FAIL dario $strip"
  fi
}

export -f gen_strip
export SKILL PROMPTS_TMP

# 4 路并发
gen_strip walk_a &
gen_strip walk_b &
gen_strip walk_c &
gen_strip walk_d &
wait

echo "=== Slicing ==="
cd "$ROOT"
slice () {
  local letter="$1"
  local idx_start="$2"
  python3 tools/extract_strip.py \
    --strip "/tmp/dario_walk_${letter}_strip.png" \
    --frames 2 --cell-w 1024 --cell-h 1024 \
    --out-prefix "public/sprites/dario/dario_walk_" \
    --start-index "$idx_start" \
    --digits 2
}
slice a 1
slice b 3
slice c 5
slice d 7

echo "=== Normalize ==="
python3 tools/normalize_sprite.py --dir public/sprites/dario --in-place 2>&1 | grep walk

echo "=== ALL DONE ==="
