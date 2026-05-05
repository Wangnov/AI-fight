import { Container, Sprite, Text } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import type { CombatEvent } from './CombatSystem';
import type { MoveSetId } from '../config/moveSets';
import { getVfxStyle } from '../config/visualLanguage';
import { BitmapFxDirector } from './BitmapFxDirector';

interface ActiveSpark {
  sprite: Sprite;
  framesLeft: number;
  totalFrames: number;
  baseScale: number;
}

interface ActiveText {
  text: Text;
  framesLeft: number;
  totalFrames: number;
  vy: number;
}

interface HitTextStyle {
  fill: number;
  stroke: number;
  shadow: number;
}

/**
 * 命中时弹出火花 + 浮动字效。
 * 火花：vfx_hit_spark sprite，命中点 0.3 秒内 scale 从 0.6→1→0.4 + alpha 1→0
 * 字效：PixiJS Text，命中点向上浮 60px，0.8 秒内 alpha 1→0
 */
export class HitEffectsLayer extends Container {
  private sparks: ActiveSpark[] = [];
  private texts: ActiveText[] = [];
  private readonly bitmapFx: BitmapFxDirector;

  constructor(private readonly vfx: SpriteSet) {
    super();
    this.bitmapFx = new BitmapFxDirector(vfx);
    this.addChild(this.bitmapFx);
  }

  /** 监听一组 CombatEvent，按攻击类型挑字效 + 火花 */
  ingest(events: readonly CombatEvent[]): void {
    for (const ev of events) {
      const point = ev.hitPoint;
      this.spawnSpark(point.x, point.y, ev);
      const feedback = pickFeedback(ev);
      this.spawnText(point.x, point.y - 36, feedback.phrase, feedback.style, ev.kind === 'ultimate');
      this.spawnDamageText(
        point.x,
        point.y + 24,
        ev.blocked ? `GUARD -${ev.damage}` : `-${ev.damage}`,
        ev.blocked ? 0x93c5fd : 0xffffff
      );
      this.bitmapFx.spawnImpactBurst(ev.attackerMoveSetId, point.x, point.y, ev.kind, ev.blocked);
    }
  }

  private spawnSpark(x: number, y: number, ev: CombatEvent): void {
    const style = getVfxStyle(ev.attackerMoveSetId);
    const sprite = new Sprite(this.vfx.get(ev.blocked ? 'block_flash' : style.sparkKey));
    sprite.anchor.set(0.5);
    sprite.x = x + (Math.random() - 0.5) * 16;
    sprite.y = y + (Math.random() - 0.5) * 12;
    const sizePx =
      ev.kind === 'jab'
        ? 150
        : ev.kind === 'combo1' || ev.kind === 'combo2'
          ? 230
          : 430;
    const baseScale = sizePx / Math.max(sprite.texture.width, 1);
    // 把 baseScale 存进 sprite.scale，update 用 ratio 调整
    sprite.scale.set(baseScale);
    sprite.blendMode = ev.blocked ? 'screen' : 'add';
    sprite.tint = ev.blocked ? style.blocked : style.primary;
    sprite.rotation = Math.random() * Math.PI * 2;
    this.addChild(sprite);
    this.sparks.push({
      sprite,
      framesLeft: 30,
      totalFrames: 30,
      baseScale,
    });
  }

  private spawnText(
    x: number,
    y: number,
    content: string,
    textStyle: HitTextStyle,
    isBig: boolean
  ): void {
    const text = new Text({
      text: content,
      style: {
        fontFamily: 'system-ui, Arial Black, sans-serif',
        fontSize: isBig ? 56 : 28,
        fill: textStyle.fill,
        fontWeight: 'bold',
        stroke: { color: textStyle.stroke, width: isBig ? 7 : 4 },
        dropShadow: {
          color: textStyle.shadow,
          blur: 6,
          distance: 4,
          angle: Math.PI / 4,
          alpha: 0.7,
        },
        letterSpacing: 1,
      },
    });
    text.anchor.set(0.5);
    text.x = x + (Math.random() - 0.5) * 30;
    text.y = y;
    this.addChild(text);
    this.texts.push({
      text,
      framesLeft: 50,
      totalFrames: 50,
      vy: -2.5, // 上浮速度
    });
  }

  private spawnDamageText(x: number, y: number, content: string, color: number): void {
    const text = new Text({
      text: content,
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 24,
        fill: color,
        fontWeight: '900',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 3,
          angle: Math.PI / 4,
          alpha: 0.75,
        },
      },
    });
    text.anchor.set(0.5);
    text.x = x + 36;
    text.y = y;
    this.addChild(text);
    this.texts.push({
      text,
      framesLeft: 34,
      totalFrames: 34,
      vy: -1.8,
    });
  }

  update(): void {
    this.bitmapFx.update();

    // 推进 sparks
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const s = this.sparks[i];
      // 第一帧记录基础 scale，避免被 mutate 后丢失
      if (s.framesLeft === s.totalFrames) {
        s.baseScale = Math.abs(s.sprite.scale.x);
      }
      s.framesLeft -= 1;
      const t = 1 - s.framesLeft / s.totalFrames; // 0→1
      // scale 先膨胀再略缩：[0,0.3] 0.6x→1.2x，[0.3,1] 1.2x→1.4x
      const scaleMult = t < 0.3 ? 0.6 + (t / 0.3) * 0.6 : 1.2 + ((t - 0.3) / 0.7) * 0.2;
      s.sprite.scale.set(s.baseScale * scaleMult);
      // alpha 前 60% 满，后 40% 线性衰减
      s.sprite.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      s.sprite.rotation += 0.06;
      if (s.framesLeft <= 0) {
        this.removeChild(s.sprite);
        s.sprite.destroy();
        this.sparks.splice(i, 1);
      }
    }

    // 推进 texts
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.framesLeft -= 1;
      t.text.y += t.vy;
      t.vy *= 0.95; // 减速上浮
      const progress = 1 - t.framesLeft / t.totalFrames;
      // 前 30% 完全不透明，后 70% 渐出
      t.text.alpha = progress < 0.3 ? 1 : 1 - (progress - 0.3) / 0.7;
      // 出场缩放：0→1.2→1
      const scaleProgress = progress < 0.15 ? progress / 0.15 : 1;
      t.text.scale.set(scaleProgress < 1 ? 0.5 + scaleProgress * 0.8 : 1);
      if (t.framesLeft <= 0) {
        this.removeChild(t.text);
        t.text.destroy();
        this.texts.splice(i, 1);
      }
    }
  }
}

// === 字效池（讽刺向，对应策划案）===
type PhraseSet = Record<CombatEvent['kind'], string[]>;

const PHRASES: Record<MoveSetId, PhraseSet> = {
  altman: {
    jab: ['Better Prompt!', 'Summarize!', 'Ship it!'],
    combo1: ['LGTM', 'Ship it', 'Fix pushed'],
    combo2: ['SOTA!', 'Cherry-picked!'],
    ultimate: ['WHAT HAVE WE SHIPPED?!'],
  },
  dario: {
    jab: ['Be Helpful.', 'Be Harmless.', 'Be Honest.'],
    combo1: ['ZERO-DAY?', 'APPLY FOR ACCESS'],
    combo2: ['Harmless!', 'Denied!'],
    ultimate: ['VERIFICATION FAILED — UNSUPPORTED REGION'],
  },
  elon: {
    jab: ['X POST!', 'BOOST!', 'BLUE CHECK!'],
    combo1: ['GROK PING!', 'ORBITAL!', 'STARLINKED!'],
    combo2: ['LAUNCH!', 'FULL SEND!', 'BOOSTER!'],
    ultimate: ['MARS MODE: ENGAGED!'],
  },
};

const BLOCK_PHRASES: Record<MoveSetId, Partial<Record<CombatEvent['kind'], string>>> = {
  altman: { combo1: 'Merge conflict', combo2: 'Cherry-picked!', jab: 'Blocked!' },
  dario: { combo1: 'Not Generally Available', combo2: 'Denied', jab: 'Compliant.' },
  elon: { combo1: 'Rate limited', combo2: 'Launch scrubbed', jab: 'Muted!' },
};

const HIT_TEXT_STYLES: Record<MoveSetId, Record<CombatEvent['kind'], HitTextStyle>> = {
  altman: {
    jab: { fill: 0x4ade80, stroke: 0x000000, shadow: 0x052e16 },
    combo1: { fill: 0x22d3ee, stroke: 0x000000, shadow: 0x083344 },
    combo2: { fill: 0x86efac, stroke: 0x000000, shadow: 0x14532d },
    ultimate: { fill: 0xfacc15, stroke: 0x000000, shadow: 0x7f1d1d },
  },
  dario: {
    jab: { fill: 0xfb923c, stroke: 0x000000, shadow: 0x431407 },
    combo1: { fill: 0xc084fc, stroke: 0x000000, shadow: 0x3b0764 },
    combo2: { fill: 0xfdba74, stroke: 0x000000, shadow: 0x7c2d12 },
    ultimate: { fill: 0xf97316, stroke: 0x000000, shadow: 0x431407 },
  },
  elon: {
    jab: { fill: 0x38bdf8, stroke: 0x020617, shadow: 0x075985 },
    combo1: { fill: 0xa78bfa, stroke: 0x020617, shadow: 0x4c1d95 },
    combo2: { fill: 0x22d3ee, stroke: 0x020617, shadow: 0x0e7490 },
    ultimate: { fill: 0xfacc15, stroke: 0x020617, shadow: 0x7c3aed },
  },
};

function pickFeedback(ev: CombatEvent): { phrase: string; style: HitTextStyle } {
  const moveSetId = ev.attackerMoveSetId;
  if (ev.blocked) {
    return {
      phrase: BLOCK_PHRASES[moveSetId][ev.kind] ?? 'Blocked!',
      style: HIT_TEXT_STYLES[moveSetId][ev.kind],
    };
  }
  const pool = PHRASES[moveSetId][ev.kind];
  return {
    phrase: pool[Math.floor(Math.random() * pool.length)],
    style: HIT_TEXT_STYLES[moveSetId][ev.kind],
  };
}
