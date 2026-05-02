import { Container, Graphics, Text } from 'pixi.js';
import {
  ATTACK_COMBO_2,
  ATTACK_JAB,
  ATTACK_ULTIMATE,
  BLOCK_DAMAGE_REDUCTION,
  ENERGY_ON_BLOCK,
  ENERGY_ON_TAKEN,
  FIGHTER_CROUCH_HEIGHT,
  FIGHTER_HEIGHT,
  FIGHTER_WIDTH,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  MAX_ENERGY,
  MAX_HP,
  MOVE_SPEED,
  PROJECTILE_COMBO_1,
  STAGE_WIDTH,
  type AttackData,
  type FighterPreset,
} from '../config/constants';
import type { InputProvider } from '../input/InputProvider';
import { Projectile } from './Projectile';
import type { AABB, AttackKind, FighterId } from '../types';

export type FighterState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'attack'
  | 'hit'
  | 'win'
  | 'lose';

interface ActiveAttack {
  kind: AttackKind;
  data: AttackData;
  frame: number; // 已过帧数
  hitTargets: Set<FighterId>; // 已经命中过谁，避免一次攻击多次结算
  spawnedProjectile: boolean;
}

export class Fighter extends Container {
  readonly id: FighterId;
  readonly preset: FighterPreset;

  // 战斗属性
  hp = MAX_HP;
  energy = 0;

  // 物理
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;

  // 状态
  state: FighterState = 'idle';
  private attack: ActiveAttack | null = null;

  // 受击 / 命中冻结 / 大招硬直
  private hitstunFrames = 0;
  hitstopFrames = 0;
  stunFrames = 0; // 大招封锁

  // 视觉
  private body!: Graphics;
  private faceMarker!: Graphics;
  private flashFrames = 0;

  // 输出给场景
  pendingProjectiles: Projectile[] = [];
  private input: InputProvider | null = null;

  // 对手引用，用于自动朝向
  private opponent: Fighter | null = null;

  constructor(id: FighterId, preset: FighterPreset, spawnX: number) {
    super();
    this.id = id;
    this.preset = preset;
    this.facing = preset.facingRight ? 1 : -1;

    this.x = spawnX;
    this.y = GROUND_Y;

    this.buildVisual();
  }

  private buildVisual(): void {
    this.body = new Graphics();
    this.faceMarker = new Graphics();
    this.addChild(this.body);
    this.addChild(this.faceMarker);

    // 名字标签
    const label = new Text({
      text: this.preset.name,
      style: {
        fontFamily: 'system-ui, Arial',
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0.5, 1);
    label.x = 0;
    label.y = -FIGHTER_HEIGHT - 8;
    this.addChild(label);

    this.redraw();
  }

  private redraw(): void {
    const h = this.state === 'crouch' ? FIGHTER_CROUCH_HEIGHT : FIGHTER_HEIGHT;
    const w = FIGHTER_WIDTH;

    let color = this.preset.bodyColor;
    if (this.state === 'block') color = 0x60a5fa;
    else if (this.state === 'hit') color = 0xef4444;
    else if (this.state === 'attack') color = 0xfacc15;

    this.body.clear();
    this.body
      .rect(-w / 2, -h, w, h)
      .fill(color)
      .rect(-w / 2, -h, w, h)
      .stroke({ color: 0x000000, width: 3 });

    if (this.flashFrames > 0) {
      this.body
        .rect(-w / 2, -h, w, h)
        .fill({ color: 0xffffff, alpha: 0.7 });
    }

    // 朝向标记：在身体一侧画一个小三角
    this.faceMarker.clear();
    const fx = (w / 2) * this.facing;
    this.faceMarker
      .moveTo(fx, -h * 0.6)
      .lineTo(fx + 18 * this.facing, -h * 0.5)
      .lineTo(fx, -h * 0.4)
      .closePath()
      .fill(0xffffff);
  }

  setInput(input: InputProvider): void {
    this.input = input;
  }

  setOpponent(other: Fighter): void {
    this.opponent = other;
  }

  /**
   * 推进一逻辑帧。frozen=true 表示场景级冻结（HitStop）。
   */
  update(): void {
    if (this.flashFrames > 0) this.flashFrames -= 1;

    if (this.hitstopFrames > 0) {
      this.hitstopFrames -= 1;
      this.redraw();
      return;
    }

    // 自动朝向对手
    if (this.opponent && this.state !== 'hit' && this.state !== 'attack') {
      this.facing = this.opponent.x > this.x ? 1 : -1;
    }

    // 大招硬直 / 受击硬直递减
    if (this.stunFrames > 0) this.stunFrames -= 1;
    if (this.hitstunFrames > 0) this.hitstunFrames -= 1;

    if (this.state === 'win' || this.state === 'lose') {
      this.applyPhysics();
      this.redraw();
      return;
    }

    if (this.state === 'hit') {
      this.applyPhysics();
      if (this.hitstunFrames <= 0 && this.y >= GROUND_Y) {
        this.setState('idle');
        this.vx = 0;
      }
      this.redraw();
      return;
    }

    if (this.state === 'attack') {
      this.tickAttack();
      this.applyPhysics();
      this.redraw();
      return;
    }

    // 自由控制阶段（idle / walk / jump / crouch / block）
    this.handleInput();
    this.applyPhysics();
    this.redraw();
  }

  private handleInput(): void {
    const input = this.input;
    if (!input) return;
    if (this.stunFrames > 0) {
      // 被大招封锁中，仅可受击
      this.vx = 0;
      return;
    }

    const onGround = this.y >= GROUND_Y;

    // 防御（按住）
    if (onGround && input.isHeld('block')) {
      this.setState('block');
      this.vx = 0;
      return;
    }

    // 蹲下（按住 down 在地面上）
    if (onGround && input.isHeld('down')) {
      this.setState('crouch');
      this.vx = 0;
      return;
    }

    // 攻击（一次性触发，不在空中允许 — Phase 1 简化）
    if (onGround) {
      if (input.wasPressed('jab')) {
        this.startAttack('jab', ATTACK_JAB);
        return;
      }
      if (input.wasPressed('combo1')) {
        this.startAttack('combo1', { ...PROJECTILE_COMBO_1, hitboxOffsetX: 0, hitboxWidth: 0, hitboxHeight: 0 } as unknown as AttackData);
        return;
      }
      if (input.wasPressed('combo2')) {
        this.startAttack('combo2', ATTACK_COMBO_2);
        return;
      }
      if (input.wasPressed('ultimate') && this.energy >= MAX_ENERGY) {
        this.startAttack('ultimate', ATTACK_ULTIMATE);
        this.energy = 0;
        return;
      }
    }

    // 跳跃
    if (onGround && input.wasPressed('up')) {
      this.vy = JUMP_VELOCITY;
      this.setState('jump');
    }

    // 移动
    let vx = 0;
    if (input.isHeld('left')) vx -= MOVE_SPEED;
    if (input.isHeld('right')) vx += MOVE_SPEED;
    this.vx = vx;

    if (!onGround) {
      this.setState('jump');
    } else if (vx !== 0) {
      this.setState('walk');
    } else {
      this.setState('idle');
    }
  }

  private startAttack(kind: AttackKind, data: AttackData): void {
    this.attack = {
      kind,
      data,
      frame: 0,
      hitTargets: new Set(),
      spawnedProjectile: false,
    };
    this.setState('attack');
    this.vx = 0;
  }

  private tickAttack(): void {
    if (!this.attack) return;
    const a = this.attack;

    // combo1：在 startup 帧到达时生成投射物
    if (a.kind === 'combo1' && !a.spawnedProjectile && a.frame >= PROJECTILE_COMBO_1.startup) {
      const proj = new Projectile(
        this.x + 60 * this.facing,
        this.y - FIGHTER_HEIGHT * 0.6,
        this.facing,
        this.preset.projectileColor,
        PROJECTILE_COMBO_1,
        this.id
      );
      this.pendingProjectiles.push(proj);
      a.spawnedProjectile = true;
    }

    a.frame += 1;
    const total =
      a.kind === 'combo1'
        ? PROJECTILE_COMBO_1.startup + PROJECTILE_COMBO_1.recovery
        : a.data.startup + a.data.active + a.data.recovery;

    if (a.frame >= total) {
      this.attack = null;
      this.setState('idle');
    }
  }

  private applyPhysics(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += GRAVITY;

    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      if (this.vy > 0) this.vy = 0;
    }

    const halfW = FIGHTER_WIDTH / 2;
    if (this.x < halfW) this.x = halfW;
    if (this.x > STAGE_WIDTH - halfW) this.x = STAGE_WIDTH - halfW;

    // 空中减速 — 击退后慢慢停下
    if (this.state === 'hit' && this.y >= GROUND_Y) {
      this.vx *= 0.85;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }
  }

  private setState(s: FighterState): void {
    if (this.state === s) return;
    this.state = s;
  }

  // === 暴露给 CombatSystem 的接口 ===

  /** 当前是否处于攻击的 active 帧（hitbox 生效） */
  getActiveAttackHitbox(): { box: AABB; attack: ActiveAttack } | null {
    if (this.state !== 'attack' || !this.attack) return null;
    const a = this.attack;
    if (a.kind === 'combo1') return null; // 投射物攻击没有近战 hitbox
    const startup = a.data.startup;
    const active = a.data.active;
    if (a.frame < startup || a.frame >= startup + active) return null;

    // 大招特殊：全屏判定，但仅在第一帧 active 触发，避免连击
    if (a.kind === 'ultimate') {
      if (a.hitTargets.size > 0) return null;
      return {
        box: { x: 0, y: 0, w: STAGE_WIDTH, h: GROUND_Y + 20 },
        attack: a,
      };
    }

    const offsetX = a.data.hitboxOffsetX * this.facing;
    return {
      box: {
        x: this.x + offsetX - a.data.hitboxWidth / 2,
        y: this.y - FIGHTER_HEIGHT - 20 + (FIGHTER_HEIGHT - a.data.hitboxHeight) / 2,
        w: a.data.hitboxWidth,
        h: a.data.hitboxHeight,
      },
      attack: a,
    };
  }

  getHurtbox(): AABB {
    const h = this.state === 'crouch' ? FIGHTER_CROUCH_HEIGHT : FIGHTER_HEIGHT;
    return {
      x: this.x - FIGHTER_WIDTH / 2,
      y: this.y - h,
      w: FIGHTER_WIDTH,
      h,
    };
  }

  isBlocking(): boolean {
    return this.state === 'block';
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  /**
   * 受到伤害。已经处理了格挡折扣、能量、击退、硬直、HitStop。
   * 返回值：实际造成的伤害（用于 UI 反馈）
   */
  takeHit(opts: {
    damage: number;
    knockback: number;
    hitstopFrames: number;
    hitstunFrames: number;
    fromDirection: 1 | -1; // 攻击者方向
    energyOnHit: number;
    isUltimate?: boolean;
  }): { dealt: number; blocked: boolean } {
    if (!this.isAlive()) return { dealt: 0, blocked: false };

    const blocked = this.isBlocking() && !opts.isUltimate;
    const dealt = blocked ? Math.round(opts.damage * BLOCK_DAMAGE_REDUCTION) : opts.damage;

    this.hp = Math.max(0, this.hp - dealt);
    this.energy = Math.min(MAX_ENERGY, this.energy + (blocked ? ENERGY_ON_BLOCK : ENERGY_ON_TAKEN));

    if (blocked) {
      // 防御也吃一点击退，但很轻
      this.vx = opts.fromDirection * 6;
      this.hitstopFrames = Math.max(this.hitstopFrames, opts.hitstopFrames);
      this.flashFrames = 2;
    } else {
      this.vx = opts.fromDirection * (opts.knockback * 0.3);
      this.vy = -6;
      this.hitstopFrames = Math.max(this.hitstopFrames, opts.hitstopFrames);
      this.hitstunFrames = opts.hitstunFrames;
      this.flashFrames = 3;
      this.attack = null; // 中断攻击
      this.state = 'hit';

      if (opts.isUltimate) {
        this.stunFrames = 60;
      }
    }

    if (this.hp <= 0) {
      this.state = 'lose';
      this.vx = 0;
    }

    return { dealt, blocked };
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(MAX_ENERGY, this.energy + amount);
  }

  triggerWin(): void {
    this.state = 'win';
    this.vx = 0;
  }

  consumePendingProjectiles(): Projectile[] {
    const list = this.pendingProjectiles;
    this.pendingProjectiles = [];
    return list;
  }
}
