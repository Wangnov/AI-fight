import { Container, Graphics, Text } from 'pixi.js';
import {
  FIGHTER_WIDTH,
  FLOOR_COLOR,
  GROUND_Y,
  KEYS_P1,
  KEYS_P2,
  PRESET_ALTMAN,
  PRESET_DARIO,
  ROUND_TIME_SECONDS,
  SPAWN_X_P1,
  SPAWN_X_P2,
  STAGE_BG_COLOR,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from '../config/constants';
import { Scene } from '../core/Scene';
import { Fighter } from '../entities/Fighter';
import { Projectile } from '../entities/Projectile';
import { InputManager } from '../input/InputManager';
import {
  HumanInputProvider,
  VirtualInputProvider,
} from '../input/InputProvider';
import { CombatSystem } from '../systems/CombatSystem';
import { ScreenEffects } from '../systems/ScreenEffects';
import { AIController } from '../systems/AIController';
import { HUD } from '../ui/HUD';
import type { SpriteSet } from '../assets/SpriteSet';

export type BattleMode = 'pvp' | 'pve';
export type BattleResult =
  | { kind: 'ko'; winnerId: 'P1' | 'P2' }
  | { kind: 'time'; winnerId: 'P1' | 'P2' | 'draw' };

export interface BattleSceneOptions {
  input: InputManager;
  mode: BattleMode;
  sprites?: { altman: SpriteSet; dario: SpriteSet };
  onEnd: (result: BattleResult) => void;
}

export class BattleScene extends Scene {
  private readonly mode: BattleMode;
  private readonly input: InputManager;
  private readonly onEnd: (result: BattleResult) => void;

  private readonly worldLayer: Container;
  private readonly fightersLayer: Container;
  private readonly projectilesLayer: Container;
  private readonly overlayLayer: Container;

  private readonly p1: Fighter;
  private readonly p2: Fighter;
  private readonly aiController: AIController | null = null;
  private readonly aiInput: VirtualInputProvider | null = null;
  private readonly combat: CombatSystem;
  private readonly screenEffects: ScreenEffects;
  private readonly hud: HUD;
  private readonly projectiles: Projectile[] = [];

  private timeLeftMS = ROUND_TIME_SECONDS * 1000;
  private ended = false;
  private endDelay = 90; // KO 后的展示时长（帧）

  constructor(opts: BattleSceneOptions) {
    super();
    this.input = opts.input;
    this.mode = opts.mode;
    this.onEnd = opts.onEnd;

    // === 背景 / 地面（不参与 shake）===
    const bg = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(STAGE_BG_COLOR);
    this.addChild(bg);

    const subtitle = new Text({
      text: 'PUBLIC BENEFIT?  PRIVATE ACCESS?',
      style: {
        fontFamily: 'system-ui',
        fontSize: 16,
        fill: 0x4b5563,
        letterSpacing: 4,
        fontWeight: 'bold',
      },
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = STAGE_WIDTH / 2;
    subtitle.y = GROUND_Y + 30;
    this.addChild(subtitle);

    // === 世界层（受 shake 影响）===
    this.worldLayer = new Container();
    this.addChild(this.worldLayer);

    const floor = new Graphics()
      .rect(0, GROUND_Y, STAGE_WIDTH, STAGE_HEIGHT - GROUND_Y)
      .fill(FLOOR_COLOR)
      .moveTo(0, GROUND_Y)
      .lineTo(STAGE_WIDTH, GROUND_Y)
      .stroke({ color: 0x1f2937, width: 3 });
    this.worldLayer.addChild(floor);

    this.projectilesLayer = new Container();
    this.fightersLayer = new Container();
    this.worldLayer.addChild(this.projectilesLayer);
    this.worldLayer.addChild(this.fightersLayer);

    // === 角色 ===
    this.p1 = new Fighter('P1', PRESET_ALTMAN, SPAWN_X_P1);
    this.p2 = new Fighter('P2', PRESET_DARIO, SPAWN_X_P2);
    this.p1.setOpponent(this.p2);
    this.p2.setOpponent(this.p1);
    if (opts.sprites) {
      this.p1.setSpriteSet(opts.sprites.altman);
      this.p2.setSpriteSet(opts.sprites.dario);
    }
    this.fightersLayer.addChild(this.p1);
    this.fightersLayer.addChild(this.p2);

    // === 输入绑定 ===
    this.p1.setInput(new HumanInputProvider(this.input, KEYS_P1));
    if (this.mode === 'pvp') {
      this.p2.setInput(new HumanInputProvider(this.input, KEYS_P2));
    } else {
      this.aiInput = new VirtualInputProvider();
      this.p2.setInput(this.aiInput);
      this.aiController = new AIController(this.p2, this.p1, this.aiInput);
    }

    // === 效果与战斗系统 ===
    this.overlayLayer = new Container();
    this.screenEffects = new ScreenEffects(
      this.worldLayer,
      this.overlayLayer,
      STAGE_WIDTH,
      STAGE_HEIGHT
    );
    this.combat = new CombatSystem(
      [this.p1, this.p2],
      () => this.projectiles,
      this.screenEffects
    );

    this.addChild(this.overlayLayer);

    // === HUD ===
    this.hud = new HUD(this.p1, this.p2);
    this.addChild(this.hud);

    // === 操作提示 ===
    const hint = new Text({
      text:
        this.mode === 'pvp'
          ? 'P1: WASD 移动 / U 普攻 / I K 投射 / O L 组合技 / P ; 大招 / Q 防御\nP2: 方向键移动 / J 普攻 / K 投射 / L 组合技 / ; 大招 / 右Shift 防御'
          : 'P1: WASD 移动 / U 普攻 / I 投射 / O 组合技 / P 大招 / Q 防御\nAI: 自动应战',
      style: {
        fontFamily: 'system-ui',
        fontSize: 12,
        fill: 0x6b7280,
        align: 'center',
      },
    });
    hint.anchor.set(0.5, 1);
    hint.x = STAGE_WIDTH / 2;
    hint.y = STAGE_HEIGHT - 8;
    this.addChild(hint);
  }

  update(deltaMS: number): void {
    if (!this.ended) {
      this.timeLeftMS -= deltaMS;
    }

    // === 输入决策（AI）===
    if (this.aiController && this.aiInput) {
      this.aiController.update(this.projectiles);
    }

    // === 角色推进 ===
    this.p1.update();
    this.p2.update();

    // === 解决双方在地面时的 x 重叠（防穿模）===
    this.resolveFighterOverlap();

    // === 收集新生成的投射物 ===
    for (const p of this.p1.consumePendingProjectiles()) {
      this.projectiles.push(p);
      this.projectilesLayer.addChild(p);
    }
    for (const p of this.p2.consumePendingProjectiles()) {
      this.projectiles.push(p);
      this.projectilesLayer.addChild(p);
    }

    // === 投射物推进 ===
    const anyHitstop = this.p1.hitstopFrames > 0 || this.p2.hitstopFrames > 0;
    for (const p of this.projectiles) {
      p.update(anyHitstop);
    }

    // === 命中判定 ===
    this.combat.step();

    // === 死掉的投射物清理 ===
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      if (!p.alive) {
        this.projectilesLayer.removeChild(p);
        p.destroy();
        this.projectiles.splice(i, 1);
      }
    }

    // === 视觉效果推进 ===
    this.screenEffects.update();

    // === HUD ===
    this.hud.update(this.timeLeftMS / 1000);

    // === AI 输入帧末清理 ===
    this.aiInput?.endFrame();

    // === 胜负 ===
    if (!this.ended) {
      if (!this.p1.isAlive() || !this.p2.isAlive()) {
        this.ended = true;
        const winnerId =
          !this.p1.isAlive() && !this.p2.isAlive()
            ? this.p1.hp >= this.p2.hp
              ? 'P1'
              : 'P2'
            : !this.p1.isAlive()
              ? 'P2'
              : 'P1';
        const winner = winnerId === 'P1' ? this.p1 : this.p2;
        winner.triggerWin();
        this.scheduleEnd({ kind: 'ko', winnerId });
      } else if (this.timeLeftMS <= 0) {
        this.ended = true;
        const winnerId =
          this.p1.hp > this.p2.hp ? 'P1' : this.p2.hp > this.p1.hp ? 'P2' : 'draw';
        if (winnerId !== 'draw') {
          (winnerId === 'P1' ? this.p1 : this.p2).triggerWin();
        }
        this.scheduleEnd({ kind: 'time', winnerId });
      }
    } else {
      this.endDelay -= 1;
      if (this.endDelay <= 0) {
        this.fireEnd();
      }
    }
  }

  /**
   * 防止两个角色穿模：双方都在地面时，强制保证两个中心相距至少一个角色宽度。
   * 各推一半重叠量；若一方贴墙被 clamp 卡住，剩余偏移全部转给对方，避免边角处仍然重叠。
   * 跳跃中的角色允许穿过，符合格斗游戏惯例。
   */
  private resolveFighterOverlap(): void {
    const p1OnGround = this.p1.y >= GROUND_Y;
    const p2OnGround = this.p2.y >= GROUND_Y;
    if (!p1OnGround || !p2OnGround) return;

    const dx = this.p2.x - this.p1.x;
    const minSeparation = FIGHTER_WIDTH;
    const absDx = Math.abs(dx);
    if (absDx >= minSeparation) return;

    const overlap = minSeparation - absDx;
    const sign = dx >= 0 ? 1 : -1;
    const half = overlap / 2;
    const halfW = FIGHTER_WIDTH / 2;
    const minX = halfW;
    const maxX = STAGE_WIDTH - halfW;

    const clamp = (v: number): number => Math.min(maxX, Math.max(minX, v));
    const targetP1 = clamp(this.p1.x - sign * half);
    const targetP2 = clamp(this.p2.x + sign * half);
    const p1Used = Math.abs(this.p1.x - targetP1);
    const p2Used = Math.abs(this.p2.x - targetP2);

    if (p1Used + p2Used + 0.5 >= overlap) {
      this.p1.x = targetP1;
      this.p2.x = targetP2;
      return;
    }

    // 一方被墙挡住，把剩余偏移甩给另一方
    if (p1Used < half) {
      this.p1.x = targetP1;
      this.p2.x = clamp(this.p2.x + sign * (overlap - p1Used));
    } else {
      this.p2.x = targetP2;
      this.p1.x = clamp(this.p1.x - sign * (overlap - p2Used));
    }
  }

  private pendingResult: BattleResult | null = null;
  private scheduleEnd(result: BattleResult): void {
    this.pendingResult = result;
  }

  private fireEnd(): void {
    if (this.pendingResult) {
      const r = this.pendingResult;
      this.pendingResult = null;
      this.onEnd(r);
    }
  }
}
