import { Graphics, Text } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import type { BattleResult } from './BattleScene';

export interface ResultSceneOptions {
  input: InputManager;
  result: BattleResult;
  onContinue: () => void;
}

const WINNER_LINES: Record<'P1' | 'P2' | 'draw', { headline: string; quote: string }> = {
  P1: {
    headline: 'ALTMAN WINS',
    quote: '"Anyway, we have a lot to show you."',
  },
  P2: {
    headline: 'DARIO WINS',
    quote: '"Your defeat has been safety-audited."',
  },
  draw: {
    headline: 'DRAW',
    quote: '"This was a packaging issue, not a defeat."',
  },
};

export class ResultScene extends Scene {
  private readonly input: InputManager;
  private readonly onContinue: () => void;
  private cooldown = 30; // 防止误触把 Enter 立刻吃掉

  constructor(opts: ResultSceneOptions) {
    super();
    this.input = opts.input;
    this.onContinue = opts.onContinue;

    const bg = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(0x000000);
    bg.alpha = 0.85;
    this.addChild(bg);

    const winner = opts.result.kind === 'ko'
      ? opts.result.winnerId
      : opts.result.winnerId;
    const lines = WINNER_LINES[winner];

    const reasonText = new Text({
      text: opts.result.kind === 'ko' ? 'KO' : 'TIME OVER',
      style: {
        fontFamily: 'system-ui',
        fontSize: 28,
        fill: 0xfbbf24,
        letterSpacing: 6,
        fontWeight: 'bold',
      },
    });
    reasonText.anchor.set(0.5);
    reasonText.x = STAGE_WIDTH / 2;
    reasonText.y = 200;
    this.addChild(reasonText);

    const headline = new Text({
      text: lines.headline,
      style: {
        fontFamily: 'system-ui',
        fontSize: 78,
        fill: 0xffffff,
        fontWeight: 'bold',
        letterSpacing: 4,
      },
    });
    headline.anchor.set(0.5);
    headline.x = STAGE_WIDTH / 2;
    headline.y = 320;
    this.addChild(headline);

    const quote = new Text({
      text: lines.quote,
      style: {
        fontFamily: 'system-ui',
        fontSize: 24,
        fill: 0x9ca3af,
        fontStyle: 'italic',
      },
    });
    quote.anchor.set(0.5);
    quote.x = STAGE_WIDTH / 2;
    quote.y = 410;
    this.addChild(quote);

    const hint = new Text({
      text: 'Enter / Space 返回菜单',
      style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x6b7280 },
    });
    hint.anchor.set(0.5);
    hint.x = STAGE_WIDTH / 2;
    hint.y = STAGE_HEIGHT - 80;
    this.addChild(hint);
  }

  update(_deltaMS: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= 1;
      return;
    }
    if (
      this.input.wasPressed('Enter') ||
      this.input.wasPressed('Space') ||
      this.input.wasPressed('Escape')
    ) {
      this.onContinue();
    }
  }
}
