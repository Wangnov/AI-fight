#!/bin/bash
# 批量生成 VFX 资产（投射物/图标/特效/UI 元素）
# 用 transparent generate (codex provider 默认)
set -e

ROOT=/Users/wangnov/AI-fight
SKILL=/Users/wangnov/.claude/skills/gpt-image-2-skill

STYLE_BASE="cartoon arcade fighting game special effect sprite, bold thick black outline, saturated flat colors, no gradients, no soft shading, polished pixel-clean detail, vibrant punchy palette suitable for combat impact effects"

gen_vfx () {
  local name="$1"
  local prompt="$2"
  local size="${3:-1024x1024}"
  local out="$ROOT/public/sprites/vfx/${name}.png"
  local log="/tmp/vfx_${name}_log.json"

  cd "$SKILL"
  node scripts/gpt_image_2_skill.cjs --json --provider codex \
    transparent generate \
    --prompt "$prompt. $STYLE_BASE. Fully isolated centered subject with margin around it, clean readable silhouette." \
    --out "$out" \
    --size "$size" \
    --quality high > "$log" 2>&1
  if [ -f "$out" ]; then
    echo "DONE vfx $name -> $out"
  else
    echo "FAIL vfx $name (see $log)"
  fi
}

export -f gen_vfx
export ROOT SKILL STYLE_BASE

echo "=== VFX batch generation in parallel ==="

# 普攻命中特效图标
gen_vfx chatgpt_icon "A bright neon green ChatGPT logo: a swirling spiral whirlpool icon emitting subtle motion lines, vivid teal-aqua green color (#10A37F), centered single icon" &
gen_vfx claude_icon "A bright orange Claude logo: a stylized chrysanthemum or sunburst flower icon with radiating petals, vivid orange color (#FF8A4C), centered single icon" &
gen_vfx hit_spark "A bright white impact starburst burst spark with sharp jagged edges, like a comic-book hit effect, white core with yellow rim, dynamic sharp rays, centered, no background" &
gen_vfx block_flash "A bright cyan-blue defensive shield burst hexagonal hex-grid flash with energy ripples emanating outward from center, electric blue color (#00D9FF), centered" &

# Codex 组合技 1 投射物 + 爆炸
gen_vfx pr_folder "A flying pull-request folder icon with file tab and arrow symbol on it, viewed from side angle as if flying through the air, vibrant teal-green color (#10A37F), with motion trail emphasis, single icon centered" &
gen_vfx code_explode "An explosion burst made of code fragments and broken brackets, characters like { } [ ] = > scattered outward from center, neon teal-green and white, dynamic explosion shape with sharp rays" &

# Benchmark 柱状图
gen_vfx benchmark_chart "A bar chart explosion: an upward-pointing benchmark bar graph with three rising bars (each bar a teal-green block with thick black outline), an UP ARROW prominently above the bars, NO numbers on the y-axis (deliberately blank axis), satirical SOTA performance chart effect, dynamic upward bursting orientation" &

# Mythos 大门 + 漏洞碎片
gen_vfx mythos_gate "A mystical locked chamber gate door, partially cracked open showing a glowing orange-purple inner light leaking out from the seam, ornate gothic-cathedral arched doorway design, deep purple frame with orange glow, foreboding mystical mood, centered front view" &
gen_vfx vulnerability_shard "A jagged shattered crystalline shard fragment in glowing purple-orange gradient, with sharp angular edges and a subtle '1/198' marking faintly etched on its surface, looks like a broken piece of locked information, single shard centered" &

# Constitution 飞页
gen_vfx constitution_pages "A fan of glowing parchment law pages spreading outward in a fan shape, each page glowing deep orange-amber with inscriptions visible (placeholder squiggle text), connected by a binding spine on left, like an opening sacred legal book mid-strike" &

# Altman 大招 VFX
gen_vfx chair "An ergonomic mesh office chair with five-star wheeled base, seen from a side angle, modern Aeron-style design in dark grey and black, drawn in cartoon arcade style with bold outline, single isolated chair centered" &
gen_vfx shockwave "A massive expanding teal-green shockwave ring radiating outward from center, concentric energy rings, vibrant emerald color, sharp comic-book burst lines, dynamic explosive expansion effect" &
gen_vfx mushroom_cloud "A cartoon mushroom cloud explosion made of marketing logos and tech bubbles: ChatGPT swirl + bar chart + 'AGI SOON' speech bubble shape woven into the rising cloud column, vibrant teal-green and white, satirical hype-explosion effect, full mushroom shape standing vertical" &

# Dario 大招 VFX
gen_vfx cathedral_bg "A vertical column of stained-glass cathedral light streaming down from above, gothic arch silhouette outlined in deep purple, golden light shafts, holy judgment atmosphere, vertical orientation tall format" "768x1024" &
gen_vfx access_denied_stamp "A massive bold red 'ACCESS DENIED' rubber stamp seal with two-line text 'ACCESS DENIED' top and 'ADVERSARIAL REALM' bottom, tilted at slight angle, splattered ink edges, vivid bright red color (#FF1F1F), authoritative bureaucratic stamp, single isolated stamp centered" &
gen_vfx orange_pillar "A vertical column pillar of swirling orange-purple energy beam shooting up from ground, like divine judgment light, vibrant saturated orange (#FF8A4C) and purple, vertical tall format" "768x1024" &
gen_vfx mini_stamps "A scattered cluster of small rubber stamps falling like rain, each stamp red with text fragments like 'KYC FAILED' / 'REGION BLOCKED' / 'ID REJECTED', tilted at various angles, comic style, multiple stamps arrangement on transparent background" &

# KYC UI 弹窗 (3 张)
gen_vfx kyc_step1 "A retro fake operating-system dialog window with title bar 'IDENTITY VERIFICATION powered by Persona', body shows checklist of accepted IDs (Passport, Driver License, National ID Card with green checkmarks) and rejected items (Photocopies, Digital IDs, Student Cards, 中国身份证 with red X marks), beige Windows-95 style chrome, single dialog box centered" &
gen_vfx kyc_step2 "A retro fake dialog window 'LIVE SELFIE REQUIRED', shows a webcam frame with a generic person silhouette inside (👤), text 'Hold still... This typically takes under five minutes', authoritative bureaucratic UI, beige OS chrome, single dialog centered" &
gen_vfx kyc_step3 "A retro fake dialog window with progress bar (filled to 87%), text 'VERIFYING...' transitioning to large red 'VERIFICATION FAILED' text, reason 'UNSUPPORTED REGION', two buttons '[Appeal] [Contact Sales]' at bottom, beige OS chrome, single dialog centered" &

# 通用 VFX
gen_vfx ko_text "A massive comic-book style 'K.O.' text in bold yellow with thick red drop-shadow outline, large impact lettering with motion radiating sharp lines behind, victory-strike font, centered, no background" &
gen_vfx screen_lines "Vertical screen-shake motion lines: a series of parallel diagonal speed/impact lines on transparent background, sharp white and black, comic style, full canvas spread" &
gen_vfx dust "A small puff of dust kicked up from feet, soft cloud shape with curled edges, beige-tan color, comic-style impact dust cloud, centered single puff" &
gen_vfx under_review "A grey 'UNDER REVIEW' watermark stamp with bureaucratic forbidden seal feel, thick black outline, semi-transparent grey fill, tilted text, official-looking" &

wait
echo "=== ALL VFX DONE ==="
ls -lh "$ROOT/public/sprites/vfx/"
