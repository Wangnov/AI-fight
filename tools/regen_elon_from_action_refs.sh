#!/bin/bash
# Regenerate Elon Mask action frames from KOF/SF bitmap action sheets.
# Batches run in parallel; frames inside each batch also run in parallel.
set -euo pipefail

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.agents/skills/gpt-image-2-skill
REF_DIR="$ROOT/tools/asset_refs/action_refs/elon_action_refs"
RAW_DIR=/tmp/ai_fight_elon_action_regen
mkdir -p "$RAW_DIR" "$ROOT/public/sprites/elon"

ELON_BASE="$ROOT/public/sprites/elon/elon_idle_01.png"
ELON_PHOTO="$ROOT/tools/asset_refs/elon_musk_2024_cropped.jpg"

ELON_DESC="middle-aged male arcade fighter clearly resembling Elon Musk: broad rounded face, high forehead, receding dark hairline, swept dark-brown hair, heavy-lidded tired eyes, straight broad nose, compressed downturned mouth, square jaw, thicker neck, subtle grey stubble. Black futuristic bomber jacket over plain white shirt, dark tactical pants, black combat boots, black fingerless gloves, subtle electric-cyan trims. No real-company logos or text."

STYLE="Smooth cel-shaded arcade 2D fighting game sprite, thick black outlines, saturated colors, same AI Fight style as the base sprite. NOT pixel art, NOT chibi, NOT anime closeup."

BASE_TAIL="Pure flat magenta #ff00ff background only. Full body visible, centered, head and feet not cut off. Character faces RIGHT. No text, no logos, no brand marks, no scenery, no shadows, no motion trails, no extra objects."

gen_one () {
  local batch="$1"
  local key="$2"
  local prompt_extra="$3"
  local sheet="$REF_DIR/${batch}_sheet.png"
  local frame_ref="$REF_DIR/${key}_ref.png"
  local raw="$RAW_DIR/elon_${key}.png"
  local out="$ROOT/public/sprites/elon/elon_${key}.png"
  local log="$RAW_DIR/elon_${key}_log.json"
  local extract_log="$RAW_DIR/elon_${key}_extract.json"

  local prompt="Regenerate ONE frame for the Elon Mask fighter: ${key}.

Use the KOF/SF action sheet reference ONLY for body mechanics, timing, contact points, weight shift, limb angle, and frame-to-frame fighting-game rhythm.
Use the single frame crop reference as the exact phase for this output.
Do NOT copy the reference character, outfit, pixel-art style, face, colors, or resolution.

Preserve this character identity from the base sprite and photo:
${ELON_DESC}

${prompt_extra}

STYLE: ${STYLE}

${BASE_TAIL}"

  cd "$SKILL"
  node scripts/gpt_image_2_skill.cjs --json --provider DuckCoding \
    images edit \
    --ref-image "$ELON_PHOTO" \
    --ref-image "$ELON_BASE" \
    --ref-image "$sheet" \
    --ref-image "$frame_ref" \
    --prompt "$prompt" \
    --out "$raw" \
    --size 1024x1024 \
    --quality high \
    --format png \
    --input-fidelity high > "$log" 2>&1

  node scripts/gpt_image_2_skill.cjs --json \
    transparent extract \
    --input "$raw" \
    --out "$out" \
    --method chroma \
    --matte-color "#ff00ff" \
    --profile generic \
    --strict > "$extract_log" 2>&1

  echo "DONE $key"
}

run_walk () {
  local extra="This is a 4-frame walk cycle. Keep all four frames the same apparent body size and foot baseline. Frame must be a readable walk phase, not a static idle. Arms counter-swing naturally; hips and shoulders shift like the KOF reference."
  gen_one walk walk_01 "$extra Frame 1: forward foot contact, rear foot pushing off." &
  gen_one walk walk_02 "$extra Frame 2: passing position, body weight moving forward." &
  gen_one walk walk_03 "$extra Frame 3: opposite foot contact, mirrored rhythm from frame 1." &
  gen_one walk walk_04 "$extra Frame 4: passing recovery position leading back to frame 1." &
  wait
}

run_jab () {
  local extra="This is a 3-frame jab punch. Keep the same body scale and baseline across the sequence. The fist path must progress clearly from guard to extension to recovery."
  gen_one jab jab_01 "$extra Frame 1: guard/startup, shoulder coils and lead fist begins forward." &
  gen_one jab jab_02 "$extra Frame 2: active jab, lead arm sharply extended at opponent head/chest height." &
  gen_one jab jab_03 "$extra Frame 3: recovery, fist retracting and torso settling back into stance." &
  wait
}

run_combo1 () {
  local extra="This is a 2-frame projectile casting move. The body mechanics should match a hadouken-style cast: crouched grounded stance, both hands forward, strong forward weight transfer. Do not draw the projectile in the character sprite."
  gen_one combo1 orbit_cast "$extra Frame 1: charge/cast, hands cupped near torso, weight loaded." &
  gen_one combo1 orbit_throw "$extra Frame 2: release, hands thrust forward, torso leaning into the throw." &
  wait
}

run_combo2 () {
  local extra="This is a 2-frame heavy rising strike. The move must read as windup into vertical launch/uppercut, with a much stronger attack silhouette than jab."
  gen_one combo2 rocket_windup "$extra Frame 1: low windup, knees bent, fist loaded near hip." &
  gen_one combo2 rocket_swing "$extra Frame 2: upward swing/launch, fist and chest driving up." &
  wait
}

run_states () {
  gen_one states idle_02 "Idle breathing variant: same stance as idle_01 with a subtle weight/shoulder shift." &
  gen_one states jump "Jumping frame: airborne full body, knees tucked, guard maintained." &
  gen_one states crouch "Crouch frame: low compact guard, knees bent, readable defensive posture." &
  gen_one states block "Block frame: forearms raised/crossed in front of head and chest, braced stance." &
  gen_one states hit "Hit reaction frame: torso recoils backward, face grimaces, arms disrupted." &
  gen_one states knockdown "Knockdown frame: body lying on ground, readable defeated full-body pose." &
  gen_one states lose "Lose frame: exhausted defeated pose, slumped or down, not heroic." &
  gen_one states win "Win frame: confident victory pose with one fist raised, still recognizable as Elon." &
  wait
}

run_ultimate () {
  gen_one ultimate keynote_pose "Ultimate phase 1: keynote/product reveal pose, one hand presenting, other hand near chest as if holding a remote." &
  gen_one ultimate countdown_pose "Ultimate phase 2: low countdown/launch-button pose, tense crouched forward body." &
  gen_one ultimate launch_pose "Ultimate phase 3: launch pose, upward explosive motion, one arm driving skyward." &
  gen_one ultimate recover "Ultimate phase 4: recover pose, calmly lowering an invisible remote and adjusting jacket collar." &
  wait
}

run_walk &
run_jab &
run_combo1 &
run_combo2 &
run_states &
run_ultimate &
wait

cd "$ROOT"
"$ROOT/.venv/bin/python" "$ROOT/tools/normalize_sprite.py" \
  --dir "$ROOT/public/sprites/elon" \
  --in-place
"$ROOT/.venv/bin/python" "$ROOT/tools/normalize_elon_scale.py" \
  --dir "$ROOT/public/sprites/elon"
