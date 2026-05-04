import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';

interface CinematicElement {
  obj: Container;
  birth: number;
  expire: number;
  tick?: (age: number, total: number) => void;
}

export type UltimateSpec = 'altman' | 'dario';

/**
 * 大招分镜演出（独立于 Fighter attack 计时）。
 *
 * 奥特曼"椅子瘫坐核爆"：黑屏 → 椅子降落 → "OH MAN..." 大字 →
 * 弹起冲击波 + 蘑菇云 → 整理外套台词。180 帧 ≈ 3 秒。
 *
 * 达里奥"KYC 审判"：黑屏 + 教堂光 → "Identity Verification Required" →
 * KYC 弹窗 step1/2/3 → 红章降临 + 光柱 + mini 红章雨 →
 * "YOU WERE NOT SELECTED BY CLAUDE." → "For your safety." 收招。
 * 240 帧 ≈ 4 秒。
 *
 * BattleScene 在大招期间冻结 fighter 物理 + AI，仅推进 cinematic。
 */
export class UltimateCinematic extends Container {
  private elapsed = 0;
  private readonly dark: Graphics;
  private readonly elements: CinematicElement[] = [];
  private readonly totalFrames: number;

  constructor(
    private readonly vfx: SpriteSet,
    private readonly spec: UltimateSpec
  ) {
    super();
    // 延长以达成 KOF 级史诗感：Altman 5s, Dario 6.3s
    this.totalFrames = spec === 'altman' ? 300 : 380;
    this.dark = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(spec === 'altman' ? 0x000000 : 0x180b25);
    this.dark.alpha = 0;
    this.addChild(this.dark);
  }

  update(): void {
    this.elapsed += 1;

    // 黑屏节奏：character 动作期间屏幕清晰，VFX 阶段才渐黑
    const charPhaseEnd = this.spec === 'altman' ? 90 : 150;
    const fadeInDur = 30;
    const fadeOutDur = 30;
    const fadeOutStart = this.totalFrames - fadeOutDur;
    if (this.elapsed < charPhaseEnd) {
      this.dark.alpha = 0;
    } else if (this.elapsed < charPhaseEnd + fadeInDur) {
      this.dark.alpha = ((this.elapsed - charPhaseEnd) / fadeInDur) * 0.7;
    } else if (this.elapsed < fadeOutStart) {
      this.dark.alpha = 0.7;
    } else {
      this.dark.alpha = Math.max(0, 0.7 * (1 - (this.elapsed - fadeOutStart) / fadeOutDur));
    }

    // 时间轴 spawn
    if (this.spec === 'altman') this.tickAltman();
    else this.tickDario();

    // 推进现有 elements
    for (let i = this.elements.length - 1; i >= 0; i -= 1) {
      const e = this.elements[i];
      const age = this.elapsed - e.birth;
      const total = e.expire - e.birth;
      e.tick?.(age, total);
      if (this.elapsed >= e.expire) {
        this.removeChild(e.obj);
        e.obj.destroy({ children: true });
        this.elements.splice(i, 1);
      }
    }
  }

  isDone(): boolean {
    return this.elapsed >= this.totalFrames;
  }

  /** BattleScene 用来按时间轴切换 attacker character pose */
  getElapsed(): number {
    return this.elapsed;
  }
  getTotalFrames(): number {
    return this.totalFrames;
  }
  /**
   * 当前 character pose 阶段帧 key。
   * Phase 1（前 ~40%）：character 动作完整演出
   * Phase 2（后 ~60%）：character 保持 recover pose，VFX 接管演出
   */
  getCharacterPhaseKey(): string {
    if (this.spec === 'altman') {
      // 前 120 帧 character 4 阶段 (each 30f = 0.5s)
      if (this.elapsed < 30) return 'sit_down';
      if (this.elapsed < 60) return 'lean_back';
      if (this.elapsed < 90) return 'burst';
      return 'recover'; // 90+ recover hold during VFX
    } else {
      // 前 150 帧 character 3 阶段 (each 50f ≈ 0.83s)
      if (this.elapsed < 50) return 'judge_pose';
      if (this.elapsed < 100) return 'slam';
      return 'recover'; // 100+ hold during VFX
    }
  }

  // === Altman 时间轴：5 秒 = 300 帧（史诗节奏）===
  private altmanFiredEvents = new Set<string>();
  private tickAltman(): void {
    const fire = (key: string, fn: () => void): void => {
      if (!this.altmanFiredEvents.has(key)) {
        this.altmanFiredEvents.add(key);
        fn();
      }
    };
    // Phase 2 events (character anim 在 0-120 frames 完成后开始)
    if (this.elapsed === 130) {
      fire('quote1', () =>
        this.spawnSubtitle('"我只是问了一个问题……"', STAGE_HEIGHT * 0.35, 30, 0xffffff, 70)
      );
    }
    if (this.elapsed === 160) {
      fire('chair', () => this.spawnChair());
    }
    if (this.elapsed === 200) {
      fire('headline', () =>
        this.spawnHeadline('OH MAN...\nHERE IT IS.', STAGE_HEIGHT * 0.42, 82, 0x4ade80, 90)
      );
    }
    if (this.elapsed === 210) {
      fire('subtext', () =>
        this.spawnSubtitle('"人类突然显得有点多余。"', STAGE_HEIGHT * 0.66, 24, 0xa7f3d0, 80)
      );
    }
    if (this.elapsed === 250) {
      fire('flash', () => this.spawnFullscreenFlash(0xffffff, 14));
      fire('shockwave', () => this.spawnShockwave());
      fire('mushroom', () => this.spawnMushroom());
      fire('hitText', () =>
        this.spawnHeadline('WHAT HAVE\nWE SHIPPED?!', STAGE_HEIGHT * 0.4, 64, 0xfacc15, 50)
      );
    }
    if (this.elapsed === 280) {
      fire('outro', () =>
        this.spawnSubtitle('"Anyway, we have a lot to show you."', STAGE_HEIGHT * 0.5, 28, 0xffffff, 20)
      );
    }
  }

  // === Dario 时间轴：6.3 秒 = 380 帧（KYC 弹窗一步步看清官僚流程）===
  private darioFiredEvents = new Set<string>();
  private tickDario(): void {
    const fire = (key: string, fn: () => void): void => {
      if (!this.darioFiredEvents.has(key)) {
        this.darioFiredEvents.add(key);
        fn();
      }
    };
    // Phase 2 events (character anim 0-150 frames 完成后开始)
    if (this.elapsed === 160) {
      fire('cathedral', () => this.spawnCathedral());
    }
    if (this.elapsed === 175) {
      fire('headline1', () =>
        this.spawnSubtitle('"Identity Verification Required."', STAGE_HEIGHT * 0.3, 32, 0xfb923c, 70)
      );
    }
    if (this.elapsed === 200) {
      fire('kyc1', () => this.spawnKYC(1, 60));
    }
    if (this.elapsed === 240) {
      fire('kyc2', () => this.spawnKYC(2, 60));
    }
    if (this.elapsed === 280) {
      fire('kyc3', () => this.spawnKYC(3, 60));
    }
    if (this.elapsed === 330) {
      fire('flash', () => this.spawnFullscreenFlash(0xfb923c, 10));
      fire('pillar', () => this.spawnOrangePillar());
      fire('stamp', () => this.spawnAccessDeniedStamp());
      fire('miniStamps', () => this.spawnMiniStamps());
    }
    if (this.elapsed === 345) {
      fire('hitText', () =>
        this.spawnHeadline('YOU WERE NOT SELECTED\nBY CLAUDE.', STAGE_HEIGHT * 0.4, 54, 0xff6b6b, 35)
      );
    }
    if (this.elapsed === 365) {
      fire('outro', () =>
        this.spawnSubtitle('"For your safety."', STAGE_HEIGHT * 0.5, 28, 0xffffff, 15)
      );
    }
  }

  // === Helpers：每个 vfx 元素的入场动画 ===

  private spawnSubtitle(
    text: string,
    y: number,
    fontSize: number,
    fill: number,
    duration: number
  ): void {
    const t = new Text({
      text,
      style: {
        fontFamily: 'system-ui, Arial Black',
        fontSize,
        fill,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
        align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.x = STAGE_WIDTH / 2;
    t.y = y;
    this.addChild(t);
    this.elements.push({
      obj: t,
      birth: this.elapsed,
      expire: this.elapsed + duration,
      tick: (age, total) => {
        // 前 8 帧入场，最后 10 帧渐出
        if (age < 8) t.alpha = age / 8;
        else if (age > total - 10) t.alpha = (total - age) / 10;
        else t.alpha = 1;
      },
    });
  }

  private spawnHeadline(
    text: string,
    y: number,
    fontSize: number,
    fill: number,
    duration: number
  ): void {
    const t = new Text({
      text,
      style: {
        fontFamily: 'system-ui, Arial Black, sans-serif',
        fontSize,
        fill,
        fontWeight: '900',
        stroke: { color: 0x000000, width: 8 },
        dropShadow: {
          color: 0x000000,
          blur: 6,
          distance: 6,
          angle: Math.PI / 4,
          alpha: 0.6,
        },
        letterSpacing: 2,
        align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.x = STAGE_WIDTH / 2;
    t.y = y;
    t.scale.set(0.4);
    this.addChild(t);
    this.elements.push({
      obj: t,
      birth: this.elapsed,
      expire: this.elapsed + duration,
      tick: (age, total) => {
        if (age < 12) {
          // 强烈出场：scale 0.4→1.2→1.0
          const p = age / 12;
          t.scale.set(p < 0.7 ? 0.4 + p * 1.14 : 1.2 - (p - 0.7) * 0.67);
          t.alpha = p < 0.5 ? p * 2 : 1;
        } else if (age > total - 12) {
          t.alpha = (total - age) / 12;
        } else {
          t.scale.set(1);
          t.alpha = 1;
        }
      },
    });
  }

  private spawnChair(): void {
    const sprite = new Sprite(this.vfx.get('chair'));
    sprite.anchor.set(0.5, 1);
    const targetScale = 220 / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = -200;
    this.addChild(sprite);
    const startY = -200;
    const endY = STAGE_HEIGHT * 0.78;
    const fallFrames = 25;
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.totalFrames - 5, // 椅子保留到大招收尾，史诗感
      tick: (age, _total) => {
        if (age < fallFrames) {
          const p = age / fallFrames;
          sprite.y = startY + (endY - startY) * (p * p); // 加速下落
        } else {
          sprite.y = endY;
        }
      },
    });
  }

  private spawnShockwave(): void {
    const sprite = new Sprite(this.vfx.get('shockwave'));
    sprite.anchor.set(0.5);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT * 0.6;
    sprite.alpha = 1;
    sprite.scale.set(0.05);
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + 35,
      tick: (age, total) => {
        const p = age / total;
        sprite.scale.set(0.05 + p * 2.5);
        sprite.alpha = 1 - p * 0.95;
      },
    });
  }

  private spawnMushroom(): void {
    const sprite = new Sprite(this.vfx.get('mushroom_cloud'));
    sprite.anchor.set(0.5, 1);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT;
    const targetScale = STAGE_HEIGHT * 0.9 / Math.max(sprite.texture.height, 1);
    sprite.scale.set(0);
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + 50,
      tick: (age, total) => {
        const p = age / total;
        const grow = p < 0.4 ? p / 0.4 : 1;
        sprite.scale.set(targetScale * grow);
        sprite.alpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      },
    });
  }

  private spawnFullscreenFlash(color: number, duration: number): void {
    const flash = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(color);
    flash.alpha = 0.95;
    this.addChild(flash);
    this.elements.push({
      obj: flash,
      birth: this.elapsed,
      expire: this.elapsed + duration,
      tick: (age, total) => {
        flash.alpha = 0.95 * (1 - age / total);
      },
    });
  }

  private spawnCathedral(): void {
    const sprite = new Sprite(this.vfx.get('cathedral_bg'));
    sprite.anchor.set(0.5, 0);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = 0;
    const targetScale = STAGE_HEIGHT / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale);
    sprite.alpha = 0;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.totalFrames - 5, // 教堂光贯穿整个 Dario cinematic
      tick: (age, total) => {
        // 前 30 帧渐入，最后 40 帧渐出
        if (age < 30) sprite.alpha = (age / 30) * 0.85;
        else if (age > total - 40) sprite.alpha = ((total - age) / 40) * 0.85;
        else sprite.alpha = 0.85;
      },
    });
  }

  private spawnKYC(step: 1 | 2 | 3, duration: number): void {
    const sprite = new Sprite(this.vfx.get(`kyc_step${step}`));
    sprite.anchor.set(0.5);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT / 2;
    const targetScale = (STAGE_HEIGHT * 0.7) / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale * 0.6);
    sprite.alpha = 0;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + duration,
      tick: (age, total) => {
        if (age < 6) {
          const p = age / 6;
          sprite.scale.set(targetScale * (0.6 + p * 0.4));
          sprite.alpha = p;
        } else if (age > total - 6) {
          sprite.alpha = (total - age) / 6;
        } else {
          sprite.scale.set(targetScale);
          sprite.alpha = 1;
        }
      },
    });
  }

  private spawnAccessDeniedStamp(): void {
    const sprite = new Sprite(this.vfx.get('access_denied_stamp'));
    sprite.anchor.set(0.5);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT * 0.5;
    sprite.rotation = -0.18;
    const targetScale = (STAGE_HEIGHT * 0.7) / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale * 1.8);
    sprite.alpha = 0;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + 60,
      tick: (age, total) => {
        if (age < 6) {
          const p = age / 6;
          sprite.scale.set(targetScale * (1.8 - p * 0.8));
          sprite.alpha = p;
        } else if (age > total - 12) {
          sprite.alpha = (total - age) / 12;
        } else {
          sprite.scale.set(targetScale);
          sprite.alpha = 1;
        }
      },
    });
  }

  private spawnOrangePillar(): void {
    const sprite = new Sprite(this.vfx.get('orange_pillar'));
    sprite.anchor.set(0.5, 1);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT;
    const targetScale = STAGE_HEIGHT / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale * 0.3, 0);
    sprite.alpha = 1;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + 60,
      tick: (age, total) => {
        const p = age / total;
        sprite.scale.set(targetScale * (0.3 + p * 0.7), targetScale * Math.min(1, p * 2));
        sprite.alpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      },
    });
  }

  private spawnMiniStamps(): void {
    const sprite = new Sprite(this.vfx.get('mini_stamps'));
    sprite.anchor.set(0.5);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT * 0.5;
    const targetScale = STAGE_HEIGHT / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale);
    sprite.alpha = 0;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + 50,
      tick: (age, total) => {
        const p = age / total;
        sprite.alpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
        sprite.y = STAGE_HEIGHT * 0.5 + p * 60;
      },
    });
  }
}
