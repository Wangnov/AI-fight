/**
 * VFX 贴图路径表 — Phase 2.B
 *
 * 投射物 / 招式 vfx / 大招组件 / 通用反馈，由 BattleScene 与 Fighter
 * 通过 SpriteSet.load(VFX_FRAMES) 一次性加载，按需 get(key) 拿 Texture。
 */

export const VFX_KEYS = [
  // 普攻命中图标
  'chatgpt_icon',
  'claude_icon',
  'hit_spark',
  'block_flash',
  // Altman 招式
  'pr_folder',
  'code_explode',
  'benchmark_chart',
  // Dario 招式
  'mythos_gate',
  'vulnerability_shard',
  'constitution_pages',
  // Elon 招式
  'satellite_packet',
  'electric_orbit',
  'rocket_plume',
  // Altman 大招
  'chair',
  'shockwave',
  'mushroom_cloud',
  // Dario 大招
  'cathedral_bg',
  'access_denied_stamp',
  'orange_pillar',
  'kyc_step1',
  'kyc_step2',
  'kyc_step3',
  'mini_stamps',
  'under_review',
  // 通用
  'ko_text',
  'screen_lines',
  'dust',
] as const;

export type VfxKey = (typeof VFX_KEYS)[number];

export const VFX_FRAMES: Record<string, string> = Object.fromEntries(
  VFX_KEYS.map((k) => [k, `/sprites/vfx/${k}.png`])
);
