import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import type { UltimateSpec } from '../config/moveSets';

interface CinematicElement {
  obj: Container;
  birth: number;
  expire: number;
  tick?: (age: number, total: number) => void;
}

const CHARACTER_PHASE_TIME_SCALE = 0.82;
const VFX_TIME_SCALE = 1.28;

const BASE_VFX_ANCHOR_FRAMES: Record<UltimateSpec, number> = {
  altman: 90,
  dario: 150,
  elon: 120,
};

const BASE_TOTAL_FRAMES: Record<UltimateSpec, number> = {
  altman: 300,
  dario: 380,
  elon: 340,
};

function scaleCharacterFrame(frame: number): number {
  return Math.max(1, Math.round(frame * CHARACTER_PHASE_TIME_SCALE));
}

function scaleVfxFrame(spec: UltimateSpec, frame: number): number {
  const anchor = BASE_VFX_ANCHOR_FRAMES[spec];
  const scaledAnchor = scaleCharacterFrame(anchor);
  if (frame <= anchor) return scaleCharacterFrame(frame);
  return Math.round(scaledAnchor + (frame - anchor) * VFX_TIME_SCALE);
}

function scaleVfxDuration(frames: number): number {
  return Math.max(1, Math.round(frames * VFX_TIME_SCALE));
}

/**
 * 大招分镜演出（独立于 Fighter attack 计时）。
 *
 * 奥特曼"椅子瘫坐核爆"：黑屏 → 椅子降落 → "OH MAN..." 大字 →
 * 弹起冲击波 + 蘑菇云 → 整理外套台词。
 *
 * 达里奥"KYC 审判"：黑屏 + 教堂光 → "Identity Verification Required" →
 * KYC 弹窗 step1/2/3 → 红章降临 + 光柱 + mini 红章雨 →
 * "YOU WERE NOT SELECTED BY CLAUDE." → "For your safety." 收招。
 *
 * Elon Mask"Orbit Launch"：黑屏 + 轨道电光 → keynote pose →
 * countdown → rocket plume + screen lines → 收起遥控器。
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
    // VFX 分镜整体放慢一点；人物 pose 阶段独立提速，避免站桩拖沓。
    this.totalFrames = scaleVfxFrame(spec, BASE_TOTAL_FRAMES[spec]);
    this.dark = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(spec === 'altman' ? 0x000000 : spec === 'dario' ? 0x180b25 : 0x050b1a);
    this.dark.alpha = 0;
    this.addChild(this.dark);
  }

  update(): void {
    this.elapsed += 1;

    // 黑屏节奏：character 动作期间屏幕清晰，VFX 阶段才渐黑
    const charPhaseEnd = scaleCharacterFrame(BASE_VFX_ANCHOR_FRAMES[this.spec]);
    const fadeInDur = scaleVfxDuration(30);
    const fadeOutDur = scaleVfxDuration(30);
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
    else if (this.spec === 'dario') this.tickDario();
    else this.tickElon();

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
      // 人物 pose 稍快，VFX 段接管后保持 recover。
      if (this.elapsed < scaleCharacterFrame(30)) return 'sit_down';
      if (this.elapsed < scaleCharacterFrame(60)) return 'lean_back';
      if (this.elapsed < scaleCharacterFrame(90)) return 'burst';
      return 'recover'; // 90+ recover hold during VFX
    }
    if (this.spec === 'dario') {
      if (this.elapsed < scaleCharacterFrame(50)) return 'judge_pose';
      if (this.elapsed < scaleCharacterFrame(100)) return 'slam';
      return 'recover'; // 100+ hold during VFX
    }
    if (this.elapsed < scaleCharacterFrame(30)) return 'keynote_pose';
    if (this.elapsed < scaleCharacterFrame(60)) return 'countdown_pose';
    if (this.elapsed < scaleCharacterFrame(90)) return 'launch_pose';
    return 'recover';
  }

  private when(frame: number): number {
    return scaleVfxFrame(this.spec, frame);
  }

  private duration(frames: number): number {
    return scaleVfxDuration(frames);
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
    if (this.elapsed === this.when(130)) {
      fire('quote1', () =>
        this.spawnSubtitle('"我只是问了一个问题……"', STAGE_HEIGHT * 0.35, 30, 0xffffff, 70)
      );
    }
    if (this.elapsed === this.when(160)) {
      fire('chair', () => this.spawnChair());
    }
    if (this.elapsed === this.when(200)) {
      fire('headline', () =>
        this.spawnHeadline('OH MAN...\nHERE IT IS.', STAGE_HEIGHT * 0.42, 82, 0x4ade80, 90)
      );
    }
    if (this.elapsed === this.when(210)) {
      fire('subtext', () =>
        this.spawnSubtitle('"人类突然显得有点多余。"', STAGE_HEIGHT * 0.66, 24, 0xa7f3d0, 80)
      );
    }
    if (this.elapsed === this.when(250)) {
      fire('flash', () => this.spawnFullscreenFlash(0xffffff, 14));
      fire('shockwave', () => this.spawnShockwave());
      fire('mushroom', () => this.spawnMushroom());
      fire('hitText', () =>
        this.spawnHeadline('WHAT HAVE\nWE SHIPPED?!', STAGE_HEIGHT * 0.4, 64, 0xfacc15, 50)
      );
    }
    if (this.elapsed === this.when(280)) {
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
    if (this.elapsed === this.when(160)) {
      fire('cathedral', () => this.spawnCathedral());
    }
    if (this.elapsed === this.when(175)) {
      fire('headline1', () =>
        this.spawnSubtitle('"Identity Verification Required."', STAGE_HEIGHT * 0.3, 32, 0xfb923c, 70)
      );
    }
    if (this.elapsed === this.when(200)) {
      fire('kyc1', () => this.spawnKYC(1, 60));
    }
    if (this.elapsed === this.when(240)) {
      fire('kyc2', () => this.spawnKYC(2, 60));
    }
    if (this.elapsed === this.when(280)) {
      fire('kyc3', () => this.spawnKYC(3, 60));
    }
    if (this.elapsed === this.when(330)) {
      fire('flash', () => this.spawnFullscreenFlash(0xfb923c, 10));
      fire('pillar', () => this.spawnOrangePillar());
      fire('stamp', () => this.spawnAccessDeniedStamp());
      fire('miniStamps', () => this.spawnMiniStamps());
    }
    if (this.elapsed === this.when(345)) {
      fire('hitText', () =>
        this.spawnHeadline('YOU WERE NOT SELECTED\nBY CLAUDE.', STAGE_HEIGHT * 0.4, 54, 0xff6b6b, 35)
      );
    }
    if (this.elapsed === this.when(365)) {
      fire('outro', () =>
        this.spawnSubtitle('"For your safety."', STAGE_HEIGHT * 0.5, 28, 0xffffff, 15)
      );
    }
  }

  // === Elon 时间轴：5.7 秒 = 340 帧（轨道发射 + 电光冲击）===
  private elonFiredEvents = new Set<string>();
  private tickElon(): void {
    const fire = (key: string, fn: () => void): void => {
      if (!this.elonFiredEvents.has(key)) {
        this.elonFiredEvents.add(key);
        fn();
      }
    };

    if (this.elapsed === this.when(130)) {
      fire('orbit', () => this.spawnElectricOrbit());
    }
    if (this.elapsed === this.when(145)) {
      fire('quote1', () =>
        this.spawnSubtitle('"The launch window is now."', STAGE_HEIGHT * 0.34, 32, 0x93c5fd, 70)
      );
    }
    if (this.elapsed === this.when(190)) {
      fire('headline', () =>
        this.spawnHeadline('ORBITAL\nPATCH NOTES', STAGE_HEIGHT * 0.42, 70, 0x60a5fa, 85)
      );
    }
    if (this.elapsed === this.when(230)) {
      fire('lines', () => this.spawnScreenLines());
    }
    if (this.elapsed === this.when(255)) {
      fire('flash', () => this.spawnFullscreenFlash(0x93c5fd, 12));
      fire('rocket', () => this.spawnRocketPlume());
      fire('hitText', () =>
        this.spawnHeadline('REUSED\nTO ORBIT', STAGE_HEIGHT * 0.43, 70, 0xfacc15, 55)
      );
    }
    if (this.elapsed === this.when(305)) {
      fire('outro', () =>
        this.spawnSubtitle('"Anyway, it was a successful test."', STAGE_HEIGHT * 0.5, 28, 0xffffff, 28)
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
    const enterFrames = this.duration(8);
    const exitFrames = this.duration(10);
    this.elements.push({
      obj: t,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(duration),
      tick: (age, total) => {
        // 前 8 帧入场，最后 10 帧渐出
        if (age < enterFrames) t.alpha = age / enterFrames;
        else if (age > total - exitFrames) t.alpha = (total - age) / exitFrames;
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
    const popFrames = this.duration(12);
    const exitFrames = this.duration(12);
    this.elements.push({
      obj: t,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(duration),
      tick: (age, total) => {
        if (age < popFrames) {
          // 强烈出场：scale 0.4→1.2→1.0
          const p = age / popFrames;
          t.scale.set(p < 0.7 ? 0.4 + p * 1.14 : 1.2 - (p - 0.7) * 0.67);
          t.alpha = p < 0.5 ? p * 2 : 1;
        } else if (age > total - exitFrames) {
          t.alpha = (total - age) / exitFrames;
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
    const fallFrames = this.duration(25);
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
      expire: this.elapsed + this.duration(35),
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
      expire: this.elapsed + this.duration(50),
      tick: (age, total) => {
        const p = age / total;
        const grow = p < 0.4 ? p / 0.4 : 1;
        sprite.scale.set(targetScale * grow);
        sprite.alpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      },
    });
  }

  private spawnElectricOrbit(): void {
    const sprite = new Sprite(this.vfx.get('electric_orbit'));
    sprite.anchor.set(0.5);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT * 0.5;
    const targetScale = (STAGE_HEIGHT * 0.82) / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale * 0.25);
    sprite.alpha = 0;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(120),
      tick: (age, total) => {
        const p = age / total;
        sprite.scale.set(targetScale * (0.25 + Math.min(1, p * 2) * 0.75));
        sprite.rotation += 0.035;
        sprite.alpha = p < 0.15 ? p / 0.15 : p > 0.82 ? (1 - p) / 0.18 : 0.9;
      },
    });
  }

  private spawnRocketPlume(): void {
    const sprite = new Sprite(this.vfx.get('rocket_plume'));
    sprite.anchor.set(0.5, 1);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT;
    const targetScale = (STAGE_HEIGHT * 0.95) / Math.max(sprite.texture.height, 1);
    sprite.scale.set(targetScale * 0.4, 0);
    sprite.alpha = 1;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(62),
      tick: (age, total) => {
        const p = age / total;
        sprite.scale.set(targetScale * (0.4 + p * 0.8), targetScale * Math.min(1, p * 2.4));
        sprite.y = STAGE_HEIGHT - p * 55;
        sprite.alpha = p > 0.72 ? (1 - p) / 0.28 : 1;
      },
    });
  }

  private spawnScreenLines(): void {
    const sprite = new Sprite(this.vfx.get('screen_lines'));
    sprite.anchor.set(0.5);
    sprite.x = STAGE_WIDTH / 2;
    sprite.y = STAGE_HEIGHT / 2;
    sprite.width = STAGE_WIDTH;
    sprite.height = STAGE_HEIGHT;
    sprite.alpha = 0;
    this.addChild(sprite);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(65),
      tick: (age, total) => {
        const p = age / total;
        sprite.alpha = p < 0.2 ? p / 0.2 : 1 - p;
        sprite.x = STAGE_WIDTH / 2 + Math.sin(age * 0.7) * 18;
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
      expire: this.elapsed + this.duration(duration),
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
    const enterFrames = this.duration(30);
    const exitFrames = this.duration(40);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.totalFrames - 5, // 教堂光贯穿整个 Dario cinematic
      tick: (age, total) => {
        // 前 30 帧渐入，最后 40 帧渐出
        if (age < enterFrames) sprite.alpha = (age / enterFrames) * 0.85;
        else if (age > total - exitFrames) sprite.alpha = ((total - age) / exitFrames) * 0.85;
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
    const enterFrames = this.duration(6);
    const exitFrames = this.duration(6);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(duration),
      tick: (age, total) => {
        if (age < enterFrames) {
          const p = age / enterFrames;
          sprite.scale.set(targetScale * (0.6 + p * 0.4));
          sprite.alpha = p;
        } else if (age > total - exitFrames) {
          sprite.alpha = (total - age) / exitFrames;
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
    const enterFrames = this.duration(6);
    const exitFrames = this.duration(12);
    this.elements.push({
      obj: sprite,
      birth: this.elapsed,
      expire: this.elapsed + this.duration(60),
      tick: (age, total) => {
        if (age < enterFrames) {
          const p = age / enterFrames;
          sprite.scale.set(targetScale * (1.8 - p * 0.8));
          sprite.alpha = p;
        } else if (age > total - exitFrames) {
          sprite.alpha = (total - age) / exitFrames;
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
      expire: this.elapsed + this.duration(60),
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
      expire: this.elapsed + this.duration(50),
      tick: (age, total) => {
        const p = age / total;
        sprite.alpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
        sprite.y = STAGE_HEIGHT * 0.5 + p * 60;
      },
    });
  }
}
