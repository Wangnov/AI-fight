/**
 * 角色帧贴图路径表。
 * Phase 2.A 包含 10 张/人：idle×2 / walk×2 / jab×3 / hit / win / lose。
 * 后续 Phase 2.B 再补 jump / crouch / block / 招式特殊帧。
 */

export const FRAME_KEYS = [
  'idle_01',
  'idle_02',
  'walk_01',
  'walk_02',
  'jab_01',
  'jab_02',
  'jab_03',
  'hit',
  'win',
  'lose',
] as const;

export type FrameKey = (typeof FRAME_KEYS)[number];

const buildFrames = (character: 'altman' | 'dario'): Record<FrameKey, string> => {
  const out = {} as Record<FrameKey, string>;
  for (const k of FRAME_KEYS) {
    out[k] = `/sprites/${character}/${character}_${k}.png`;
  }
  return out;
};

export const ALTMAN_FRAMES: Record<FrameKey, string> = buildFrames('altman');
export const DARIO_FRAMES: Record<FrameKey, string> = buildFrames('dario');
