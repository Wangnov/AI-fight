import { Assets, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import { sfx } from '../systems/SoundManager';
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
  private cooldown = 30;
  private elapsed = 0;
  private winnerPose: Sprite | null = null;
  private headlineText: Text | null = null;
  private bgVfx: Sprite | null = null;
  private winnerColor = 0x4ade80;

  constructor(opts: ResultSceneOptions) {
    super();
    this.input = opts.input;
    this.onContinue = opts.onContinue;

    const winner = opts.result.winnerId;
    const lines = WINNER_LINES[winner];
    const accent = WINNER_COLORS[winner];
    this.winnerColor = accent;

    void this.spawnLayers(opts, winner, lines, accent);
  }

  private async spawnLayers(
    opts: ResultSceneOptions,
    winner: 'P1' | 'P2' | 'draw',
    lines: { headline: string; quote: string },
    accent: number
  ): Promise<void> {
    // === BG ===
    let bgUsed = false;
    try {
      const tex = await Assets.load<Texture>('/sprites/scene/menu_bg.png');
      const bg = new Sprite(tex);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.6;
      this.addChild(bg);
      bgUsed = true;
    } catch {
      /* */
    }
    if (!bgUsed && opts.sprites?.bgArena) {
      const bg = new Sprite(opts.sprites.bgArena);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.4;
      this.addChild(bg);
    }
    const overlay = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.55 });
    this.addChild(overlay);

    // === Winner full pose (large) ===
    if (winner !== 'draw') {
      const path = winner === 'P1' ? '/sprites/scene/menu_altman.png' : '/sprites/scene/menu_dario.png';
      try {
        const tex = await Assets.load<Texture>(path);
        this.winnerPose = new Sprite(tex);
        const targetH = STAGE_HEIGHT * 0.92;
        this.winnerPose.scale.set(targetH / tex.height);
        this.winnerPose.anchor.set(0.5, 1);
        this.winnerPose.x = STAGE_WIDTH * 0.30;
        this.winnerPose.y = STAGE_HEIGHT - 8;
        this.addChild(this.winnerPose);
      } catch {
        // fallback to win sprite from spriteset
        if (opts.sprites) {
          const winnerSprites = winner === 'P1' ? opts.sprites.altman : opts.sprites.dario;
          this.winnerPose = new Sprite(winnerSprites.get('win'));
          this.winnerPose.anchor.set(0.5, 1);
          const targetH = STAGE_HEIGHT * 0.78;
          const s = targetH / Math.max(this.winnerPose.texture.height, 1);
          this.winnerPose.scale.set(winner === 'P2' ? -s : s, s);
          this.winnerPose.x = STAGE_WIDTH * 0.30;
          this.winnerPose.y = STAGE_HEIGHT - 8;
          this.addChild(this.winnerPose);
        }
      }
    }

    // === KO sprite (top center-right) ===
    if (opts.result.kind === 'ko') {
      try {
        const tex = await Assets.load<Texture>('/sprites/vfx/ko_text.png');
        const ko = new Sprite(tex);
        ko.anchor.set(0.5);
        const targetH = 220;
        ko.scale.set(targetH / Math.max(tex.height, 1));
        ko.x = STAGE_WIDTH * 0.7;
        ko.y = STAGE_HEIGHT * 0.21;
        this.addChild(ko);
      } catch {
        const t = new Text({
          text: 'K.O.',
          style: {
            fontFamily: 'Impact, system-ui',
            fontSize: 120,
            fill: 0xff2222,
            fontWeight: '900',
            letterSpacing: 8,
            stroke: { color: 0xffffff, width: 10 },
          },
        });
        t.anchor.set(0.5);
        t.x = STAGE_WIDTH * 0.7;
        t.y = STAGE_HEIGHT * 0.21;
        this.addChild(t);
      }
    } else {
      const t = new Text({
        text: 'TIME OVER',
        style: {
          fontFamily: 'Impact, system-ui',
          fontSize: 70,
          fill: 0xfbbf24,
          letterSpacing: 8,
          fontWeight: '900',
          stroke: { color: 0x000000, width: 6 },
          dropShadow: { color: 0x000000, blur: 6, distance: 4, alpha: 0.7 },
        },
      });
      t.anchor.set(0.5);
      t.x = STAGE_WIDTH * 0.7;
      t.y = STAGE_HEIGHT * 0.21;
      this.addChild(t);
    }

    // === Background winner VFX (mushroom for Altman, stamp for Dario) ===
    if (winner !== 'draw') {
      const path = winner === 'P1'
        ? '/sprites/vfx/mushroom_cloud.png'
        : '/sprites/vfx/access_denied_stamp.png';
      try {
        const tex = await Assets.load<Texture>(path);
        this.bgVfx = new Sprite(tex);
        this.bgVfx.anchor.set(0.5);
        this.bgVfx.scale.set(0.55);
        this.bgVfx.x = STAGE_WIDTH * 0.78;
        this.bgVfx.y = STAGE_HEIGHT * 0.5;
        this.addChildAt(this.bgVfx, 1); // 放到 bg 之上、其他元素之下，不抢视线
      } catch {
        /* skip */
      }
    }

    // === Winner headline ===
    this.headlineText = new Text({
      text: lines.headline,
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 96,
        fill: accent,
        fontWeight: '900',
        letterSpacing: 6,
        stroke: { color: 0x000000, width: 8 },
        dropShadow: {
          color: 0x000000,
          blur: 10,
          distance: 6,
          angle: Math.PI / 4,
          alpha: 0.85,
        },
      },
    });
    this.headlineText.anchor.set(0.5);
    this.headlineText.x = STAGE_WIDTH * 0.7;
    this.headlineText.y = STAGE_HEIGHT * 0.46;
    this.addChild(this.headlineText);

    // 副标题（左侧装饰条）
    const subBar = new Graphics()
      .rect(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.555, STAGE_WIDTH * 0.4, 4)
      .fill(accent);
    this.addChild(subBar);

    // === Quote ===
    const quote = new Text({
      text: lines.quote,
      style: {
        fontFamily: 'system-ui',
        fontSize: 24,
        fill: 0xe5e5e5,
        fontStyle: 'italic',
        wordWrap: true,
        wordWrapWidth: STAGE_WIDTH * 0.42,
        align: 'center',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    quote.anchor.set(0.5);
    quote.x = STAGE_WIDTH * 0.7;
    quote.y = STAGE_HEIGHT * 0.62;
    this.addChild(quote);

    // === Bottom 返回菜单 button ===
    try {
      const texMenu = await Assets.load<Texture>('/sprites/vfx/btn_menu.png');
      const menu = new Sprite(texMenu);
      menu.anchor.set(0.5);
      menu.scale.set(100 / texMenu.height);
      menu.x = STAGE_WIDTH / 2;
      menu.y = STAGE_HEIGHT - 60;
      this.addChild(menu);
    } catch {
      const hint = new Text({
        text: 'ENTER / SPACE  返回菜单',
        style: {
          fontFamily: 'system-ui',
          fontSize: 18,
          fill: 0xfde68a,
          letterSpacing: 3,
          fontWeight: '600',
        },
      });
      hint.anchor.set(0.5);
      hint.x = STAGE_WIDTH / 2;
      hint.y = STAGE_HEIGHT - 45;
      this.addChild(hint);
    }
  }

  update(_deltaMS: number): void {
    this.elapsed += 1;
    if (this.headlineText) {
      // 标题脉动
      const pulse = 1 + 0.04 * Math.sin(this.elapsed * 0.08);
      this.headlineText.scale.set(pulse);
    }
    if (this.cooldown > 0) {
      this.cooldown -= 1;
      return;
    }
    if (
      this.input.wasPressed('Enter') ||
      this.input.wasPressed('Space') ||
      this.input.wasPressed('Escape')
    ) {
      sfx.play('confirm');
      this.onContinue();
    }
  }
}
