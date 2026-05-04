import { Assets, type Texture } from 'pixi.js';
import { SpriteSet } from './SpriteSet';
import { ALTMAN_FRAMES, DARIO_FRAMES, ELON_FRAMES } from './spriteFrames';
import { VFX_FRAMES } from './vfxFrames';
import { ARENA_BACKGROUND_PATHS, type ArenaId } from '../config/stages';

export interface BattleAssets {
  altman: SpriteSet;
  dario: SpriteSet;
  elon: SpriteSet;
  vfx: SpriteSet;
  bgArena: Texture;
  bgArenas: Record<ArenaId, Texture>;
}

const MENU_ASSET_PATHS = [
  '/sprites/scene/menu_bg.png',
  '/sprites/scene/menu_altman.png',
  '/sprites/scene/menu_dario.png',
  '/sprites/scene/menu_elon.png',
  '/sprites/scene/menu_title.png',
  '/sprites/scene/portrait_altman.png',
  '/sprites/scene/portrait_dario.png',
  '/sprites/scene/portrait_elon.png',
  '/sprites/vfx/btn_menu.png',
  '/sprites/vfx/btn_pve.png',
  '/sprites/vfx/btn_pvp.png',
  '/sprites/vfx/text_vs.png',
] as const;

let battleAssets: BattleAssets | null = null;
let battleAssetsPromise: Promise<BattleAssets> | null = null;

export function getLoadedBattleAssets(): BattleAssets | null {
  return battleAssets;
}

export function preloadMenuAssets(): Promise<void> {
  return Assets.load([...MENU_ASSET_PATHS]).then(
    () => undefined,
    (err: unknown) => {
      console.warn('[AI-Fight] menu asset preload failed:', err);
    }
  );
}

export function loadBattleAssets(): Promise<BattleAssets> {
  if (battleAssets) return Promise.resolve(battleAssets);
  if (battleAssetsPromise) return battleAssetsPromise;

  battleAssetsPromise = Promise.all([
    SpriteSet.load(ALTMAN_FRAMES),
    SpriteSet.load(DARIO_FRAMES),
    SpriteSet.load(ELON_FRAMES),
    SpriteSet.load(VFX_FRAMES, 'hit_spark'),
    Promise.all(
      Object.entries(ARENA_BACKGROUND_PATHS).map(([id, path]) =>
        Assets.load<Texture>(path).then((texture) => [id, texture] as const)
      )
    ),
  ])
    .then(([altman, dario, elon, vfx, arenaEntries]) => {
      const bgArenas = Object.fromEntries(arenaEntries) as Record<ArenaId, Texture>;
      battleAssets = { altman, dario, elon, vfx, bgArena: bgArenas.altmanDario, bgArenas };
      return battleAssets;
    })
    .catch((err: unknown) => {
      battleAssetsPromise = null;
      throw err;
    });

  return battleAssetsPromise;
}
