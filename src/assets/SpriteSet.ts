import { Assets, type Texture } from 'pixi.js';
import type { FrameKey } from './spriteFrames';

/**
 * 一个角色的全部帧贴图集合。所有 PNG 通过 PixiJS Assets 异步加载。
 */
export class SpriteSet {
  private constructor(private readonly textures: Map<FrameKey, Texture>) {}

  static async load(map: Record<FrameKey, string>): Promise<SpriteSet> {
    const entries = await Promise.all(
      (Object.entries(map) as Array<[FrameKey, string]>).map(
        async ([key, path]) => [key, await Assets.load<Texture>(path)] as const
      )
    );
    return new SpriteSet(new Map(entries));
  }

  get(key: FrameKey): Texture {
    const t = this.textures.get(key);
    if (!t) throw new Error(`SpriteSet: missing texture for "${key}"`);
    return t;
  }

  has(key: FrameKey): boolean {
    return this.textures.has(key);
  }
}
