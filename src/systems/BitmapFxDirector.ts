import { Container, Graphics, Rectangle, Sprite, type Renderer } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import type { MoveSetId } from '../config/moveSets';
import { getVfxStyle } from '../config/visualLanguage';

interface BitmapFxElement {
  obj: Container;
  birth: number;
  expire: number;
  tick?: (age: number, total: number) => void;
  cleanup?: () => void;
}

type DurationScaler = (frames: number) => number;

const DEFAULT_SCALE_DURATION: DurationScaler = (frames) => Math.max(1, Math.round(frames));

export class BitmapFxDirector extends Container {
  private elapsed = 0;
  private readonly elements: BitmapFxElement[] = [];

  constructor(
    private readonly vfx: SpriteSet,
    private readonly scaleDuration: DurationScaler = DEFAULT_SCALE_DURATION
  ) {
    super();
  }

  update(): void {
    this.elapsed += 1;
    for (let i = this.elements.length - 1; i >= 0; i -= 1) {
      const element = this.elements[i];
      const age = this.elapsed - element.birth;
      const total = Math.max(1, element.expire - element.birth);
      element.tick?.(age, total);
      if (this.elapsed >= element.expire) {
        this.removeChild(element.obj);
        element.cleanup?.();
        element.obj.destroy({ children: true });
        this.elements.splice(i, 1);
      }
    }
  }

  spawnAdditiveBurst(
    key: string,
    x: number,
    y: number,
    tint: number,
    baseScale: number,
    duration: number
  ): void {
    const root = new Container();
    root.x = x;
    root.y = y;

    for (let i = 0; i < 3; i += 1) {
      const sprite = new Sprite(this.vfx.get(key));
      sprite.anchor.set(0.5);
      sprite.blendMode = i === 0 ? 'screen' : 'add';
      sprite.tint = tint;
      sprite.alpha = 0.58 - i * 0.12;
      sprite.rotation = (i / 3) * Math.PI * 2;
      sprite.scale.set(baseScale * (0.36 + i * 0.18));
      root.addChild(sprite);
    }

    this.addTimed(root, duration, (age, total) => {
      const p = age / total;
      root.children.forEach((child, i) => {
        const sprite = child as Sprite;
        sprite.scale.set(baseScale * (0.44 + i * 0.22 + p * (1.15 + i * 0.28)));
        sprite.rotation += 0.025 * (i % 2 === 0 ? 1 : -1);
        sprite.alpha = Math.max(0, (0.72 - i * 0.14) * (1 - p));
      });
    });
  }

  spawnMaskedReveal(
    key: string,
    x: number,
    y: number,
    tint: number,
    duration: number,
    targetScale: number
  ): void {
    const root = new Container();
    root.x = x;
    root.y = y;

    const sprite = new Sprite(this.vfx.get(key));
    sprite.anchor.set(0.5);
    sprite.blendMode = 'screen';
    sprite.tint = tint;
    sprite.alpha = 0.92;
    sprite.scale.set(targetScale * 0.45);

    const mask = new Graphics();
    root.addChild(sprite);
    root.addChild(mask);
    root.mask = mask;

    this.addTimed(root, duration, (age, total) => {
      const p = age / total;
      const eased = 1 - Math.pow(1 - p, 3);
      mask.clear().circle(0, 0, 24 + eased * STAGE_WIDTH * 0.72).fill(0xffffff);
      sprite.scale.set(targetScale * (0.45 + eased * 0.85));
      sprite.rotation += 0.018;
      sprite.alpha = p > 0.74 ? Math.max(0, (1 - p) / 0.26) : 0.92;
    });
  }

  spawnBitmapScreenTear(duration = 48, tint = 0x60a5fa): void {
    const root = new Container();

    for (let i = 0; i < 2; i += 1) {
      const sprite = new Sprite(this.vfx.get('screen_lines'));
      sprite.anchor.set(0.5);
      sprite.x = STAGE_WIDTH / 2;
      sprite.y = STAGE_HEIGHT / 2;
      sprite.width = STAGE_WIDTH * 1.2;
      sprite.height = STAGE_HEIGHT * 1.2;
      sprite.blendMode = 'screen';
      sprite.tint = i === 0 ? tint : 0xffffff;
      sprite.alpha = 0.34 - i * 0.1;
      sprite.rotation = i === 0 ? 0.04 : -0.03;
      root.addChild(sprite);
    }

    this.addTimed(root, duration, (age, total) => {
      const p = age / total;
      root.x = Math.sin(age * 0.9) * 18 * (1 - p);
      root.alpha = 0.65 * (1 - p);
      root.scale.set(1 + p * 0.08);
    });
  }

  spawnImpactBurst(
    moveSetId: MoveSetId,
    x: number,
    y: number,
    kind: 'jab' | 'combo1' | 'combo2' | 'ultimate',
    blocked: boolean
  ): void {
    const style = getVfxStyle(moveSetId);
    const strength = kind === 'ultimate' ? 1.6 : kind === 'combo2' ? 1.05 : kind === 'combo1' ? 0.86 : 0.58;
    const key = blocked ? 'block_flash' : style.burstKey;
    this.spawnAdditiveBurst(key, x, y, blocked ? style.blocked : style.primary, 0.22 * strength, 24 + strength * 18);

    if (kind !== 'jab' || blocked) {
      this.spawnMaskedReveal(
        blocked ? 'block_flash' : style.sparkKey,
        x,
        y,
        blocked ? style.blocked : style.secondary,
        22 + strength * 20,
        0.22 * strength
      );
    }
  }

  spawnFrameEcho(
    renderer: Renderer,
    target: Container,
    width: number,
    height: number,
    tint: number,
    duration = 34
  ): void {
    const texture = renderer.generateTexture({
      target,
      frame: new Rectangle(0, 0, width, height),
      resolution: 0.5,
      clearColor: [0, 0, 0, 0],
    });
    const sprite = new Sprite(texture);
    sprite.blendMode = 'screen';
    sprite.tint = tint;
    sprite.alpha = 0.38;
    sprite.x = width / 2;
    sprite.y = height / 2;
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.height = height;

    const mask = new Graphics();
    const root = new Container();
    root.addChild(sprite);
    root.addChild(mask);
    root.mask = mask;

    this.addTimed(
      root,
      duration,
      (age, total) => {
        const p = age / total;
        const eased = 1 - Math.pow(1 - p, 3);
        mask.clear().circle(width / 2, height * 0.52, 80 + eased * width * 0.78).fill(0xffffff);
        sprite.scale.set(1 + eased * 0.08);
        sprite.alpha = 0.38 * (1 - p);
        sprite.x = width / 2 + Math.sin(age * 0.85) * 12 * (1 - p);
      },
      () => texture.destroy(true)
    );
  }

  private addTimed(
    obj: Container,
    duration: number,
    tick?: (age: number, total: number) => void,
    cleanup?: () => void
  ): void {
    this.addChild(obj);
    this.elements.push({
      obj,
      birth: this.elapsed,
      expire: this.elapsed + this.scaleDuration(duration),
      tick,
      cleanup,
    });
  }
}
