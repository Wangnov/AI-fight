import type { FrameKey } from '../assets/spriteFrames';

export type MoveSetId = 'altman' | 'dario' | 'elon';
export type UltimateSpec = MoveSetId;

interface ProjectileMove {
  startupFrame: FrameKey;
  releaseFrame: FrameKey;
  vfxKey: string;
  spawnOffsetX: number;
  spawnOffsetY: number;
}

interface HeavyMove {
  startupFrame: FrameKey;
  activeFrame: FrameKey;
}

interface UltimatePhase {
  until: number;
  frame: FrameKey;
}

export interface FighterMoveSet {
  combo1: ProjectileMove;
  combo2: HeavyMove;
  ultimate: {
    spec: UltimateSpec;
    phases: readonly UltimatePhase[];
  };
}

export const MOVE_SETS: Record<MoveSetId, FighterMoveSet> = {
  altman: {
    combo1: {
      startupFrame: 'codex_cast',
      releaseFrame: 'codex_throw',
      vfxKey: 'pr_folder',
      spawnOffsetX: 170,
      spawnOffsetY: -305,
    },
    combo2: {
      startupFrame: 'benchmark_windup',
      activeFrame: 'benchmark_swing',
    },
    ultimate: {
      spec: 'altman',
      phases: [
        { until: 0.25, frame: 'sit_down' },
        { until: 0.5, frame: 'lean_back' },
        { until: 0.75, frame: 'burst' },
        { until: 1, frame: 'recover' },
      ],
    },
  },
  dario: {
    combo1: {
      startupFrame: 'mythos_cast',
      releaseFrame: 'mythos_release',
      vfxKey: 'vulnerability_shard',
      spawnOffsetX: 158,
      spawnOffsetY: -285,
    },
    combo2: {
      startupFrame: 'constitution_cast',
      activeFrame: 'constitution_swing',
    },
    ultimate: {
      spec: 'dario',
      phases: [
        { until: 0.4, frame: 'judge_pose' },
        { until: 0.7, frame: 'slam' },
        { until: 1, frame: 'recover' },
      ],
    },
  },
  elon: {
    combo1: {
      startupFrame: 'orbit_cast',
      releaseFrame: 'orbit_throw',
      vfxKey: 'satellite_packet',
      spawnOffsetX: 160,
      spawnOffsetY: -285,
    },
    combo2: {
      startupFrame: 'rocket_windup',
      activeFrame: 'rocket_swing',
    },
    ultimate: {
      spec: 'elon',
      phases: [
        { until: 0.25, frame: 'keynote_pose' },
        { until: 0.5, frame: 'countdown_pose' },
        { until: 0.75, frame: 'launch_pose' },
        { until: 1, frame: 'recover' },
      ],
    },
  },
};
