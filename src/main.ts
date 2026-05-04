import { Application } from 'pixi.js';
import {
  STAGE_BG_COLOR,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from './config/constants';
import { SceneManager } from './core/SceneManager';
import { InputManager } from './input/InputManager';
import { BattleScene, type BattleMode, type BattleResult } from './scenes/BattleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { LoadingScene } from './scenes/LoadingScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import {
  getLoadedBattleAssets,
  loadBattleAssets,
  preloadMenuAssets,
} from './assets/gameAssets';

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

  void preloadMenuAssets();

  const showMenu = (): void => {
    manager.switchTo(
      new MenuScene({
        input,
        bgArena: getLoadedBattleAssets()?.bgArena ?? null,
        onStart: (mode) => showCharacterSelect(mode),
      })
    );
  };

  const showCharacterSelect = (mode: BattleMode): void => {
    // Start warming the heavy battle bundle while the player is on the select screen.
    void loadBattleAssets().catch((err: unknown) => {
      console.warn('[AI-Fight] battle asset preload failed:', err);
    });

    manager.switchTo(
      new CharacterSelectScene({
        input,
        mode,
        bgArena: getLoadedBattleAssets()?.bgArena ?? null,
        onConfirm: (m) => showBattle(m),
        onBack: () => showMenu(),
      })
    );
  };

  const showBattle = (mode: BattleMode): void => {
    manager.switchTo(new LoadingScene({
      title: 'LOADING FIGHT',
      subtitle: 'warming sprites and effects',
    }));

    void loadBattleAssets().then(
      (assets) => {
        manager.switchTo(
          new BattleScene({
            input,
            mode,
            sprites: assets,
            onEnd: (result) => showResult(result),
          })
        );
      },
      (err: unknown) => {
        console.error('[AI-Fight] battle asset load failed:', err);
        manager.switchTo(new LoadingScene({
          title: 'LOAD FAILED',
          subtitle: 'refresh to retry',
        }));
      }
    );
  };

  const showResult = (result: BattleResult): void => {
    const assets = getLoadedBattleAssets();
    manager.switchTo(
      new ResultScene({
        input,
        result,
        sprites: assets
          ? { altman: assets.altman, dario: assets.dario, bgArena: assets.bgArena }
          : undefined,
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
