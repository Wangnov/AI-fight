import type { MoveSetId } from './moveSets';

export interface VfxStyle {
  primary: number;
  secondary: number;
  accent: number;
  dark: number;
  blocked: number;
  screen: number;
  sparkKey: string;
  burstKey: string;
}

export const VFX_STYLES: Record<MoveSetId, VfxStyle> = {
  altman: {
    primary: 0x4ade80,
    secondary: 0x22d3ee,
    accent: 0xfef08a,
    dark: 0x052e16,
    blocked: 0x93c5fd,
    screen: 0x7dd3fc,
    sparkKey: 'hit_spark',
    burstKey: 'shockwave',
  },
  dario: {
    primary: 0xfb923c,
    secondary: 0xc084fc,
    accent: 0xff6b6b,
    dark: 0x431407,
    blocked: 0xffedd5,
    screen: 0xff6b6b,
    sparkKey: 'block_flash',
    burstKey: 'mini_stamps',
  },
  elon: {
    primary: 0x60a5fa,
    secondary: 0xa78bfa,
    accent: 0xfacc15,
    dark: 0x020617,
    blocked: 0x38bdf8,
    screen: 0x93c5fd,
    sparkKey: 'electric_orbit',
    burstKey: 'electric_orbit',
  },
};

export function getVfxStyle(moveSetId: MoveSetId): VfxStyle {
  return VFX_STYLES[moveSetId];
}
