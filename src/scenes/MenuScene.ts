import { Assets, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import { sfx } from '../systems/SoundManager';
import type { BattleMode } from './BattleScene';

export interface MenuSceneOptions {
  input: InputManager;
  bgArena: Texture | null;
  onStart: (mode: BattleMode) => void;
}

interface MenuItem {
  label: string;
  mode: BattleMode;
  desc: string;
}

const ITEMS: MenuItem[] = [
  { label: '双人对战  PvP', mode: 'pvp', desc: '本地双人 · 键盘对战' },
  { label: '人机对战  PvE', mode: 'pve', desc: '挑战 AI · 单人模式' },
];

export class MenuScene extends Scene {
  private readonly input: InputManager;
  private readonly onStart: (mode: BattleMode) => void;
  private itemSprites: Sprite[] = [];
  private selected = 0;
  private elapsed = 0;
  // refs for animation
  private titleSprite: Sprite | null = null;
  private leftPose: Sprite | null = null;
  private rightPose: Sprite | null = null;
  private overlayLight: Graphics | null = null;
  private subtitleZh: Text | null = null;

  constructor(opts: MenuSceneOptions) {
    super();
    this.input = opts.input;
    this.onStart = opts.onStart;

    const fallbackBg = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill(0x0b0d12);
    this.addChild(fallbackBg);

    void this.spawnLayers(opts.bgArena);
  }

  private async spawnLayers(bgArena: Texture | null): Promise<void> {
    // === Layer 1: Background ===
    let bgUsed = false;
    try {
      const tex = await Assets.load<Texture>('/sprites/scene/menu_bg.png');
      const bg = new Sprite(tex);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      this.addChild(bg);
      bgUsed = true;
    } catch {
      /* fall through */
    }
    if (!bgUsed && bgArena) {
      const bg = new Sprite(bgArena);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.55;
      this.addChild(bg);
    } else if (!bgUsed) {
      const bg = new Graphics().rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill(0x0b0d12);
      this.addChild(bg);
    }
    // === Layer 2: Character full poses — 在 title 下方，缩小到 head 不进入 title 区域 ===
    try {
      const tex = await Assets.load<Texture>('/sprites/scene/menu_altman.png');
      this.leftPose = new Sprite(tex);
      const targetH = STAGE_HEIGHT * 0.66; // 0.66*720=475，top y=233 — title bottom 212 下方
      this.leftPose.scale.set(targetH / tex.height);
      this.leftPose.anchor.set(0.5, 1);
      this.leftPose.x = STAGE_WIDTH * 0.16;
      this.leftPose.y = STAGE_HEIGHT - 6;
      this.addChild(this.leftPose);
    } catch {
      /* skip */
    }
    try {
      const tex = await Assets.load<Texture>('/sprites/scene/menu_dario.png');
      this.rightPose = new Sprite(tex);
      const targetH = STAGE_HEIGHT * 0.66;
      this.rightPose.scale.set(targetH / tex.height);
      this.rightPose.anchor.set(0.5, 1);
      this.rightPose.x = STAGE_WIDTH * 0.84;
      this.rightPose.y = STAGE_HEIGHT - 6;
      this.addChild(this.rightPose);
    } catch {
      /* skip */
    }

    // === Layer 3: Title banner (top, super-wide) — 永远在最上层 ===
    try {
      const tex = await Assets.load<Texture>('/sprites/scene/menu_title.png');
      this.titleSprite = new Sprite(tex);
      const targetH = 200;
      this.titleSprite.scale.set(targetH / tex.height);
      this.titleSprite.anchor.set(0.5, 0);
      this.titleSprite.x = STAGE_WIDTH / 2;
      this.titleSprite.y = 12;
      this.addChild(this.titleSprite);
    } catch {
      const t = new Text({
        text: 'AI FIGHT',
        style: {
          fontFamily: 'Impact, system-ui',
          fontSize: 130,
          fontWeight: 'bold',
          fill: 0xffd54a,
          stroke: { color: 0x000000, width: 10 },
          dropShadow: { color: 0x000000, blur: 10, distance: 6, alpha: 0.8 },
        },
      });
      t.anchor.set(0.5, 0);
      t.x = STAGE_WIDTH / 2;
      t.y = 30;
      this.addChild(t);
    }

    // 中文 subtitle 在 title 下方
    this.subtitleZh = new Text({
      text: '· AI 公司全明星大乱斗 · 讽刺向 H5 街机格斗 ·',
      style: {
        fontFamily: 'system-ui',
        fontSize: 16,
        fill: 0xfde68a,
        letterSpacing: 4,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.subtitleZh.anchor.set(0.5, 0);
    this.subtitleZh.x = STAGE_WIDTH / 2;
    this.subtitleZh.y = 215;
    this.addChild(this.subtitleZh);

    // === Layer 4: Mode select buttons (中文按钮素材，横向 wide pill) ===
    const buttonSprites: Sprite[] = [];
    const btnPaths = ['/sprites/vfx/btn_pvp.png', '/sprites/vfx/btn_pve.png'];
    const btnY0 = STAGE_HEIGHT * 0.62;
    const btnTargetH = 110;
    for (let i = 0; i < ITEMS.length; i++) {
      try {
        const tex = await Assets.load<Texture>(btnPaths[i]);
        const btn = new Sprite(tex);
        btn.anchor.set(0.5);
        btn.scale.set(btnTargetH / tex.height);
        btn.x = STAGE_WIDTH / 2;
        btn.y = btnY0 + i * (btnTargetH + 20);
        this.addChild(btn);
        buttonSprites.push(btn);
      } catch {
        /* fallback */
      }
    }
    this.itemSprites = buttonSprites;

    // 操作提示
    const hint = new Text({
      text: '↑↓ / W S 选择    ENTER / SPACE 开始    ·    AI Fight v1.0',
      style: {
        fontFamily: 'system-ui',
        fontSize: 13,
        fill: 0xa1a1aa,
        letterSpacing: 2,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    hint.anchor.set(0.5);
    hint.x = STAGE_WIDTH / 2;
    hint.y = STAGE_HEIGHT - 14;
    this.addChild(hint);

    // 全屏 vignette + 顶部光辉
    this.overlayLight = new Graphics();
    this.addChild(this.overlayLight);

    this.refresh();
  }

  update(_deltaMS: number): void {
    this.elapsed += 1;

    // 角色轻微浮动 + 标题脉动
    const float = Math.sin(this.elapsed * 0.04) * 4;
    if (this.leftPose) this.leftPose.y = STAGE_HEIGHT - 12 + float;
    if (this.rightPose) this.rightPose.y = STAGE_HEIGHT - 12 - float;
    if (this.titleSprite) {
      const pulse = 1 + 0.018 * Math.sin(this.elapsed * 0.06);
      this.titleSprite.scale.set((220 / this.titleSprite.texture.height) * pulse);
    }
    if (this.subtitleZh) {
      this.subtitleZh.alpha = 0.7 + 0.3 * Math.sin(this.elapsed * 0.05);
    }
    // 选中按钮微微弹缩
    this.itemSprites.forEach((s, i) => {
      const active = i === this.selected;
      const baseScale = 110 / s.texture.height;
      s.scale.set(active ? baseScale * (1 + 0.04 * Math.sin(this.elapsed * 0.12)) : baseScale);
    });

    if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
      this.selected = (this.selected - 1 + ITEMS.length) % ITEMS.length;
      sfx.play('select');
      this.refresh();
    }
    if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
      this.selected = (this.selected + 1) % ITEMS.length;
      sfx.play('select');
      this.refresh();
    }
    if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      sfx.play('confirm');
      this.onStart(ITEMS[this.selected].mode);
    }
  }

  private refresh(): void {
    this.itemSprites.forEach((s, i) => {
      const active = i === this.selected;
      s.alpha = active ? 1.0 : 0.55;
    });
  }
}
