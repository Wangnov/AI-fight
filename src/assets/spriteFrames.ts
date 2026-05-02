/**
 * 角色帧贴图路径表 — Phase 2.B 完整版
 *
 * 通用状态帧（10 张共有）：
 *   idle_01 / idle_02 / walk_01..08 / jump / crouch / block / knockdown / hit / win / lose
 *   jab_01..03
 *
 * 角色专属招式帧（每人独有）：
 *   Altman: codex_cast / codex_throw / benchmark_windup / benchmark_swing /
 *           sit_down / lean_back / burst / recover (大招 4 阶段)
 *   Dario:  mythos_cast / mythos_release / constitution_cast / constitution_swing /
 *           judge_pose / slam / recover (大招 3 阶段，judge_pose → slam → recover)
 *
 * recover 在两人都有但语义不同（Altman: 整理外套；Dario: 合上宪法），
 * 路径区分由 character 前缀承担。
 */

// 通用状态帧（两人都有）
export const COMMON_FRAME_KEYS = [
  'idle_01',
  'idle_02',
  'walk_01',
  'walk_02',
  'walk_03',
  'walk_04',
  'walk_05',
  'walk_06',
  'walk_07',
  'walk_08',
  'jump',
  'crouch',
  'block',
  'knockdown',
  'hit',
  'win',
  'lose',
  'jab_01',
  'jab_02',
  'jab_03',
] as const;

export const ALTMAN_EXTRA_KEYS = [
  'codex_cast',
  'codex_throw',
  'benchmark_windup',
  'benchmark_swing',
  'sit_down',
  'lean_back',
  'burst',
  'recover',
] as const;

export const DARIO_EXTRA_KEYS = [
  'mythos_cast',
  'mythos_release',
  'constitution_cast',
  'constitution_swing',
  'judge_pose',
  'slam',
  'recover',
] as const;

export type CommonFrameKey = (typeof COMMON_FRAME_KEYS)[number];
export type AltmanFrameKey = CommonFrameKey | (typeof ALTMAN_EXTRA_KEYS)[number];
export type DarioFrameKey = CommonFrameKey | (typeof DARIO_EXTRA_KEYS)[number];

// Fighter 通用 FrameKey 类型 = 两人 keys 的并集（可能有 key 在某个角色不存在）
export type FrameKey = AltmanFrameKey | DarioFrameKey;

// 4 帧 walk cycle 的两个半 cycle
export const WALK_CYCLE_KEYS: ReadonlyArray<CommonFrameKey> = [
  'walk_01',
  'walk_02',
  'walk_03',
  'walk_04',
  'walk_05',
  'walk_06',
  'walk_07',
  'walk_08',
];

const buildFrames = (
  character: 'altman' | 'dario',
  keys: ReadonlyArray<string>
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const k of keys) {
    out[k] = `/sprites/${character}/${character}_${k}.png`;
  }
  return out;
};

export const ALTMAN_FRAMES: Record<AltmanFrameKey, string> = buildFrames('altman', [
  ...COMMON_FRAME_KEYS,
  ...ALTMAN_EXTRA_KEYS,
]) as Record<AltmanFrameKey, string>;

export const DARIO_FRAMES: Record<DarioFrameKey, string> = buildFrames('dario', [
  ...COMMON_FRAME_KEYS,
  ...DARIO_EXTRA_KEYS,
]) as Record<DarioFrameKey, string>;
