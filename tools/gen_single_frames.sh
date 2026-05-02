#!/bin/bash
# 批量并发生成所有"单帧 pose"（非 walk cycle 的状态/招式专用帧）
# 用 idle_01 作 base ref（已经是街机风），减少 AI 漂移
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill

ALTMAN_BRIEF="lean wiry male arcade fighter with messy dark curly hair, sharp angular face, narrow pointed chin, intense piercing eyes, clean-shaven. TEAL-AQUA-GREEN sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots."
DARIO_BRIEF="stocky combat-ready male arcade fighter with messy curly brown hair, round face, BLACK ROUND-FRAME GLASSES (must be clearly visible), clean-shaven. DEEP SATURATED ORANGE sleeveless muscle tee, black tactical cargo pants with belt straps, black fingerless gloves, black combat boots."

# 统一画风约束
STYLE="ARCADE 2D FIGHTING GAME illustration style of Street Fighter / King of Fighters, heavy thick black outlines, saturated rich flat colors with simple cel-shaded lighting (no soft gradients), polished detail at 1024x1024 resolution. Same character identity, same outfit, same outline weight, same palette as the reference image."

# 通用尾部约束
TAIL="Background: pure flat magenta #ff00ff covering the entire canvas. Full body framed centered with margin. No text, no logos, no scenery, no shadows, no motion lines, no speed effects, no dust. Single character only."

# 生成单帧函数
gen_frame () {
  local char="$1"
  local frame="$2"
  local pose="$3"
  local facing="$4"  # right or left
  local brief
  if [ "$char" = "altman" ]; then brief="$ALTMAN_BRIEF"; else brief="$DARIO_BRIEF"; fi

  local ref="$ROOT/public/sprites/$char/${char}_idle_01.png"
  local out="/tmp/raw_${char}_${frame}.png"
  local log="/tmp/${char}_${frame}_log.json"

  local prompt="Redraw this character in a NEW pose: $pose. Character faces ${facing}.

CHARACTER: $brief

STYLE: $STYLE Match the input image's art style EXACTLY — do not change to pixel art, do not soften details.

$TAIL"

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
  if [ -f "$out" ]; then
    echo "DONE $char $frame -> $out"
  else
    echo "FAIL $char $frame (see $log)"
  fi
}

export -f gen_frame
export ROOT SKILL ALTMAN_BRIEF DARIO_BRIEF STYLE TAIL

echo "=== Phase 2.B/C: generating single-pose frames in parallel ==="

# === Altman 角色状态帧 ===
gen_frame altman jump      "JUMPING in mid-air, both knees bent up high, body tucked, arms thrown back for balance, looking forward, vertical motion pose" right &
gen_frame altman crouch    "CROUCHED low, both knees fully bent, body compressed, hands raised in defensive guard near face, looking forward" right &
gen_frame altman block     "DEFENSIVE BLOCK stance, both forearms crossed in front of face/chest, body slightly turned away, knees bent low and ready, fully covering vital areas" right &
gen_frame altman knockdown "KNOCKED DOWN on the ground lying on back, eyes closed in defeat, arms sprawled out to sides, legs slightly bent, lying flat" right &

# === Altman 招式专用帧 ===
gen_frame altman codex_cast    "CASTING POSE: holding hands forward summoning a glowing rectangular shape (folder icon) between palms at chest level, fingers splayed, body slightly tilted forward in spell-casting stance, intense focused expression" right &
gen_frame altman codex_throw   "THROWING FORWARD: right arm fully extended forward releasing/launching an object, body twisted forward with momentum, left arm pulled back, weight on front foot, action shot of throwing motion" right &
gen_frame altman benchmark_windup "WINDUP CROUCH: crouched low gathering strength, right fist clenched at hip ready to strike upward, left hand bracing forward, body coiled and tense" right &
gen_frame altman benchmark_swing  "UPPERCUT SWING: right arm fully extended UPWARD in a powerful uppercut motion, body launched upward standing on tip-toes, left arm pulled back, fierce shouting expression" right &

# === Altman 大招阶段帧 ===
gen_frame altman sit_down  "SITTING DOWN HEAVILY on an invisible chair (suggested seat behind), legs together bent at knees, hands on knees, body slumped, looking exhausted/disillusioned, head slightly down" right &
gen_frame altman lean_back "LEANING BACK in chair sprawled languidly, head tilted back staring upward at the ceiling, arms relaxed at sides, eyes vacant/distant gaze, ennui pose" right &
gen_frame altman burst     "EXPLOSIVE LAUNCH: bursting upward from sitting, both arms thrown wide outward, body fully extended in a triumphant explosive shout, mouth open yelling, dynamic upward motion" right &
gen_frame altman recover   "ADJUSTING JACKET / TIE casually after big move, calmly straightening clothing on chest with both hands, smug confident expression, standing relaxed" right &

# === Dario 角色状态帧 ===
gen_frame dario jump      "JUMPING in mid-air, both knees bent up high, body tucked, arms thrown back for balance, looking forward, vertical motion pose" left &
gen_frame dario crouch    "CROUCHED low, both knees fully bent, body compressed, hands raised in defensive guard, looking forward" left &
gen_frame dario block     "DEFENSIVE BLOCK stance, both forearms crossed in front of face/chest, body slightly turned away, knees bent, fully covering vital areas" left &
gen_frame dario knockdown "KNOCKED DOWN on the ground lying on back, eyes closed in defeat, glasses crooked, arms sprawled out, legs slightly bent" left &

# === Dario 招式专用帧 ===
gen_frame dario mythos_cast    "SUMMONING POSE: both arms raised at chest level palms forward, summoning an invisible gate/door, body grounded firmly, fingers spread, focused stern expression" left &
gen_frame dario mythos_release "RELEASING ENERGY: hands thrust forward together, palms outward, releasing energy beam forward, body slightly leaning forward into the action, intense expression" left &
gen_frame dario constitution_cast "OPENING A LARGE BOOK: holding an invisible large open book in both hands at chest level, looking down at the book, body slightly bent forward in studious focus" left &
gen_frame dario constitution_swing "BOOK SWEEP STRIKE: arms swinging the book forward in an arc strike, both hands gripping the (invisible) book, body twisted forward with momentum, mid-strike action shot" left &

# === Dario 大招阶段帧 ===
gen_frame dario judge_pose "JUDGMENT POSE: standing tall with right hand raised palm out (stop/halt gesture), left hand at side, dignified authoritative stance like a high priest or judge, stern unyielding expression, glasses gleaming" left &
gen_frame dario slam       "SLAMMING DOWN: both hands raised high overhead together about to slam down a heavy invisible object (giant stamp), body coiled in downward strike motion, intense expression" left &
gen_frame dario recover    "CLOSING A LARGE BOOK calmly with both hands at chest, book closed, looking forward with composed serious expression, standing still" left &

wait

echo "=== ALL SINGLE FRAMES DONE ==="
ls -lh /tmp/raw_*.png
