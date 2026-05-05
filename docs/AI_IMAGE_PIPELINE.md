# AI Image Pipeline

This document records the AI Fight image-generation pipeline that lives inside
this repository. The external `gpt-image-2-skill` runtime is treated as a tool
dependency; this file only describes project-owned inputs, scripts, outputs, and
acceptance checks.

## Scope

AI Fight ships bitmap-heavy arcade assets:

- character sprites in `public/sprites/{altman,dario,elon}/`
- scene art in `public/sprites/scene/`
- VFX and UI bitmaps in `public/sprites/vfx/`
- README showcase art in `docs/readme/` and `docs/screenshots/`

The durable project index is [tools/assets_manifest.json](../tools/assets_manifest.json).
Use it to find the current script entrypoint for each asset family.

## Core Rules

1. Use existing project assets as references.
2. Use real action sheets for fighting motion whenever frame continuity matters.
3. Generate on pure magenta `#ff00ff` or transparent backgrounds.
4. Extract transparency before committing sprites.
5. Normalize body scale and foot baseline before judging animation.
6. Validate visually as action-specific sheets, not only as individual PNGs.
7. Integrate by registering the produced filenames in code, then test in-game.

The most reliable character-action path is not prompt-only generation. Use a
base sprite for identity, a real photo when likeness matters, and KOF/SF action
references for body mechanics.

## Directory Map

| Path | Purpose |
|---|---|
| `tools/asset_refs/` | Stable project reference inputs: people, logos, backgrounds, action sheets. |
| `tools/asset_refs/action_refs/` | KOF/SF action references used for fighting animation timing and poses. |
| `tools/asset_refs/action_refs/elon_action_refs/` | Per-action sheets and per-frame crops for Elon action regeneration. |
| `tools/asset_refs/background_refs/` | Base arena/menu backgrounds used as style and composition anchors. |
| `tools/asset_refs/logo_refs/` | LobeHub SVGs and rendered PNG logo references for background generation. |
| `tools/layout_guides/` | Generated layout guides for strip-style generation. |
| `tools/_pose/` | MediaPipe pose JSON and markdown reports for sprite QA. |
| `tools/_skeleton/` | Walk/jab skeleton reference images for older pose-driven generation. |
| `public/sprites/` | Shipping game assets consumed by PixiJS. |

## Current Pipelines

### Elon Action Frames

Use this for Elon walk, jab, projectile, heavy, state, and ultimate frame batches.

```bash
python tools/build_elon_action_refs.py
bash tools/regen_elon_from_action_refs.sh
```

What it does:

- builds KOF/SF action sheets and per-frame crops from
  `tools/asset_refs/action_refs/`
- uses `tools/asset_refs/elon_musk_2024_cropped.jpg` for likeness
- uses `public/sprites/elon/elon_idle_01.png` for AI Fight sprite style
- generates frames in parallel through DuckCoding
- extracts magenta background through chroma
- writes final files to `public/sprites/elon/`
- runs `tools/normalize_sprite.py` and `tools/normalize_elon_scale.py`

Important rule: do not regenerate action frames from text prompts alone. The
prompt should say that action sheets are for mechanics, timing, contact points,
weight shift, limb angle, and frame-to-frame rhythm.

### Stage Backgrounds

Use this when regenerating matchup-aware arenas or the menu background.

```bash
bash tools/gen_stage_backgrounds.sh
```

Inputs:

- `tools/asset_refs/background_refs/base_bg_arena.png`
- `tools/asset_refs/background_refs/base_menu_bg.png`
- `tools/asset_refs/logo_refs/{openai,anthropic,claude,grok}.svg`

Outputs:

- `public/sprites/scene/menu_bg.png`
- `public/sprites/scene/bg_arena.png`
- `public/sprites/scene/bg_arena_altman_dario.png`
- `public/sprites/scene/bg_arena_altman_elon.png`
- `public/sprites/scene/bg_arena_dario_elon.png`
- `public/sprites/scene/bg_arena_mirror.png`

Logo rule: logo references should be generated into the painted architecture.
Do not paste SVGs or flat logo cards on top of the background.

### VFX And UI Bitmaps

Use this for isolated transparent combat effects and UI-style VFX assets.

```bash
bash tools/gen_vfx.sh
```

Outputs land in `public/sprites/vfx/`. The script uses transparent generation
when possible and records one log per effect under `/tmp`.

### Legacy Altman/Dario Action Scripts

These scripts are useful reference material and may still work, but they are
older than the current Elon action-sheet pipeline:

- `tools/gen_all_walk_strips.sh`
- `tools/gen_pose_walks.sh`
- `tools/gen_pose_jabs.sh`
- `tools/gen_pose_combo1.sh`
- `tools/gen_pose_combo2.sh`
- `tools/gen_single_frames.sh`
- `tools/regen_dario_walk.sh`
- `tools/regen_walk_down_up.sh`
- `tools/extract_all.sh`

Prefer the action-sheet approach for new high-risk animation batches. Use the
legacy scripts mainly when reproducing earlier Altman/Dario work or harvesting
prompt/pose ideas.

## Post-Processing Tools

| Tool | Use |
|---|---|
| `tools/extract_strip.py` | Equal-width strip slicing with magenta chroma extraction. |
| `tools/slice_walk_strip.py` | More robust walk-strip slicing with yellow-line detection, alpha projection fallback, cleanup, and baseline normalization. |
| `tools/normalize_sprite.py` | General character bbox height normalization and foot baseline alignment. |
| `tools/normalize_elon_scale.py` | Elon-specific scale/baseline repair for crouch, knockdown, and ultimate frames. |
| `tools/normalize_by_pose.py` | MediaPipe pose-length normalization when alpha bbox is misleading. |
| `tools/extract_pose.py` | Generate pose keypoint JSON for a sprite directory. |
| `tools/analyze_pose.py` | Turn pose JSON into markdown reports for cross-frame QA. |

## Visual QA

Do not trust raw generation metrics by themselves. Before integration, check:

- background is transparent or cleanly extracted
- no magenta fringe after resize
- character identity and outfit are stable
- full body is visible unless the pose intentionally lies down
- foot baseline is stable for standing, walking, and attacking frames
- crouch and knockdown do not get normalized into giant floating bodies
- frame sequence reads as motion when viewed as a small action-specific sheet
- attack hands, hit effects, and projectiles line up in the game runtime

For action animation, make one sheet per action. Avoid one giant spritesheet for
all moves; it hides local timing and size problems.

Example local sheet check:

```bash
python - <<'PY'
from pathlib import Path
from PIL import Image

files = [Path(f'public/sprites/elon/elon_walk_{i:02d}.png') for i in range(1, 5)]
frames = [Image.open(p).convert('RGBA') for p in files]
sheet = Image.new('RGBA', (1024 * len(frames), 1024), (0, 0, 0, 0))
for i, frame in enumerate(frames):
    sheet.alpha_composite(frame, (i * 1024, 0))
sheet.save('/tmp/elon_walk_sheet.png')
PY
```

Then inspect `/tmp/elon_walk_sheet.png` visually before committing.

## Integration Checklist

After assets are generated and normalized:

1. Put final PNGs under `public/sprites/...`.
2. Register new frame keys in `src/assets/spriteFrames.ts` or
   `src/assets/vfxFrames.ts`.
3. Wire behavior in `src/config/moveSets.ts`, scene code, or VFX systems.
4. Run `npm run build`.
5. Play through the affected scene or action.
6. Capture fresh README screenshots if public visuals changed:

```bash
npm run screenshots:readme
```

## Known Gaps

- Several scripts still hard-code `/Users/wangnov/AI-fight` and local Skill
  paths. Treat them as this-workstation automation, not portable CI scripts.
- Generation logs are mostly in `/tmp`; important final prompts should be copied
  into scripts or this document before the run is considered reproducible.
- The project does not yet have a single `npm run assets:*` command layer.
  `tools/assets_manifest.json` is the current source of truth for entrypoints.
