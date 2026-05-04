#!/bin/bash
# 并发生成两人各 4 strip 的 walk cycle (共 8 个 strip = 16 帧)
# DuckCoding 支持高并发，所有 8 任务同时跑
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill
PROMPTS_TMP=/tmp/walk_prompts
mkdir -p "$PROMPTS_TMP"

# 1. 生成 layout guide (2 frames × 1024×1024)
python3 "$ROOT/tools/gen_layout_guide.py" walk_strip 2 1024 1024

# 2. 为每个角色 + strip 生成 base-prefilled template (一次 magenta 底+2 base 副本)
for char in altman dario; do
  python3 "$ROOT/tools/build_strip_template.py" \
    --base "$ROOT/public/sprites/$char/${char}_idle_01.png" \
    --layout "$ROOT/tools/layout_guides/walk_strip.png" \
    --frames 2 --cell-w 1024 --cell-h 1024 \
    --out "/tmp/${char}_walk_template.png"
done

# 3. 写 prompt 文件
for char in altman dario; do
  for strip in walk_a walk_b walk_c walk_d; do
    python3 "$ROOT/tools/walk_cycle_prompts.py" "$strip" "$char" \
      > "$PROMPTS_TMP/${char}_${strip}.txt"
  done
done

# 4. gen_strip 函数：一个 strip 的生成
gen_strip () {
  local char="$1"
  local strip="$2"
  local prompt_file="$PROMPTS_TMP/${char}_${strip}.txt"
  local template="/tmp/${char}_walk_template.png"
  local out="/tmp/${char}_${strip}_strip.png"
  local log="/tmp/${char}_${strip}_log.json"

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
    echo "DONE $char $strip -> $out"
  else
    echo "FAIL $char $strip (see $log)"
  fi
}

export -f gen_strip
export SKILL PROMPTS_TMP

# 5. 8 路并发
echo "=== Generating 8 walk strips in parallel ==="
gen_strip altman walk_a &
gen_strip altman walk_b &
gen_strip altman walk_c &
gen_strip altman walk_d &
gen_strip dario walk_a &
gen_strip dario walk_b &
gen_strip dario walk_c &
gen_strip dario walk_d &
wait

echo "=== ALL WALK STRIPS DONE ==="
ls -lh /tmp/*_walk_*_strip.png
