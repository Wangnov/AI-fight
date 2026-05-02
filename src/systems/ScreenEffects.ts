import { Container, Graphics } from 'pixi.js';
import type { EffectsAdapter } from './CombatSystem';

/**
 * 视觉级反馈：屏幕抖动 + 全屏闪白。
 * 抖动通过偏移 worldLayer 实现；闪白用一张全屏白色 Graphics 调 alpha。
 */
export class ScreenEffects implements EffectsAdapter {
  private shakeAmp = 0;
  private shakeDur = 0;
  private flashAlpha = 0;
  private readonly overlay: Graphics;
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(
    private readonly worldLayer: Container,
    overlayParent: Container,
    width: number,
    height: number
  ) {
    this.baseX = worldLayer.x;
    this.baseY = worldLayer.y;
    this.overlay = new Graphics();
    this.overlay.rect(0, 0, width, height).fill(0xffffff);
    this.overlay.alpha = 0;
    overlayParent.addChild(this.overlay);
  }

  shake(amplitude: number, duration: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amplitude);
    this.shakeDur = Math.max(this.shakeDur, duration);
  }

  flashScreen(): void {
    this.flashAlpha = 0.8;
  }

  update(): void {
    if (this.shakeDur > 0) {
      this.worldLayer.x = this.baseX + (Math.random() * 2 - 1) * this.shakeAmp;
      this.worldLayer.y = this.baseY + (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeDur -= 1;
      if (this.shakeDur === 0) {
        this.shakeAmp = 0;
        this.worldLayer.x = this.baseX;
        this.worldLayer.y = this.baseY;
      }
    }

    if (this.flashAlpha > 0) {
      this.overlay.alpha = this.flashAlpha;
      this.flashAlpha = Math.max(0, this.flashAlpha - 0.1);
    } else if (this.overlay.alpha !== 0) {
      this.overlay.alpha = 0;
    }
  }
}
