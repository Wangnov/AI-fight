import { Assets, type Texture } from 'pixi.js';

/**
 * 一个角色的全部帧贴图集合，所有 PNG 通过 PixiJS Assets 异步加载。
 *
 * 设计：内部用 Map<string, Texture>，get(key) 找不到时 fallback 到 idle_01，
 * 让 Fighter 即使引用了某角色没有的 key（如 Altman 引用 mythos_cast）也不崩溃。
 */
export class SpriteSet {
  private constructor(
    private readonly textures: Map<string, Texture>,
    private readonly fallbackKey: string
  ) {}

  static async load(map: Record<string, string>, fallbackKey = 'idle_01'): Promise<SpriteSet> {
    const entries = await Promise.all(
      Object.entries(map).map(
        async ([key, path]) => [key, await Assets.load<Texture>(path)] as const
      )
    );
    return new SpriteSet(new Map(entries), fallbackKey);
  }

  get(key: string): Texture {
    const t = this.textures.get(key);
    if (t) return t;
    const fb = this.textures.get(this.fallbackKey);
    if (fb) return fb;
    throw new Error(`SpriteSet: missing texture for "${key}" (no fallback "${this.fallbackKey}")`);
  }

  has(key: string): boolean {
    return this.textures.has(key);
  }
}
