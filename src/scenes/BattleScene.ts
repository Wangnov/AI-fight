import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import {
  FIGHTER_COLLISION_WIDTH,
  GROUND_Y,
  KEYS_P1,
  KEYS_P2,
  ROUND_TIME_SECONDS,
  SPAWN_X_P1,
  SPAWN_X_P2,
  STAGE_BG_COLOR,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from '../config/constants';
import {
  DEFAULT_BATTLE_SELECTIONS,
  getCharacterDefinition,
  type BattleSelections,
  type CharacterId,
} from '../config/characters';
import { Scene } from '../core/Scene';
import { Fighter } from '../entities/Fighter';
import { Projectile } from '../entities/Projectile';
import { InputManager } from '../input/InputManager';
import {
  HumanInputProvider,
  VirtualInputProvider,
} from '../input/InputProvider';
import { CombatSystem, type CombatEvent } from '../systems/CombatSystem';
import { ScreenEffects } from '../systems/ScreenEffects';
import { AIController } from '../systems/AIController';
import { HUD } from '../ui/HUD';
import type { SpriteSet } from '../assets/SpriteSet';
import { CombatFeedbackLayer } from '../systems/CombatFeedbackLayer';
import { sfx } from '../systems/SoundManager';
import { UltimateCinematic } from '../systems/UltimateCinematic';
import { MOVE_SETS } from '../config/moveSets';

export type BattleMode = 'pvp' | 'pve';
export type BattleResult =
  | { kind: 'ko'; winnerId: 'P1' | 'P2'; selections: BattleSelections }
  | { kind: 'time'; winnerId: 'P1' | 'P2' | 'draw'; selections: BattleSelections };

export interface BattleSceneOptions {
  input: InputManager;
  mode: BattleMode;
  sprites?: {
    altman: SpriteSet;
    dario: SpriteSet;
    elon: SpriteSet;
    vfx: SpriteSet;
    bgArena: Texture;
  };
  selections?: BattleSelections;
  onEnd: (result: BattleResult) => void;
}

type CharacterSpriteSets = Record<CharacterId, SpriteSet>;

export class BattleScene extends Scene {
  private readonly mode: BattleMode;
  private readonly input: InputManager;
  private readonly onEnd: (result: BattleResult) => void;
  private readonly selections: BattleSelections;

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
  private readonly feedback: CombatFeedbackLayer | null;
  private readonly vfxSprites: SpriteSet | null;

  private timeLeftMS = ROUND_TIME_SECONDS * 1000;
  private ended = false;
  private endDelay = 90; // KO 后的展示时长（帧）

  // 大招分镜演出（独立时间轴，期间冻结战斗）
  private cinematic: UltimateCinematic | null = null;
  private cinematicAttackerId: 'P1' | 'P2' | null = null;
  private cinematicDamageDealt = false;

  // 开场倒计时（3 → 2 → 1 → FIGHT!）冻结战斗
  private countdownFrames = 240; // 总长 4 秒 (60 fps × 4)
  private countdownText: Text | null = null;

  constructor(opts: BattleSceneOptions) {
    super();
    this.input = opts.input;
    this.mode = opts.mode;
    this.onEnd = opts.onEnd;

    // === 背景：实图 bg_arena 替换原灰色矩形（fallback 留 Graphics 兜底）===
    if (opts.sprites?.bgArena) {
      const bg = new Sprite(opts.sprites.bgArena);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      this.addChild(bg);
    } else {
      const bg = new Graphics()
        .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
        .fill(STAGE_BG_COLOR);
      this.addChild(bg);
    }

    const subtitle = new Text({
      text: 'PUBLIC BENEFIT?  PRIVATE ACCESS?',
      style: {
        fontFamily: 'system-ui',
        fontSize: 16,
        fill: 0xffffff,
        letterSpacing: 4,
        fontWeight: 'bold',
        dropShadow: { color: 0x000000, blur: 4, distance: 2, angle: Math.PI / 4 },
      },
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = STAGE_WIDTH / 2;
    subtitle.y = GROUND_Y + 30;
    subtitle.alpha = 0.6;
    this.addChild(subtitle);

    // === 世界层（受 shake 影响）===
    this.worldLayer = new Container();
    this.addChild(this.worldLayer);

    const floor = new Graphics()
      .moveTo(0, GROUND_Y)
      .lineTo(STAGE_WIDTH, GROUND_Y)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.18 });
    this.worldLayer.addChild(floor);

    this.projectilesLayer = new Container();
    this.fightersLayer = new Container();
    this.worldLayer.addChild(this.projectilesLayer);
    this.worldLayer.addChild(this.fightersLayer);

    // === 角色 ===
    this.selections = opts.selections ?? DEFAULT_BATTLE_SELECTIONS;
    const p1Character = getCharacterDefinition(this.selections.p1);
    const p2Character = getCharacterDefinition(this.selections.p2);
    this.p1 = new Fighter('P1', p1Character.preset, SPAWN_X_P1);
    this.p2 = new Fighter('P2', p2Character.preset, SPAWN_X_P2);
    this.p1.setOpponent(this.p2);
    this.p2.setOpponent(this.p1);
    if (opts.sprites) {
      const fighterSprites: CharacterSpriteSets = {
        altman: opts.sprites.altman,
        dario: opts.sprites.dario,
        elon: opts.sprites.elon,
      };
      this.p1.setSpriteSet(fighterSprites[p1Character.id]);
      this.p2.setSpriteSet(fighterSprites[p2Character.id]);
      this.p1.setVfxSet(opts.sprites.vfx);
      this.p2.setVfxSet(opts.sprites.vfx);
      this.vfxSprites = opts.sprites.vfx;
    } else {
      this.vfxSprites = null;
    }
    this.fightersLayer.addChild(this.p1);
    this.fightersLayer.addChild(this.p2);
    this.faceFightersTowardEachOther();

    // === 命中效果层（火花 + 字效，受 shake 影响）===
    if (this.vfxSprites) {
      this.feedback = new CombatFeedbackLayer(this.vfxSprites);
      this.worldLayer.addChild(this.feedback);
    } else {
      this.feedback = null;
    }

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

    this.spawnControlHints(p1Character.color, p2Character.color);

    // === 开场倒计时大字 ===
    this.countdownText = new Text({
      text: '3',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 280,
        fontWeight: 'bold',
        fill: 0xff4444,
        stroke: { color: 0xffffff, width: 12 },
        align: 'center',
        dropShadow: { color: 0x000000, blur: 8, distance: 6, alpha: 0.6 },
      },
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.x = STAGE_WIDTH / 2;
    this.countdownText.y = STAGE_HEIGHT / 2;
    this.addChild(this.countdownText);
  }

  private spawnControlHints(p1Color: number, p2Color: number): void {
    const p1Text = 'WASD 移动 · U 普攻 · I 投射 · O 重击 · P 大招 · Q 防御';
    const p2Text = this.mode === 'pvp'
      ? '方向键移动 · J 普攻 · K 投射 · L 重击 · ; 大招 · 右Shift 防御'
      : '自动应战';

    this.addChild(this.makeControlHint('P1', p1Text, p1Color, 'left'));
    this.addChild(this.makeControlHint(this.mode === 'pvp' ? 'P2' : 'AI', p2Text, p2Color, 'right'));
  }

  private makeControlHint(
    label: string,
    detail: string,
    color: number,
    side: 'left' | 'right'
  ): Container {
    const w = 556;
    const h = 48;
    const root = new Container();
    root.x = side === 'left' ? 28 : STAGE_WIDTH - w - 28;
    root.y = STAGE_HEIGHT - 38;

    const panel = new Graphics()
      .rect(0, -h / 2, w, h)
      .fill({ color: 0x020617, alpha: 0.42 })
      .rect(0, -h / 2, w, h)
      .stroke({ color, width: 2, alpha: 0.52 });
    root.addChild(panel);

    const labelText = new Text({
      text: label,
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 24,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x000000, width: 4 },
      },
    });
    labelText.anchor.set(0, 0.5);
    labelText.x = 14;
    root.addChild(labelText);

    const detailText = new Text({
      text: detail,
      style: {
        fontFamily: 'system-ui',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xe5e7eb,
        letterSpacing: 0.2,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    detailText.anchor.set(0, 0.5);
    detailText.x = 62;
    root.addChild(detailText);

    return root;
  }

  private faceFightersTowardEachOther(): void {
    this.p1.faceOpponent();
    this.p2.faceOpponent();
  }

  /** 倒计时阶段：每秒 60 帧 — 0-60: "3", 60-120: "2", 120-180: "1", 180-240: "FIGHT!" */
  private updateCountdown(): boolean {
    if (this.countdownFrames <= 0) return false;
    this.countdownFrames -= 1;
    const frame = 240 - this.countdownFrames;
    // 每段开始时触发音效
    if (frame === 1) sfx.play('beep');
    else if (frame === 60) sfx.play('beep');
    else if (frame === 120) sfx.play('beep');
    else if (frame === 180) sfx.play('fight');
    let text = '3';
    let fill = 0xff4444;
    if (frame < 60) { text = '3'; fill = 0xff4444; }
    else if (frame < 120) { text = '2'; fill = 0xffa544; }
    else if (frame < 180) { text = '1'; fill = 0xffff44; }
    else { text = 'FIGHT!'; fill = 0xff2222; }
    if (this.countdownText) {
      if (this.countdownText.text !== text) this.countdownText.text = text;
      this.countdownText.style.fill = fill;
      // 入场弹缩 + 出场缩小
      const local = frame % 60;
      const t = local / 60;
      let scale = 1.0;
      if (t < 0.3) scale = 0.5 + t * 1.67; // 0.5→1.0
      else if (t > 0.7) scale = 1.0 - (t - 0.7) * 0.8; // 1.0→0.76
      this.countdownText.scale.set(scale);
      this.countdownText.alpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
    }
    if (this.countdownFrames === 0 && this.countdownText) {
      this.removeChild(this.countdownText);
      this.countdownText.destroy();
      this.countdownText = null;
    }
    return true;
  }

  update(deltaMS: number): void {
    // === 开场倒计时：冻结战斗 + 不推进时间 ===
    if (this.updateCountdown()) {
      this.faceFightersTowardEachOther();
      this.feedback?.showActiveAttacks([]);
      this.hud.update(this.timeLeftMS / 1000);
      this.aiInput?.endFrame();
      return;
    }

    if (!this.ended) {
      this.timeLeftMS -= deltaMS;
    }

    // === 大招分镜：独立时间轴，期间不推进战斗也不接受输入 ===
    if (this.cinematic) {
      this.cinematic.update();
      // 按 cinematic 时间轴 force attacker character pose 阶段帧
      if (this.cinematicAttackerId) {
        const attacker = this.cinematicAttackerId === 'P1' ? this.p1 : this.p2;
        attacker.setForcedFrame(this.cinematic.getCharacterPhaseKey());
      }
      // 在分镜中段（约 60% 进度）应用大招伤害一次
      if (!this.cinematicDamageDealt && this.cinematic.isDone()) {
        this.applyUltimateImpact();
        this.cinematicDamageDealt = true;
      }
      if (this.cinematic.isDone()) {
        // 清除 attacker forced frame
        if (this.cinematicAttackerId) {
          const attacker = this.cinematicAttackerId === 'P1' ? this.p1 : this.p2;
          attacker.setForcedFrame(null);
        }
        this.removeChild(this.cinematic);
        this.cinematic.destroy({ children: true });
        this.cinematic = null;
        this.cinematicAttackerId = null;
        this.cinematicDamageDealt = false;
      }
      this.hud.update(this.timeLeftMS / 1000);
      this.feedback?.showActiveAttacks([]);
      this.feedback?.update();
      this.aiInput?.endFrame();
      return;
    }

    // 检测大招触发（attack.kind === 'ultimate' 且 frame=1，意味着新触发）
    this.checkUltimateTrigger();

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
    this.feedback?.showActiveAttacks([this.p1, this.p2]);

    // === 命中火花 + 字效弹出 ===
    if (this.feedback && this.combat.events.length > 0) {
      this.feedback.ingest(this.combat.events);
    }
    this.feedback?.update();

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
        sfx.play('ko');
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
        this.scheduleEnd({ kind: 'ko', winnerId, selections: this.selections });
      } else if (this.timeLeftMS <= 0) {
        this.ended = true;
        const winnerId =
          this.p1.hp > this.p2.hp ? 'P1' : this.p2.hp > this.p1.hp ? 'P2' : 'draw';
        if (winnerId !== 'draw') {
          (winnerId === 'P1' ? this.p1 : this.p2).triggerWin();
        }
        this.scheduleEnd({ kind: 'time', winnerId, selections: this.selections });
      }
    } else {
      this.endDelay -= 1;
      if (this.endDelay <= 0) {
        this.fireEnd();
      }
    }
  }

  /** 检测大招触发：在 fighter 进入 ultimate attack 的第一帧启动 cinematic */
  private checkUltimateTrigger(): void {
    if (this.cinematic) return;
    for (const f of [this.p1, this.p2]) {
      if (f.consumeUltimateTrigger()) {
        this.startCinematic(f.id);
        return;
      }
    }
  }

  private startCinematic(attackerId: 'P1' | 'P2'): void {
    sfx.play('ultimate');
    if (!this.vfxSprites) return;
    const attacker = attackerId === 'P1' ? this.p1 : this.p2;
    const spec = MOVE_SETS[attacker.preset.moveSetId].ultimate.spec;
    this.cinematic = new UltimateCinematic(this.vfxSprites, spec);
    this.cinematicAttackerId = attackerId;
    this.cinematicDamageDealt = false;
    // cinematic 加在 overlayLayer 之上，HUD 之下
    this.addChildAt(this.cinematic, this.children.indexOf(this.hud));
    // cinematic 接管，cancel attacker 的 ultimate 状态
    attacker.cancelAttack();
  }

  /** 大招完成时一次性应用伤害与击退 */
  private applyUltimateImpact(): void {
    if (!this.cinematicAttackerId) return;
    const target = this.cinematicAttackerId === 'P1' ? this.p2 : this.p1;
    if (!target.isAlive()) return;
    const attacker = this.cinematicAttackerId === 'P1' ? this.p1 : this.p2;
    const result = target.takeHit({
      damage: 300,
      knockback: 120,
      hitstopFrames: 12,
      hitstunFrames: 60,
      fromDirection: attacker.x < target.x ? 1 : -1,
      energyOnHit: 0,
      isUltimate: true,
    });
    this.screenEffects.shake(12, 18);
    this.screenEffects.flashScreen();
    if (this.feedback) {
      const hurt = target.getHurtbox();
      const events: CombatEvent[] = [
        {
          attackerId: this.cinematicAttackerId,
          targetId: target.id,
          kind: 'ultimate',
          blocked: result.blocked,
          damage: result.dealt,
          hitPoint: {
            x: hurt.x + hurt.w / 2,
            y: hurt.y + hurt.h * 0.42,
          },
        },
      ];
      this.feedback.ingest(events);
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
    const minSeparation = FIGHTER_COLLISION_WIDTH;
    const absDx = Math.abs(dx);
    if (absDx >= minSeparation) return;

    const overlap = minSeparation - absDx;
    const sign = dx >= 0 ? 1 : -1;
    const half = overlap / 2;
    const halfW = FIGHTER_COLLISION_WIDTH / 2;
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
