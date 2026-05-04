#!/bin/bash
# Generate matchup-aware arena backgrounds and the opening/menu background.
set -euo pipefail

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.agents/skills/gpt-image-2-skill
OUT_DIR="$ROOT/public/sprites/scene"
RAW_DIR=/tmp/ai_fight_stage_backgrounds
mkdir -p "$RAW_DIR" "$OUT_DIR"

BACKGROUND_REF_DIR="$ROOT/tools/asset_refs/background_refs"
ARENA_REF="$BACKGROUND_REF_DIR/base_bg_arena.png"
MENU_REF="$BACKGROUND_REF_DIR/base_menu_bg.png"
LOGO_DIR="$ROOT/tools/asset_refs/logo_refs"
OPENAI_LOGO="$LOGO_DIR/openai.png"
ANTHROPIC_LOGO="$LOGO_DIR/anthropic.png"
CLAUDE_LOGO="$LOGO_DIR/claude.png"
GROK_LOGO="$LOGO_DIR/grok.png"

STYLE_LOCK="Smooth cel-shaded 2D arcade fighting game stage background, same AI Fight visual language as the reference: crisp painterly linework, saturated neon lighting, high-contrast readable silhouettes, premium fighting-game arena polish."
LAYOUT_LOCK="16:9 side-view arena composition. Empty playable center lane. Clear horizontal fighting floor around 72% image height. No characters, no crowds in the foreground, no UI, no title text, no readable slogans. Keep the top corners darker and calmer so fighting HUD bars remain readable."
LOGO_LOCK="Use the logo reference images as architectural emblems, stained-glass symbols, holographic wall inlays, or large back-wall signage motifs. The emblems must be generated as part of the painted background architecture, not pasted overlays, not flat stickers, not floating cards, not UI panels, not plaques. OpenAI uses the knot emblem. Anthropic uses the AI letterform and Claude starburst. Grok uses the Grok circle with diagonal lightning slash from the reference image; do NOT use the xAI X logo, do NOT use a generic lightning bolt, do NOT invent another symbol."

for slug in openai anthropic claude grok; do
  if [[ ! -f "$LOGO_DIR/${slug}.png" ]]; then
    rsvg-convert -w 512 -h 512 -o "$LOGO_DIR/${slug}.png" "$LOGO_DIR/${slug}.svg"
  fi
done

gen_bg () {
  local key="$1"
  local out="$2"
  local prompt="$3"
  shift 3
  local log="$RAW_DIR/${key}.json"
  local ref_args=()
  for ref in "$@"; do
    ref_args+=(--ref-image "$ref")
  done

  cd "$SKILL"
  node scripts/gpt_image_2_skill.cjs --json --json-events --provider DuckCoding \
    images edit \
    "${ref_args[@]}" \
    --prompt "$prompt" \
    --out "$out" \
    --size 1280x720 \
    --quality high \
    --format png \
    --input-fidelity high > "$log" 2>&1
  echo "DONE $key -> $out"
}

MENU_PROMPT="${STYLE_LOCK}

Create a new opening/menu background for AI Fight with a true all-star fighting-game attract-screen feeling. Use the reference for the rain-soaked stadium mood and preserve the original iconic brand-emblem feeling, but broaden it to include three competing worlds in one dramatic arena: left cyan frontier AI lab architecture with an OpenAI knot emblem built into the structure; center amber gothic safety tribunal architecture with Anthropic AI and Claude starburst emblems built into stained glass; right violet-blue aerospace launch control architecture with the exact Grok circle-and-diagonal-lightning emblem built into the hangar wall. Leave the lower foreground clear for three full-body fighter poses added by the game: Altman under the left OpenAI building, Dario under the center Anthropic/Claude cathedral, Elon under the right Grok launch hangar. The composition should feel like a crossover roster stage, not a poster. ${LOGO_LOCK} ${LAYOUT_LOCK}"

ALTMAN_DARIO_PROMPT="${STYLE_LOCK}

Regenerate the Altman vs Dario arena. Preserve the original stage identity: left side has a large OpenAI knot emblem generated into cyan frontier AI lab architecture; right side has a large Anthropic AI / Claude safety emblem generated into amber-purple gothic tribunal stained glass. Center seam should be a clean duel line, with a glossy floor reflecting both worlds. ${LOGO_LOCK} ${LAYOUT_LOCK}"

ALTMAN_ELON_PROMPT="${STYLE_LOCK}

Generate an Altman vs Elon arena using the existing stage as style reference. Left side: cyan AI research lab and model-training control room with a large OpenAI knot emblem generated into a glass terminal wall. Right side: violet-blue aerospace launch hangar with rocket gantries, electric telemetry screens, and the exact Grok circle-and-diagonal-lightning emblem generated into the command-wall architecture. Make it feel like lab access versus launch velocity. ${LOGO_LOCK} ${LAYOUT_LOCK}"

DARIO_ELON_PROMPT="${STYLE_LOCK}

Generate a Dario vs Elon arena using the existing stage as style reference. Left side: amber/purple safety cathedral courtroom with Anthropic AI / Claude emblem generated into stained glass, formal audit architecture. Right side: violet-blue launch command bunker with rocket gantry silhouettes, hard industrial lights, and the exact Grok circle-and-diagonal-lightning emblem generated into machinery or glass. Make the center feel like a tense hearing inside a launch facility. ${LOGO_LOCK} ${LAYOUT_LOCK}"

MIRROR_PROMPT="${STYLE_LOCK}

Generate a neutral mirror-match arena for any same-character fight. It should be a symmetrical AI coliseum at night: split-color neon lighting, cyan on the left and orange-violet on the right, central storm-lit fighting platform, abstract circuitry and gothic arches blended into one balanced stage. Include subtle integrated emblem reliefs generated into the architecture. ${LOGO_LOCK} ${LAYOUT_LOCK}"

gen_bg menu "$OUT_DIR/menu_bg.png" "$MENU_PROMPT" "$MENU_REF" "$ARENA_REF" "$OPENAI_LOGO" "$ANTHROPIC_LOGO" "$GROK_LOGO" &
gen_bg altman_dario "$OUT_DIR/bg_arena_altman_dario.png" "$ALTMAN_DARIO_PROMPT" "$ARENA_REF" "$MENU_REF" "$OPENAI_LOGO" "$ANTHROPIC_LOGO" "$CLAUDE_LOGO" &
gen_bg altman_elon "$OUT_DIR/bg_arena_altman_elon.png" "$ALTMAN_ELON_PROMPT" "$ARENA_REF" "$MENU_REF" "$OPENAI_LOGO" "$GROK_LOGO" &
gen_bg dario_elon "$OUT_DIR/bg_arena_dario_elon.png" "$DARIO_ELON_PROMPT" "$ARENA_REF" "$MENU_REF" "$ANTHROPIC_LOGO" "$CLAUDE_LOGO" "$GROK_LOGO" &
gen_bg mirror "$OUT_DIR/bg_arena_mirror.png" "$MIRROR_PROMPT" "$ARENA_REF" "$MENU_REF" "$OPENAI_LOGO" "$ANTHROPIC_LOGO" "$GROK_LOGO" &
wait

cd "$ROOT"
cp "$OUT_DIR/bg_arena_altman_dario.png" "$OUT_DIR/bg_arena.png"

oxipng -o 4 --strip safe \
  "$OUT_DIR/menu_bg.png" \
  "$OUT_DIR/bg_arena.png" \
  "$OUT_DIR/bg_arena_altman_dario.png" \
  "$OUT_DIR/bg_arena_altman_elon.png" \
  "$OUT_DIR/bg_arena_dario_elon.png" \
  "$OUT_DIR/bg_arena_mirror.png"
