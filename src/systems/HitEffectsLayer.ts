import { Container, Sprite, Text } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import type { CombatEvent } from './CombatSystem';

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

/**
 * 命中时弹出火花 + 浮动字效。
 * 火花：vfx_hit_spark sprite，命中点 0.3 秒内 scale 从 0.6→1→0.4 + alpha 1→0
 * 字效：PixiJS Text，命中点向上浮 60px，0.8 秒内 alpha 1→0
 */
export class HitEffectsLayer extends Container {
  private sparks: ActiveSpark[] = [];
  private texts: ActiveText[] = [];

  constructor(private readonly vfx: SpriteSet) {
    super();
  }

  /** 监听一组 CombatEvent，按攻击类型挑字效 + 火花 */
  ingest(events: readonly CombatEvent[], hitPoints: Map<string, { x: number; y: number }>): void {
    for (const ev of events) {
      const point = hitPoints.get(ev.targetId);
      if (!point) continue;
      this.spawnSpark(point.x, point.y, ev);
      const phrase = pickPhrase(ev);
      const color = ev.attackerId === 'P1' ? 0x4ade80 : 0xfb923c;
      this.spawnText(point.x, point.y - 30, phrase, color, ev.kind === 'ultimate');
    }
  }

  private spawnSpark(x: number, y: number, ev: CombatEvent): void {
    const sprite = new Sprite(this.vfx.get('hit_spark'));
    sprite.anchor.set(0.5);
    sprite.x = x + (Math.random() - 0.5) * 30;
    sprite.y = y + (Math.random() - 0.5) * 20;
    const sizePx =
      ev.kind === 'jab'
        ? 220
        : ev.kind === 'combo1' || ev.kind === 'combo2'
          ? 320
          : 480;
    const baseScale = sizePx / Math.max(sprite.texture.width, 1);
    // 把 baseScale 存进 sprite.scale，update 用 ratio 调整
    sprite.scale.set(baseScale);
    sprite.tint = ev.blocked ? 0x60a5fa : 0xffffff; // 不染色，保留 hit_spark 原本的白心黄边
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
    color: number,
    isBig: boolean
  ): void {
    const text = new Text({
      text: content,
      style: {
        fontFamily: 'system-ui, Arial Black, sans-serif',
        fontSize: isBig ? 56 : 28,
        fill: color,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: isBig ? 6 : 4 },
        dropShadow: {
          color: 0x000000,
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

  update(): void {
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
const PHRASES: Record<
  'P1' | 'P2',
  { jab: string[]; combo1: string[]; combo2: string[]; ultimate: string[] }
> = {
  P1: {
    jab: ['Better Prompt!', 'Summarize!', 'Ship it!'],
    combo1: ['LGTM', 'Ship it', 'Fix pushed'],
    combo2: ['SOTA!', 'Cherry-picked!'],
    ultimate: ['WHAT HAVE WE SHIPPED?!'],
  },
  P2: {
    jab: ['Be Helpful.', 'Be Harmless.', 'Be Honest.'],
    combo1: ['ZERO-DAY?', 'APPLY FOR ACCESS'],
    combo2: ['Harmless!', 'Denied!'],
    ultimate: ['VERIFICATION FAILED — UNSUPPORTED REGION'],
  },
};

const BLOCK_PHRASES: Record<'P1' | 'P2', Partial<Record<CombatEvent['kind'], string>>> = {
  P1: { combo1: 'Merge conflict', combo2: 'Cherry-picked!', jab: 'Blocked!' },
  P2: { combo1: 'Not Generally Available', combo2: 'Denied', jab: 'Compliant.' },
};

function pickPhrase(ev: CombatEvent): string {
  if (ev.blocked) {
    return BLOCK_PHRASES[ev.attackerId][ev.kind] ?? 'Blocked!';
  }
  const pool = PHRASES[ev.attackerId][ev.kind];
  return pool[Math.floor(Math.random() * pool.length)];
}
