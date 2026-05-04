import { Application, Assets, type Texture } from 'pixi.js';
import {
  STAGE_BG_COLOR,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from './config/constants';
import { SceneManager } from './core/SceneManager';
import { InputManager } from './input/InputManager';
import { BattleScene, type BattleMode, type BattleResult } from './scenes/BattleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { SpriteSet } from './assets/SpriteSet';
import { ALTMAN_FRAMES, DARIO_FRAMES } from './assets/spriteFrames';
import { VFX_FRAMES } from './assets/vfxFrames';

(async () => {
  const app = new Application();
  await app.init({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    background: STAGE_BG_COLOR,
    antialias: true,
    autoStart: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const mountPoint = document.getElementById('app');
  if (!mountPoint) throw new Error('#app element missing');
  mountPoint.appendChild(app.canvas);

  // Dev: 暴露 app 给浏览器 devtools 调试（生产 vite build 中由 tree-shaking 视情况消除）
  (globalThis as unknown as { __pixiApp: unknown }).__pixiApp = app;

  // 画布自适应：窗口窄于 1280×720 时整体等比缩放，宽于则放大
  const fitToWindow = (): void => {
    const scale = Math.min(
      window.innerWidth / STAGE_WIDTH,
      window.innerHeight / STAGE_HEIGHT
    );
    mountPoint.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };
  fitToWindow();
  window.addEventListener('resize', fitToWindow);

  const input = new InputManager();
  input.attach();

  const manager = new SceneManager(app.stage);

  // 启动期一次性异步加载所有视觉资产：两套 sprite + VFX + 场景背景
  const [altmanSprites, darioSprites, vfxSprites, bgArena] = await Promise.all([
    SpriteSet.load(ALTMAN_FRAMES),
    SpriteSet.load(DARIO_FRAMES),
    SpriteSet.load(VFX_FRAMES, 'hit_spark'),
    Assets.load<Texture>('/sprites/scene/bg_arena.png'),
  ]);

  const showMenu = (): void => {
    manager.switchTo(
      new MenuScene({
        input,
        bgArena,
        onStart: (mode) => showCharacterSelect(mode),
      })
    );
  };

  const showCharacterSelect = (mode: BattleMode): void => {
    manager.switchTo(
      new CharacterSelectScene({
        input,
        mode,
        bgArena,
        onConfirm: (m) => showBattle(m),
        onBack: () => showMenu(),
      })
    );
  };

  const showBattle = (mode: BattleMode): void => {
    manager.switchTo(
      new BattleScene({
        input,
        mode,
        sprites: { altman: altmanSprites, dario: darioSprites, vfx: vfxSprites, bgArena },
        onEnd: (result) => showResult(result),
      })
    );
  };

  const showResult = (result: BattleResult): void => {
    manager.switchTo(
      new ResultScene({
        input,
        result,
        sprites: { altman: altmanSprites, dario: darioSprites, bgArena },
        onContinue: () => showMenu(),
      })
    );
  };

  showMenu();

  app.ticker.add((time) => {
    manager.update(time.deltaMS);
    input.endFrame();
  });
})().catch((err) => {
  console.error('[AI-Fight] 启动失败:', err);
});
