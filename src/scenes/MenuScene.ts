import { Graphics, Text } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import type { BattleMode } from './BattleScene';

export interface MenuSceneOptions {
  input: InputManager;
  onStart: (mode: BattleMode) => void;
}

interface MenuItem {
  label: string;
  mode: BattleMode;
}

const ITEMS: MenuItem[] = [
  { label: '双人对战 (PvP)', mode: 'pvp' },
  { label: '人 vs AI (PvE)', mode: 'pve' },
];

export class MenuScene extends Scene {
  private readonly input: InputManager;
  private readonly onStart: (mode: BattleMode) => void;
  private readonly itemTexts: Text[] = [];
  private selected = 0;

  constructor(opts: MenuSceneOptions) {
    super();
    this.input = opts.input;
    this.onStart = opts.onStart;

    const bg = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(0x0b0d12);
    this.addChild(bg);

    const title = new Text({
      text: 'AI 公司全明星大乱斗',
      style: {
        fontFamily: 'system-ui',
        fontSize: 64,
        fill: 0xffffff,
        fontWeight: 'bold',
        letterSpacing: 4,
      },
    });
    title.anchor.set(0.5);
    title.x = STAGE_WIDTH / 2;
    title.y = 180;
    this.addChild(title);

    const subtitle = new Text({
      text: 'ALTMAN  vs  DARIO   —   讽刺向 H5 格斗 MVP',
      style: {
        fontFamily: 'system-ui',
        fontSize: 20,
        fill: 0x9ca3af,
        letterSpacing: 2,
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.x = STAGE_WIDTH / 2;
    subtitle.y = 240;
    this.addChild(subtitle);

    ITEMS.forEach((item, i) => {
      const t = new Text({
        text: item.label,
        style: {
          fontFamily: 'system-ui',
          fontSize: 32,
          fill: 0xffffff,
          fontWeight: '600',
        },
      });
      t.anchor.set(0.5);
      t.x = STAGE_WIDTH / 2;
      t.y = 380 + i * 70;
      this.itemTexts.push(t);
      this.addChild(t);
    });

    const hint = new Text({
      text: '↑ ↓ / W S 选择    Enter / Space 开始    （PvP: P1 用 WASD,P2 用方向键）',
      style: {
        fontFamily: 'system-ui',
        fontSize: 14,
        fill: 0x6b7280,
      },
    });
    hint.anchor.set(0.5);
    hint.x = STAGE_WIDTH / 2;
    hint.y = STAGE_HEIGHT - 60;
    this.addChild(hint);

    this.refresh();
  }

  update(_deltaMS: number): void {
    if (
      this.input.wasPressed('ArrowUp') ||
      this.input.wasPressed('KeyW')
    ) {
      this.selected = (this.selected - 1 + ITEMS.length) % ITEMS.length;
      this.refresh();
    }
    if (
      this.input.wasPressed('ArrowDown') ||
      this.input.wasPressed('KeyS')
    ) {
      this.selected = (this.selected + 1) % ITEMS.length;
      this.refresh();
    }
    if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      this.onStart(ITEMS[this.selected].mode);
    }
  }

  private refresh(): void {
    this.itemTexts.forEach((t, i) => {
      const active = i === this.selected;
      t.style.fill = active ? 0x4ade80 : 0xffffff;
      t.text = (active ? '▶  ' : '   ') + ITEMS[i].label;
    });
  }
}
