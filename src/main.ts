import { Application } from 'pixi.js';
import {
  STAGE_BG_COLOR,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from './config/constants';
import { SceneManager } from './core/SceneManager';
import { InputManager } from './input/InputManager';
import { BattleScene, type BattleMode, type BattleResult } from './scenes/BattleScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';

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

  const input = new InputManager();
  input.attach();

  const manager = new SceneManager(app.stage);

  const showMenu = (): void => {
    manager.switchTo(
      new MenuScene({
        input,
        onStart: (mode) => showBattle(mode),
      })
    );
  };

  const showBattle = (mode: BattleMode): void => {
    manager.switchTo(
      new BattleScene({
        input,
        mode,
        onEnd: (result) => showResult(result),
      })
    );
  };

  const showResult = (result: BattleResult): void => {
    manager.switchTo(
      new ResultScene({
        input,
        result,
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
