/**
 * 角色帧贴图路径表 — Phase 2.B 完整版
 *
 * 通用状态帧（10 张共有）：
 *   idle_01 / idle_02 / walk_01..04 / jump / crouch / block / knockdown / hit / win / lose
 *   jab_01..03
 *
 * walk 改为 4 帧 cycle（match KOF EX/XI 节奏，使用 Ryu pose-strip 单图共生成保证一致性）
 *
 * 角色专属招式帧（每人独有）：
 *   Altman: codex_cast / codex_throw / benchmark_windup / benchmark_swing /
 *           sit_down / lean_back / burst / recover (大招 4 阶段)
 *   Dario:  mythos_cast / mythos_release / constitution_cast / constitution_swing /
 *           judge_pose / slam / recover (大招 3 阶段，judge_pose → slam → recover)
 *   Elon:   orbit_cast / orbit_throw / rocket_windup / rocket_swing /
 *           keynote_pose / countdown_pose / launch_pose / recover (大招 4 阶段)
 *
 * recover 在多名角色都有但语义不同（Altman: 整理外套；Dario: 合上宪法；Elon: 收起遥控器），
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

export const ELON_EXTRA_KEYS = [
  'orbit_cast',
  'orbit_throw',
  'rocket_windup',
  'rocket_swing',
  'keynote_pose',
  'countdown_pose',
  'launch_pose',
  'recover',
] as const;

export type CommonFrameKey = (typeof COMMON_FRAME_KEYS)[number];
export type AltmanFrameKey = CommonFrameKey | (typeof ALTMAN_EXTRA_KEYS)[number];
export type DarioFrameKey = CommonFrameKey | (typeof DARIO_EXTRA_KEYS)[number];
export type ElonFrameKey = CommonFrameKey | (typeof ELON_EXTRA_KEYS)[number];

// Fighter 通用 FrameKey 类型 = 角色 keys 的并集（可能有 key 在某个角色不存在）
export type FrameKey = AltmanFrameKey | DarioFrameKey | ElonFrameKey;

// 4 帧 walk cycle (KOF EX 风格)
export const WALK_CYCLE_KEYS: ReadonlyArray<CommonFrameKey> = [
  'walk_01',
  'walk_02',
  'walk_03',
  'walk_04',
];

const buildFrames = (
  character: 'altman' | 'dario' | 'elon',
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

export const ELON_FRAMES: Record<ElonFrameKey, string> = buildFrames('elon', [
  ...COMMON_FRAME_KEYS,
  ...ELON_EXTRA_KEYS,
]) as Record<ElonFrameKey, string>;
