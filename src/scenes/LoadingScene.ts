import { Graphics, Text } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';

export interface LoadingSceneOptions {
  title?: string;
  subtitle?: string;
}

export class LoadingScene extends Scene {
  private elapsed = 0;
  private readonly title: Text;
  private readonly subtitle: Text;

  constructor(opts: LoadingSceneOptions = {}) {
    super();

    const bg = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(0x080a10);
    this.addChild(bg);

    this.title = new Text({
      text: opts.title ?? 'LOADING',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 86,
        fill: 0xfacc15,
        fontWeight: '900',
        stroke: { color: 0x000000, width: 8 },
      },
    });
    this.title.anchor.set(0.5);
    this.title.x = STAGE_WIDTH / 2;
    this.title.y = STAGE_HEIGHT / 2 - 32;
    this.addChild(this.title);

    this.subtitle = new Text({
      text: opts.subtitle ?? 'warming sprites and effects',
      style: {
        fontFamily: 'system-ui',
        fontSize: 18,
        fill: 0x9ca3af,
        letterSpacing: 2,
      },
    });
    this.subtitle.anchor.set(0.5);
    this.subtitle.x = STAGE_WIDTH / 2;
    this.subtitle.y = STAGE_HEIGHT / 2 + 54;
    this.addChild(this.subtitle);
  }

  update(): void {
    this.elapsed += 1;
    const pulse = 1 + Math.sin(this.elapsed * 0.08) * 0.035;
    this.title.scale.set(pulse);
    const dots = '.'.repeat(Math.floor(this.elapsed / 18) % 4);
    this.subtitle.text = `${this.subtitle.text.replace(/\.*$/, '')}${dots}`;
  }
}
