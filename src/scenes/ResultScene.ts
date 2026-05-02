import { Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import type { SpriteSet } from '../assets/SpriteSet';
import type { BattleResult } from './BattleScene';

export interface ResultSceneOptions {
  input: InputManager;
  result: BattleResult;
  sprites?: { altman: SpriteSet; dario: SpriteSet; bgArena: Texture };
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

const WINNER_COLORS: Record<'P1' | 'P2' | 'draw', number> = {
  P1: 0x4ade80,
  P2: 0xfb923c,
  draw: 0xa1a1aa,
};

export class ResultScene extends Scene {
  private readonly input: InputManager;
  private readonly onContinue: () => void;
  private cooldown = 30; // 防止误触把 Enter 立刻吃掉

  constructor(opts: ResultSceneOptions) {
    super();
    this.input = opts.input;
    this.onContinue = opts.onContinue;

    const winner = opts.result.winnerId;
    const lines = WINNER_LINES[winner];
    const accent = WINNER_COLORS[winner];

    // 半透明 bg_arena 背景作为底，再叠一层暗化遮罩，增强场景一致性
    if (opts.sprites?.bgArena) {
      const bg = new Sprite(opts.sprites.bgArena);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.4;
      this.addChild(bg);
    }

    const overlay = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(0x05080d);
    overlay.alpha = 0.78;
    this.addChild(overlay);

    // 获胜者大幅 win sprite 居中偏左
    if (opts.sprites && winner !== 'draw') {
      const winnerSprites = winner === 'P1' ? opts.sprites.altman : opts.sprites.dario;
      const winSprite = new Sprite(winnerSprites.get('win'));
      winSprite.anchor.set(0.5, 1);
      const targetH = STAGE_HEIGHT * 0.75;
      const scale = targetH / Math.max(winSprite.texture.height, 1);
      winSprite.scale.set(winner === 'P2' ? -scale : scale, scale);
      winSprite.x = STAGE_WIDTH * 0.27;
      winSprite.y = STAGE_HEIGHT * 0.92;
      this.addChild(winSprite);
    }

    const reasonText = new Text({
      text: opts.result.kind === 'ko' ? 'K.O.' : 'TIME OVER',
      style: {
        fontFamily: 'system-ui, Arial Black, sans-serif',
        fontSize: 36,
        fill: 0xfbbf24,
        letterSpacing: 8,
        fontWeight: '900',
        stroke: { color: 0x000000, width: 5 },
      },
    });
    reasonText.anchor.set(0.5);
    reasonText.x = STAGE_WIDTH * 0.7;
    reasonText.y = STAGE_HEIGHT * 0.27;
    this.addChild(reasonText);

    const headline = new Text({
      text: lines.headline,
      style: {
        fontFamily: 'system-ui, Arial Black, sans-serif',
        fontSize: 96,
        fill: accent,
        fontWeight: '900',
        letterSpacing: 4,
        stroke: { color: 0x000000, width: 7 },
        dropShadow: {
          color: 0x000000,
          blur: 8,
          distance: 6,
          angle: Math.PI / 4,
          alpha: 0.7,
        },
      },
    });
    headline.anchor.set(0.5);
    headline.x = STAGE_WIDTH * 0.7;
    headline.y = STAGE_HEIGHT * 0.45;
    this.addChild(headline);

    const quote = new Text({
      text: lines.quote,
      style: {
        fontFamily: 'system-ui',
        fontSize: 26,
        fill: 0xd4d4d8,
        fontStyle: 'italic',
        wordWrap: true,
        wordWrapWidth: STAGE_WIDTH * 0.5,
        align: 'center',
      },
    });
    quote.anchor.set(0.5);
    quote.x = STAGE_WIDTH * 0.7;
    quote.y = STAGE_HEIGHT * 0.6;
    this.addChild(quote);

    const hint = new Text({
      text: 'Enter / Space 返回菜单',
      style: { fontFamily: 'system-ui', fontSize: 18, fill: 0x9ca3af, letterSpacing: 1 },
    });
    hint.anchor.set(0.5);
    hint.x = STAGE_WIDTH / 2;
    hint.y = STAGE_HEIGHT - 60;
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
