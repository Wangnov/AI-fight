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
import { SpriteSet } from './assets/SpriteSet';
import { ALTMAN_FRAMES, DARIO_FRAMES } from './assets/spriteFrames';

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

  // 启动期一次性异步加载两套 sprite，加载完才进入菜单
  const [altmanSprites, darioSprites] = await Promise.all([
    SpriteSet.load(ALTMAN_FRAMES),
    SpriteSet.load(DARIO_FRAMES),
  ]);

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
        sprites: { altman: altmanSprites, dario: darioSprites },
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
