import { Container, Graphics, Sprite, Text } from 'pixi.js';
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
import type { SpriteSet } from '../assets/SpriteSet';
import type { FrameKey } from '../assets/spriteFrames';
import { WALK_CYCLE_KEYS } from '../assets/spriteFrames';

const SPRITE_DISPLAY_HEIGHT = 380; // 角色 sprite 显示高度（视觉略大于 FIGHTER_HEIGHT 的 hurtbox）

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
  private sprite!: Sprite;
  private spriteSet: SpriteSet | null = null;
  private spriteBaseScale = 1; // setSpriteSet 时根据 sprite 高度算出，是 idle/walk 节奏的基准
  private elapsedFrames = 0;

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
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5, 1); // 锚点底部中心，对齐角色脚底
    this.sprite.visible = false;
    this.addChild(this.body);
    this.addChild(this.faceMarker);
    this.addChild(this.sprite);

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
    label.y = -SPRITE_DISPLAY_HEIGHT - 8;
    this.addChild(label);

    this.redraw();
  }

  /** 接入 sprite，隐藏占位矩形与朝向三角，启用基于状态的动画 */
  setSpriteSet(spriteSet: SpriteSet): void {
    this.spriteSet = spriteSet;
    this.body.visible = false;
    this.faceMarker.visible = false;
    this.sprite.visible = true;

    // 按显示高度计算缩放（sprite 1024 像素中角色实际占约 800 像素，预留外边距）
    const tex = spriteSet.get('idle_01');
    const scale = SPRITE_DISPLAY_HEIGHT / tex.height * 1.2; // 1.2 系数补回 sprite 周围空白
    this.spriteBaseScale = scale;
    this.sprite.scale.set(scale);
    this.sprite.texture = tex;
    this.applySpriteFacing();
  }

  private redraw(): void {
    if (this.spriteSet) {
      this.updateSpriteFrame();
      return;
    }

    // === Fallback：未加载 sprite 时用占位矩形（开发期间或资产加载失败的兜底）===
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

    this.faceMarker.clear();
    const fx = (w / 2) * this.facing;
    this.faceMarker
      .moveTo(fx, -h * 0.6)
      .lineTo(fx + 18 * this.facing, -h * 0.5)
      .lineTo(fx, -h * 0.4)
      .closePath()
      .fill(0xffffff);
  }

  /** Sprite 模式：根据 state + elapsedFrames 选帧并应用镜像 */
  private updateSpriteFrame(): void {
    if (!this.spriteSet) return;
    const key = this.pickFrameKey();
    this.sprite.texture = this.spriteSet.get(key);
    this.applySpriteFacing();
    // tint 决策：受击优先（偏粉红），否则防御态偏蓝，再否则原色
    if (this.flashFrames > 0) {
      this.sprite.tint = 0xffaaaa;
    } else if (this.state === 'block') {
      this.sprite.tint = 0x88aaff;
    } else {
      this.sprite.tint = 0xffffff;
    }

    this.applySpriteRhythm();
  }

  /**
   * 给单帧 pose 加上"运动节奏"，避免静态 sprite 看起来僵死。
   *
   * 锚点是 (0.5, 1)（脚底），所以 scale.y 变化会让人体上半像呼吸一样
   * "压扁/拉长"，同时保持脚位置不变（不再像之前 sprite.y 浮动那样
   * 整体离地"超人飞行"）。scale.x 不动以避开 facing flip 的 sign 冲突。
   *
   * - idle：周期 90 帧（1.5s）的 scale.y squash/stretch 微动，脚不动
   * - walk：每 16 帧一段（约一只脚抬→落的半 cycle），段内做 sin 弧形
   *   vertical bounce（脚抬起最高 -2px），同时 walk 切帧也是每 16 帧切，
   *   两者节奏对齐，避免之前 8 帧瞬切两张姿态完全不同的 walk 帧的
   *   "传送感"
   * - 其他 state（攻击 / 受击 / 防御 / win/lose / 跳跃）维持基础 scale，
   *   不叠加节奏，避免与动作动画打架
   */
  private applySpriteRhythm(): void {
    const base = this.spriteBaseScale;
    const t = this.elapsedFrames;

    if (this.state === 'idle') {
      // 呼吸 squash/stretch：scale.y 在 [base*0.985, base*1.015] 摆动
      const breath = Math.sin((t * 2 * Math.PI) / 90);
      this.sprite.scale.y = base * (1 + breath * 0.015);
      this.sprite.y = 0;
    } else if (this.state === 'walk') {
      // 走路弧形 bounce：每 16 帧一段，sin 0→1→0 让脚跨步时浮起再落地
      const segPhase = ((t % 16) / 16) * Math.PI;
      const lift = Math.sin(segPhase) * 2; // 最高抬起 2px
      this.sprite.y = -lift;
      this.sprite.scale.y = base;
    } else {
      this.sprite.scale.y = base;
      this.sprite.y = 0;
    }
  }

  private pickFrameKey(): FrameKey {
    // 受击 / 胜负 / 简单状态帧
    if (this.state === 'hit') return 'hit';
    if (this.state === 'win') return 'win';
    if (this.state === 'lose') return 'lose';
    if (this.state === 'jump') return 'jump';
    if (this.state === 'crouch') return 'crouch';
    if (this.state === 'block') return 'block';

    if (this.state === 'attack' && this.attack) {
      const a = this.attack;
      const startup = a.data.startup;
      const active = a.data.active;
      const totalNonRecovery = startup + active;
      const isAltman = this.preset.name === 'ALTMAN';

      if (a.kind === 'jab') {
        if (a.frame < startup) return 'jab_01';
        if (a.frame < totalNonRecovery) return 'jab_02';
        return 'jab_03';
      }

      if (a.kind === 'combo1') {
        // 组合技 1：投射物。startup 蓄力 → release 投出
        if (a.frame < startup) {
          return isAltman ? 'codex_cast' : 'mythos_cast';
        }
        return isAltman ? 'codex_throw' : 'mythos_release';
      }

      if (a.kind === 'combo2') {
        // 组合技 2：近战重击。startup 蓄力 → 挥出
        if (a.frame < startup) {
          return isAltman ? 'benchmark_windup' : 'constitution_cast';
        }
        return isAltman ? 'benchmark_swing' : 'constitution_swing';
      }

      if (a.kind === 'ultimate') {
        // 大招分阶段（Altman 4 阶段, Dario 3 阶段）— 按 frame 进度切贴图
        const total = startup + active + a.data.recovery;
        const phase = a.frame / Math.max(total, 1);
        if (isAltman) {
          if (phase < 0.25) return 'sit_down';
          if (phase < 0.5) return 'lean_back';
          if (phase < 0.75) return 'burst';
          return 'recover';
        }
        if (phase < 0.4) return 'judge_pose';
        if (phase < 0.7) return 'slam';
        return 'recover';
      }
    }

    if (this.state === 'walk') {
      // 8 帧 walk cycle（contact_L / down_L / passing_L / up_L /
      // contact_R / down_R / passing_R / up_R），每 6 帧切一次
      // → 整 cycle 48 帧 ≈ 0.8s @60fps，约 1.25 cycle/s（2.5 步/秒）
      const idx = Math.floor(this.elapsedFrames / 6) % 8;
      return WALK_CYCLE_KEYS[idx];
    }

    // idle 锁定 idle_01 静态贴图，呼吸由 sprite.scale.y 节奏 (applySpriteRhythm) 模拟
    return 'idle_01';
  }

  private applySpriteFacing(): void {
    // sprite 默认朝向取决于角色 preset：Altman 朝右、Dario 朝左
    const naturalRight = this.preset.facingRight;
    const wantRight = this.facing > 0;
    const flip = wantRight !== naturalRight;
    const absScale = Math.abs(this.sprite.scale.x);
    this.sprite.scale.x = flip ? -absScale : absScale;
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

    // 仅在非冻结时推进动画时钟
    this.elapsedFrames += 1;

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
