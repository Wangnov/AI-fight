import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import { sfx } from '../systems/SoundManager';
import type { BattleMode } from './BattleScene';

export interface CharacterSelectOptions {
  input: InputManager;
  mode: BattleMode;
  bgArena: Texture | null;
  onConfirm: (mode: BattleMode) => void;
  onBack: () => void;
}

/**
 * 角色选择 Scene: 显示 Altman / Dario 大头像 + "VS" + "CHOOSE YOUR FIGHTER" 标题。
 * 双方都 ready (auto-confirmed since chars are fixed Altman vs Dario)，按 Enter 进入 BattleScene。
 * Q / Escape 返回菜单。
 */
export class CharacterSelectScene extends Scene {
  private readonly input: InputManager;
  private readonly mode: BattleMode;
  private readonly onConfirm: (mode: BattleMode) => void;
  private readonly onBack: () => void;
  private highlightFrame = 0;
  private leftHighlight: Graphics | null = null;
  private rightHighlight: Graphics | null = null;
  private readyText: Text | null = null;

  constructor(opts: CharacterSelectOptions) {
    super();
    this.input = opts.input;
    this.mode = opts.mode;
    this.onConfirm = opts.onConfirm;
    this.onBack = opts.onBack;

    // 背景：模糊战场 bg + 暗化 overlay
    if (opts.bgArena) {
      const bg = new Sprite(opts.bgArena);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.35;
      this.addChild(bg);
    } else {
      const bg = new Graphics().rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill(0x0b0d12);
      this.addChild(bg);
    }
    const dark = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.5 });
    this.addChild(dark);

    // 标题 — 用生成的 text_choose 资产，fallback 用 PIXI.Text
    void this.spawnHeader();

    // P1 portrait left, P2 portrait right, "VS" middle
    void this.spawnPortraits();

    // 操作按钮：开始战斗 (中央) + 返回菜单 (右下)
    void this.spawnActionButtons();
  }

  private async spawnActionButtons(): Promise<void> {
    try {
      const texStart = await Assets.load<Texture>('/sprites/vfx/btn_start.png');
      const start = new Sprite(texStart);
      start.anchor.set(0.5);
      start.scale.set(95 / texStart.height);
      start.x = STAGE_WIDTH / 2;
      start.y = STAGE_HEIGHT - 65;
      this.addChild(start);
    } catch {
      const t = new Text({
        text: '按 ENTER 开始战斗',
        style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xfacc15 },
      });
      t.anchor.set(0.5);
      t.x = STAGE_WIDTH / 2;
      t.y = STAGE_HEIGHT - 65;
      this.addChild(t);
    }
    try {
      const texMenu = await Assets.load<Texture>('/sprites/vfx/btn_menu.png');
      const menu = new Sprite(texMenu);
      menu.anchor.set(1, 0.5);
      menu.scale.set(70 / texMenu.height);
      menu.x = STAGE_WIDTH - 24;
      menu.y = STAGE_HEIGHT - 50;
      this.addChild(menu);
    } catch {
      /* skip */
    }
  }

  private async spawnHeader(): Promise<void> {
    try {
      const tex = await Assets.load<Texture>('/sprites/vfx/text_choose.png');
      const header = new Sprite(tex);
      // Fit header into ~110px tall band at the top, with anchor at top-center
      const targetH = 110;
      header.scale.set(targetH / tex.height);
      header.anchor.set(0.5, 0);
      header.x = STAGE_WIDTH / 2;
      header.y = 12;
      this.addChild(header);
    } catch {
      const t = new Text({
        text: 'CHOOSE YOUR FIGHTER',
        style: {
          fontFamily: 'Impact, system-ui',
          fontSize: 56,
          fontWeight: 'bold',
          fill: 0x06b6d4,
          stroke: { color: 0x000000, width: 6 },
          align: 'center',
        },
      });
      t.anchor.set(0.5);
      t.x = STAGE_WIDTH / 2;
      t.y = 70;
      this.addChild(t);
    }
  }

  private async spawnPortraits(): Promise<void> {
    const portraitW = 360;
    const portraitH = 360;
    const yMid = STAGE_HEIGHT / 2 + 20;
    const leftX = STAGE_WIDTH * 0.27;
    const rightX = STAGE_WIDTH * 0.73;

    // Highlight frames (cyan / orange)
    this.leftHighlight = new Graphics()
      .rect(-portraitW / 2 - 10, -portraitH / 2 - 10, portraitW + 20, portraitH + 20)
      .stroke({ color: 0x4ade80, width: 6 });
    this.leftHighlight.x = leftX;
    this.leftHighlight.y = yMid;
    this.addChild(this.leftHighlight);

    this.rightHighlight = new Graphics()
      .rect(-portraitW / 2 - 10, -portraitH / 2 - 10, portraitW + 20, portraitH + 20)
      .stroke({ color: 0xfb923c, width: 6 });
    this.rightHighlight.x = rightX;
    this.rightHighlight.y = yMid;
    this.addChild(this.rightHighlight);

    // P1 (Altman) on left
    try {
      const tex1 = await Assets.load<Texture>('/sprites/scene/portrait_altman.png');
      const p1 = new Sprite(tex1);
      p1.anchor.set(0.5);
      p1.x = leftX;
      p1.y = yMid;
      const s1 = portraitW / Math.max(p1.width, p1.height);
      p1.scale.set(s1);
      this.addChildAt(p1, this.children.indexOf(this.leftHighlight));
    } catch {
      // fallback color box
      const box = new Graphics()
        .rect(leftX - portraitW / 2, yMid - portraitH / 2, portraitW, portraitH)
        .fill(0x4ade80);
      this.addChildAt(box, 0);
    }

    // P2 (Dario) on right
    try {
      const tex2 = await Assets.load<Texture>('/sprites/scene/portrait_dario.png');
      const p2 = new Sprite(tex2);
      p2.anchor.set(0.5);
      p2.x = rightX;
      p2.y = yMid;
      const s2 = portraitW / Math.max(p2.width, p2.height);
      p2.scale.set(s2);
      this.addChildAt(p2, this.children.indexOf(this.rightHighlight));
    } catch {
      const box = new Graphics()
        .rect(rightX - portraitW / 2, yMid - portraitH / 2, portraitW, portraitH)
        .fill(0xfb923c);
      this.addChildAt(box, 0);
    }

    // 名字
    const name1 = new Text({
      text: 'ALTMAN',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0x4ade80,
        stroke: { color: 0x000000, width: 4 },
      },
    });
    name1.anchor.set(0.5);
    name1.x = leftX;
    name1.y = yMid + portraitH / 2 + 40;
    this.addChild(name1);

    const name2 = new Text({
      text: 'DARIO',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0xfb923c,
        stroke: { color: 0x000000, width: 4 },
      },
    });
    name2.anchor.set(0.5);
    name2.x = rightX;
    name2.y = yMid + portraitH / 2 + 40;
    this.addChild(name2);

    // VS 大字 — 用 text_vs 资产
    try {
      const texVs = await Assets.load<Texture>('/sprites/vfx/text_vs.png');
      const vs = new Sprite(texVs);
      const targetH = 240;
      vs.scale.set(targetH / texVs.height);
      vs.anchor.set(0.5);
      vs.x = STAGE_WIDTH / 2;
      vs.y = yMid;
      this.addChild(vs);
    } catch {
      const vs = new Text({
        text: 'VS',
        style: {
          fontFamily: 'Impact, system-ui',
          fontSize: 120,
          fontWeight: 'bold',
          fill: 0xfacc15,
          stroke: { color: 0xff2222, width: 8 },
          align: 'center',
        },
      });
      vs.anchor.set(0.5);
      vs.x = STAGE_WIDTH / 2;
      vs.y = yMid;
      this.addChild(vs);
    }

    this.readyText = new Text({
      text: 'READY?',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xfacc15,
        stroke: { color: 0x000000, width: 4 },
      },
    });
    this.readyText.anchor.set(0.5);
    this.readyText.x = STAGE_WIDTH / 2;
    // 挪到 "开始战斗" 按钮上方 (按钮在 y=STAGE_HEIGHT-65)
    this.readyText.y = STAGE_HEIGHT - 145;
    this.addChild(this.readyText);
  }

  update(_deltaMS: number): void {
    this.highlightFrame += 1;
    // 闪烁 highlight
    const pulse = 0.6 + Math.sin(this.highlightFrame * 0.1) * 0.4;
    if (this.leftHighlight) this.leftHighlight.alpha = pulse;
    if (this.rightHighlight) this.rightHighlight.alpha = pulse;
    if (this.readyText) {
      const blink = (this.highlightFrame % 60) < 30;
      this.readyText.alpha = blink ? 1 : 0.3;
    }

    if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      sfx.play('confirm');
      this.onConfirm(this.mode);
    } else if (this.input.wasPressed('KeyQ') || this.input.wasPressed('Escape')) {
      sfx.play('select');
      this.onBack();
    }
  }
}
