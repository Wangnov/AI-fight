/**
 * 全局配置 — 伤害、帧数据、物理、键位、颜色
 * Phase 1 灰盒可打的所有可调参数集中在此
 */

import type { MoveSetId } from './moveSets';

// === 画布与世界 ===
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export const GROUND_Y = 520;
export const STAGE_BG_COLOR = 0x101218;

// === 物理（单位：像素 / 帧，60fps 逻辑帧）===
export const GRAVITY = 0.6;
export const JUMP_VELOCITY = -14;
export const MOVE_SPEED = 4;
export const KNOCKBACK_LIGHT = 30;
export const KNOCKBACK_HEAVY = 60;
export const KNOCKBACK_ULTIMATE = 120;

// === 角色尺寸 ===
export const FIGHTER_WIDTH = 100;
export const FIGHTER_HEIGHT = 220;
export const FIGHTER_CROUCH_HEIGHT = 140;
export const FIGHTER_HURTBOX_WIDTH = 170;
export const FIGHTER_HURTBOX_HEIGHT = 340;
export const FIGHTER_CROUCH_HURTBOX_HEIGHT = 220;
export const FIGHTER_COLLISION_WIDTH = 190;

// === 战斗参数 ===
export const MAX_HP = 1000;
export const MAX_ENERGY = 100;
export const ROUND_TIME_SECONDS = 60;

// 能量增长
export const ENERGY_ON_HIT = 8;
export const ENERGY_ON_COMBO_HIT = 15;
export const ENERGY_ON_TAKEN = 5;
export const ENERGY_ON_BLOCK = 3;

// 格挡减伤系数
export const BLOCK_DAMAGE_REDUCTION = 0.3; // 受到 30% 伤害

// 命中冻结（HitStop）— 60fps 下 4 帧 ≈ 67ms
export const HITSTOP_FRAMES_LIGHT = 4;
export const HITSTOP_FRAMES_HEAVY = 6;
export const HITSTOP_FRAMES_ULTIMATE = 12;

// 闪白
export const FLASH_FRAMES = 3;

// 屏幕震动
export const SHAKE_AMPLITUDE_LIGHT = 3;
export const SHAKE_AMPLITUDE_HEAVY = 5;
export const SHAKE_AMPLITUDE_ULTIMATE = 12;
export const SHAKE_DURATION_FRAMES = 8;

// 大招命中后对手硬直
export const ULTIMATE_STUN_FRAMES = 60;

// === 攻击数据 ===
// startup: 攻击起始至生效的帧数（蓄力）
// active:  hitbox 存在的帧数（命中窗口）
// recovery: 收招帧数（不可被打断也不能行动）
export interface AttackData {
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  hitboxOffsetX: number; // 相对角色中心的 hitbox 横向偏移
  hitboxOffsetY: number; // 相对脚底锚点的 hitbox 纵向偏移（负数向上）
  hitboxWidth: number;
  hitboxHeight: number;
  knockback: number;
  hitstopFrames: number;
  energyGain: number; // 命中时自身能量增长
}

// 帧数放慢到能看清动作（@60fps）
export const ATTACK_JAB: AttackData = {
  damage: 50,
  startup: 5,    // 83ms 起手蓄力
  active: 6,     // 100ms 出拳判定
  recovery: 14,  // 233ms 收招
  // 总 25 帧 = 417ms，街机感
  hitboxOffsetX: 118,
  hitboxOffsetY: -315,
  hitboxWidth: 96,
  hitboxHeight: 70,
  knockback: KNOCKBACK_LIGHT,
  hitstopFrames: HITSTOP_FRAMES_LIGHT,
  energyGain: ENERGY_ON_HIT,
};

export const ATTACK_COMBO_2: AttackData = {
  damage: 100,
  startup: 12,   // 200ms 蓄力（明显的 telegraph）
  active: 8,     // 133ms 挥击
  recovery: 28,  // 467ms 大招式后摇
  // 总 48 帧 = 800ms
  hitboxOffsetX: 112,
  hitboxOffsetY: -105,
  hitboxWidth: 180,
  hitboxHeight: 125,
  knockback: KNOCKBACK_HEAVY,
  hitstopFrames: HITSTOP_FRAMES_HEAVY,
  energyGain: ENERGY_ON_COMBO_HIT,
};

// 大招（近场判定，但额外覆盖全屏触发，由 CombatSystem 特殊处理）
export const ATTACK_ULTIMATE: AttackData = {
  damage: 300,
  startup: 20,
  active: 8,
  recovery: 30,
  hitboxOffsetX: 0,
  hitboxOffsetY: 0,
  hitboxWidth: STAGE_WIDTH,
  hitboxHeight: STAGE_HEIGHT,
  knockback: KNOCKBACK_ULTIMATE,
  hitstopFrames: HITSTOP_FRAMES_ULTIMATE,
  energyGain: 0,
};

// 投射物（组合技 1）
export interface ProjectileData {
  damage: number;
  startup: number;
  recovery: number;
  speed: number;
  width: number;
  height: number;
  knockback: number;
  hitstopFrames: number;
  energyGain: number;
  lifetimeFrames: number;
}

export const PROJECTILE_COMBO_1: ProjectileData = {
  damage: 120,
  startup: 16,   // 267ms 蓄力（看清 cast 帧）
  recovery: 34,  // 567ms 收招
  // 总 50 帧 = 833ms
  speed: 8,
  width: 80,
  height: 70,
  knockback: KNOCKBACK_HEAVY,
  hitstopFrames: HITSTOP_FRAMES_HEAVY,
  energyGain: ENERGY_ON_COMBO_HIT,
  lifetimeFrames: 90,
};

// === 颜色（灰盒占位）===
export const ALTMAN_COLOR = 0x4ade80; // ChatGPT 青绿
export const ALTMAN_PROJECTILE_COLOR = 0x22d3ee;
export const DARIO_COLOR = 0xfb923c; // Claude 橙
export const DARIO_PROJECTILE_COLOR = 0xc084fc;
export const ELON_COLOR = 0x60a5fa; // Elon Mask 电蓝
export const ELON_PROJECTILE_COLOR = 0xa78bfa;
export const HITBOX_DEBUG_COLOR = 0xff0000;
export const HP_BG_COLOR = 0x222226;
export const HP_FILL_COLOR_P1 = 0x4ade80;
export const HP_FILL_COLOR_P2 = 0xfb923c;
export const ENERGY_BG_COLOR = 0x1a1a20;
export const ENERGY_FILL_COLOR_P1 = 0x14b8a6;
export const ENERGY_FILL_COLOR_P2 = 0xea580c;

// === 键位 ===
// P1: WASD + UIO + Q（左侧手）
// P2: 方向键 + JKL + S（右侧手；S 是 P2 防御，与 P1 蹲下重合时由命名空间隔离）
export interface KeyMap {
  left: string;
  right: string;
  up: string;
  down: string;
  jab: string;
  combo1: string;
  combo2: string;
  ultimate: string;
  block: string;
}

export const KEYS_P1: KeyMap = {
  left: 'KeyA',
  right: 'KeyD',
  up: 'KeyW',
  down: 'KeyS',
  jab: 'KeyU',
  combo1: 'KeyI',
  combo2: 'KeyO',
  ultimate: 'KeyP',
  block: 'KeyQ',
};

export const KEYS_P2: KeyMap = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jab: 'KeyJ',
  combo1: 'KeyK',
  combo2: 'KeyL',
  ultimate: 'Semicolon',
  block: 'ShiftRight',
};

// === 角色预设 ===
export interface FighterPreset {
  name: string;
  moveSetId: MoveSetId;
  bodyColor: number;
  projectileColor: number;
  hpFillColor: number;
  energyFillColor: number;
  energyLabel: string;
  facingRight: boolean; // 默认朝向
}

export const PRESET_ALTMAN: FighterPreset = {
  name: 'ALTMAN',
  moveSetId: 'altman',
  bodyColor: ALTMAN_COLOR,
  projectileColor: ALTMAN_PROJECTILE_COLOR,
  hpFillColor: HP_FILL_COLOR_P1,
  energyFillColor: ENERGY_FILL_COLOR_P1,
  energyLabel: 'HYPE',
  facingRight: true,
};

export const PRESET_DARIO: FighterPreset = {
  name: 'DARIO',
  moveSetId: 'dario',
  bodyColor: DARIO_COLOR,
  projectileColor: DARIO_PROJECTILE_COLOR,
  hpFillColor: HP_FILL_COLOR_P2,
  energyFillColor: ENERGY_FILL_COLOR_P2,
  energyLabel: 'SAFETY',
  facingRight: false,
};

export const PRESET_ELON: FighterPreset = {
  name: 'ELON MASK',
  moveSetId: 'elon',
  bodyColor: ELON_COLOR,
  projectileColor: ELON_PROJECTILE_COLOR,
  hpFillColor: ELON_COLOR,
  energyFillColor: ELON_PROJECTILE_COLOR,
  energyLabel: 'ORBIT',
  facingRight: true,
};

// === 角色起始位置 ===
export const SPAWN_X_P1 = 360;
export const SPAWN_X_P2 = STAGE_WIDTH - 360;
