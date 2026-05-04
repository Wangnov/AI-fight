import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config/constants';
import {
  CHARACTER_ROSTER,
  type BattleSelections,
  type CharacterDefinition,
} from '../config/characters';
import { Scene } from '../core/Scene';
import { InputManager } from '../input/InputManager';
import { sfx } from '../systems/SoundManager';
import type { BattleMode } from './BattleScene';

type PlayerSlot = 'p1' | 'p2';

interface CharacterSelectOptions {
  input: InputManager;
  mode: BattleMode;
  bgArena: Texture | null;
  onConfirm: (mode: BattleMode, selections: BattleSelections) => void;
  onBack: () => void;
}

interface CardLayout {
  character: CharacterDefinition;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ControlPrompt {
  root: Container;
  panel: Graphics;
  label: Text;
  detail: Text;
}

const P1_COLOR = 0x4ade80;
const P2_COLOR = 0xfb923c;
const CARD_W = 360;
const CARD_H = 360;
const START_DELAY_MS = 360;
const SELECTOR_OUTER_PAD = 22;
const POINTER_LABEL_GAP = 42;
const POINTER_TIP_GAP = 8;
const SAME_CARD_LABEL_OFFSET = 46;
const SAME_CARD_FRAME_OFFSET = 8;

/**
 * 街机式选人：玩家移动光标选卡，确认后 Ready。
 * PVE: P1 选择角色，CPU 自动选择另一名角色。
 * PVP: P1/P2 分别选择并 Ready，双方 Ready 后进入战斗。
 */
export class CharacterSelectScene extends Scene {
  private readonly input: InputManager;
  private readonly mode: BattleMode;
  private readonly onConfirm: (mode: BattleMode, selections: BattleSelections) => void;
  private readonly onBack: () => void;

  private readonly cards: CardLayout[] = [];
  private readonly selectorGraphics = new Graphics();
  private readonly p1Badge: Text;
  private readonly p2Badge: Text;
  private readonly cpuBadge: Text;
  private readonly p1ReadyStamp: Text;
  private readonly p2ReadyStamp: Text;
  private readonly statusText: Text;
  private readonly p1Prompt: ControlPrompt;
  private readonly p2Prompt: ControlPrompt;
  private readonly helpText: Text;

  private selected: Record<PlayerSlot, number> = { p1: 0, p2: 1 };
  private ready: Record<PlayerSlot, boolean> = { p1: false, p2: false };
  private highlightFrame = 0;
  private startDelayMS = -1;
  private startTimer: number | null = null;
  private didConfirm = false;

  constructor(opts: CharacterSelectOptions) {
    super();
    this.input = opts.input;
    this.mode = opts.mode;
    this.onConfirm = opts.onConfirm;
    this.onBack = opts.onBack;

    this.p1Badge = this.makeBadge('P1', P1_COLOR);
    this.p2Badge = this.makeBadge('P2', P2_COLOR);
    this.cpuBadge = this.makeBadge('CPU', P2_COLOR);
    this.p1ReadyStamp = this.makeReadyStamp('P1 READY', P1_COLOR);
    this.p2ReadyStamp = this.makeReadyStamp(this.mode === 'pve' ? 'CPU READY' : 'P2 READY', P2_COLOR);
    this.statusText = this.makeStatusText();
    this.p1Prompt = this.makeControlPrompt('P1', P1_COLOR);
    this.p2Prompt = this.makeControlPrompt(this.mode === 'pve' ? 'CPU' : 'P2', P2_COLOR);
    this.helpText = this.makeHelpText();

    this.syncCpuSelection();
    this.spawnBackground(opts.bgArena);
    this.spawnHeader();
    this.spawnPortraitCards();
    this.spawnActionStrip();
    this.addChild(this.selectorGraphics);
    this.addChild(this.p1Badge, this.p2Badge, this.cpuBadge, this.p1ReadyStamp, this.p2ReadyStamp);
    this.addChild(this.statusText, this.p1Prompt.root, this.p2Prompt.root, this.helpText);
    this.drawSelectors();
  }

  private spawnBackground(bgArena: Texture | null): void {
    let fallbackBg: Graphics | null = null;
    if (bgArena) {
      const bg = new Sprite(bgArena);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.35;
      this.addChild(bg);
    } else {
      fallbackBg = new Graphics().rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill(0x0b0d12);
      this.addChild(fallbackBg);
      void this.replaceFallbackBackground(fallbackBg);
    }

    const dark = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.52 });
    this.addChild(dark);
  }

  private async replaceFallbackBackground(fallbackBg: Graphics): Promise<void> {
    try {
      const tex = await Assets.load<Texture>('/sprites/scene/menu_bg.png');
      if (this.destroyed || fallbackBg.destroyed) return;
      const bg = new Sprite(tex);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.alpha = 0.48;
      const index = this.children.includes(fallbackBg)
        ? this.children.indexOf(fallbackBg)
        : 0;
      this.addChildAt(bg, index);
      if (this.children.includes(fallbackBg)) {
        this.removeChild(fallbackBg);
        fallbackBg.destroy();
      }
    } catch {
      /* keep fallback */
    }
  }

  private spawnHeader(): void {
    const header = new Text({
      text: 'CHOOSE YOUR FIGHTER',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 64,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x0ea5e9, width: 7 },
        dropShadow: { color: 0x000000, blur: 8, distance: 4, alpha: 0.82 },
        letterSpacing: 2,
      },
    });
    header.anchor.set(0.5);
    header.x = STAGE_WIDTH / 2;
    header.y = 58;
    this.addChild(header);

    const underline = new Graphics()
      .moveTo(STAGE_WIDTH / 2 - 260, 96)
      .lineTo(STAGE_WIDTH / 2 + 260, 96)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.22 })
      .moveTo(STAGE_WIDTH / 2 - 180, 102)
      .lineTo(STAGE_WIDTH / 2 + 180, 102)
      .stroke({ color: 0x22d3ee, width: 2, alpha: 0.45 });
    this.addChild(underline);
  }

  private spawnPortraitCards(): void {
    const yMid = STAGE_HEIGHT / 2 + 20;
    const xs = [STAGE_WIDTH * 0.27, STAGE_WIDTH * 0.73];

    CHARACTER_ROSTER.forEach((character, index) => {
      const x = xs[index] ?? STAGE_WIDTH / 2;
      const card = new Container();
      card.x = x;
      card.y = yMid;

      const panel = new Graphics()
        .rect(-CARD_W / 2 - 14, -CARD_H / 2 - 14, CARD_W + 28, CARD_H + 28)
        .fill({ color: 0x05070d, alpha: 0.72 })
        .rect(-CARD_W / 2 - 14, -CARD_H / 2 - 14, CARD_W + 28, CARD_H + 28)
        .stroke({ color: character.color, width: 2, alpha: 0.55 })
        .rect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H)
        .fill({ color: 0x000000, alpha: 0.24 });
      card.addChild(panel);

      const loading = new Text({
        text: character.name,
        style: {
          fontFamily: 'Impact, system-ui',
          fontSize: 36,
          fontWeight: 'bold',
          fill: character.color,
          stroke: { color: 0x000000, width: 4 },
        },
      });
      loading.anchor.set(0.5);
      card.addChild(loading);

      this.addChild(card);
      this.cards.push({ character, x, y: yMid, w: CARD_W, h: CARD_H });
      void this.loadPortrait(card, loading, character);

      const name = new Text({
        text: character.name,
        style: {
          fontFamily: 'Impact, system-ui',
          fontSize: 42,
          fontWeight: 'bold',
          fill: character.color,
          stroke: { color: 0x000000, width: 4 },
        },
      });
      name.anchor.set(0.5);
      name.x = x;
      name.y = yMid + CARD_H / 2 + 42;
      this.addChild(name);
    });

    void this.spawnVs(yMid);
  }

  private async loadPortrait(
    card: Container,
    loading: Text,
    character: CharacterDefinition
  ): Promise<void> {
    try {
      const tex = await Assets.load<Texture>(character.portraitPath);
      if (this.destroyed || card.destroyed || loading.destroyed) return;
      const portrait = new Sprite(tex);
      portrait.anchor.set(0.5);
      portrait.scale.set(CARD_W / Math.max(tex.width, tex.height));
      card.addChildAt(portrait, 1);
      if (card.children.includes(loading)) {
        card.removeChild(loading);
        loading.destroy();
      }
    } catch {
      /* keep text fallback */
    }
  }

  private async spawnVs(yMid: number): Promise<void> {
    try {
      const texVs = await Assets.load<Texture>('/sprites/vfx/text_vs.png');
      if (this.destroyed) return;
      const vs = new Sprite(texVs);
      vs.scale.set(240 / texVs.height);
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
        },
      });
      vs.anchor.set(0.5);
      vs.x = STAGE_WIDTH / 2;
      vs.y = yMid;
      this.addChild(vs);
    }
  }

  private spawnActionStrip(): void {
    const strip = new Graphics()
      .rect(0, STAGE_HEIGHT - 112, STAGE_WIDTH, 112)
      .fill({ color: 0x020308, alpha: 0.34 })
      .moveTo(0, STAGE_HEIGHT - 112)
      .lineTo(STAGE_WIDTH, STAGE_HEIGHT - 112)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.12 });
    this.addChild(strip);
  }

  private makeBadge(text: string, color: number): Text {
    const badge = new Text({
      text,
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 32,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x000000, width: 5 },
        dropShadow: { color: 0x000000, blur: 5, distance: 3, alpha: 0.8 },
      },
    });
    badge.anchor.set(0.5);
    return badge;
  }

  private makeReadyStamp(text: string, color: number): Text {
    const stamp = new Text({
      text,
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color, width: 7 },
        dropShadow: { color: 0x000000, blur: 8, distance: 4, alpha: 0.75 },
      },
    });
    stamp.anchor.set(0.5);
    stamp.rotation = -0.08;
    return stamp;
  }

  private makeStatusText(): Text {
    const text = new Text({
      text: '',
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 26,
        fontWeight: 'bold',
        fill: 0xfacc15,
        stroke: { color: 0x000000, width: 5 },
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.x = STAGE_WIDTH / 2;
    text.y = STAGE_HEIGHT - 104;
    return text;
  }

  private makeControlPrompt(label: string, color: number): ControlPrompt {
    const root = new Container();
    const panel = new Graphics();
    root.addChild(panel);

    const labelText = new Text({
      text: label,
      style: {
        fontFamily: 'Impact, system-ui',
        fontSize: 24,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x000000, width: 4 },
      },
    });
    labelText.anchor.set(0, 0.5);
    labelText.x = 16;
    root.addChild(labelText);

    const detail = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xf8fafc,
        letterSpacing: 0.5,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    detail.anchor.set(0, 0.5);
    detail.x = 74;
    root.addChild(detail);

    return { root, panel, label: labelText, detail };
  }

  private makeHelpText(): Text {
    const text = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui',
        fontSize: 13,
        fill: 0xcbd5e1,
        align: 'center',
        letterSpacing: 1.5,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    text.anchor.set(0.5);
    text.x = STAGE_WIDTH / 2;
    text.y = STAGE_HEIGHT - 22;
    return text;
  }

  update(deltaMS: number): void {
    this.highlightFrame += 1;

    if (this.input.wasPressed('KeyQ') || this.input.wasPressed('Escape')) {
      sfx.play('select');
      this.onBack();
      return;
    }

    if (!this.didConfirm) {
      this.handleSelectionInput();
      this.handleReadyInput();
      this.advanceStartDelay(deltaMS);
      if (this.didConfirm) return;
    }

    this.drawSelectors();
  }

  override onUnmount(): void {
    if (this.startTimer !== null) {
      window.clearTimeout(this.startTimer);
      this.startTimer = null;
    }
  }

  private handleSelectionInput(): void {
    if (this.startDelayMS >= 0) return;

    if (this.mode === 'pve') {
      if (!this.ready.p1 && this.anyPressed(['KeyA', 'ArrowLeft'])) {
        this.movePlayer('p1', -1);
      }
      if (!this.ready.p1 && this.anyPressed(['KeyD', 'ArrowRight'])) {
        this.movePlayer('p1', 1);
      }
      return;
    }

    if (!this.ready.p1 && this.anyPressed(['KeyA', 'KeyW'])) {
      this.movePlayer('p1', -1);
    }
    if (!this.ready.p1 && this.anyPressed(['KeyD', 'KeyS'])) {
      this.movePlayer('p1', 1);
    }
    if (!this.ready.p2 && this.input.wasPressed('ArrowLeft')) {
      this.movePlayer('p2', -1);
    }
    if (!this.ready.p2 && this.input.wasPressed('ArrowRight')) {
      this.movePlayer('p2', 1);
    }
  }

  private handleReadyInput(): void {
    if (this.startDelayMS >= 0) return;

    if (this.mode === 'pve') {
      if (this.anyPressed(['Enter', 'Space', 'KeyU'])) {
        this.ready.p1 = true;
        this.ready.p2 = true;
        sfx.play('confirm');
        this.queueStart();
      }
      return;
    }

    if (!this.ready.p1 && this.anyPressed(['Enter', 'KeyU'])) {
      this.ready.p1 = true;
      sfx.play('confirm');
    }
    if (!this.ready.p2 && this.anyPressed(['Space', 'KeyJ'])) {
      this.ready.p2 = true;
      sfx.play('confirm');
    }
    if (this.ready.p1 && this.ready.p2) {
      this.queueStart();
    }
  }

  private advanceStartDelay(deltaMS: number): void {
    if (this.startDelayMS < 0) return;
    this.startDelayMS -= deltaMS;
    if (this.startDelayMS > 0) return;

    this.finishConfirm();
  }

  private movePlayer(player: PlayerSlot, delta: number): void {
    const next = (this.selected[player] + delta + CHARACTER_ROSTER.length) % CHARACTER_ROSTER.length;
    if (next === this.selected[player]) return;
    this.selected[player] = next;
    if (this.mode === 'pve') {
      this.syncCpuSelection();
    }
    sfx.play('select');
  }

  private syncCpuSelection(): void {
    if (this.mode !== 'pve') return;
    this.selected.p2 = (this.selected.p1 + 1) % CHARACTER_ROSTER.length;
  }

  private queueStart(): void {
    if (this.startDelayMS >= 0) return;
    this.startDelayMS = START_DELAY_MS;
    this.startTimer = window.setTimeout(() => {
      this.finishConfirm();
    }, START_DELAY_MS);
  }

  private finishConfirm(): void {
    if (this.didConfirm) return;
    this.didConfirm = true;
    if (this.startTimer !== null) {
      window.clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    this.onConfirm(this.mode, this.getSelections());
  }

  private getSelections(): BattleSelections {
    return {
      p1: this.cards[this.selected.p1]?.character.id ?? CHARACTER_ROSTER[0].id,
      p2: this.cards[this.selected.p2]?.character.id ?? CHARACTER_ROSTER[1].id,
    };
  }

  private anyPressed(codes: readonly string[]): boolean {
    return codes.some((code) => this.input.wasPressed(code));
  }

  private drawSelectors(): void {
    this.selectorGraphics.clear();
    this.drawPlayerSelector('p1', P1_COLOR);

    if (this.mode === 'pvp') {
      this.drawPlayerSelector('p2', P2_COLOR);
    } else {
      this.drawCpuSelector();
    }

    this.updateBadges();
    this.updateStatusText();
  }

  private drawPlayerSelector(player: PlayerSlot, color: number): void {
    const card = this.cards[this.selected[player]];
    if (!card) return;
    const bothOnSame = this.mode === 'pvp' && this.selected.p1 === this.selected.p2;
    const frameOffset = bothOnSame
      ? player === 'p1'
        ? -SAME_CARD_FRAME_OFFSET
        : SAME_CARD_FRAME_OFFSET
      : 0;
    const pulse = 0.72 + Math.sin(this.highlightFrame * 0.12) * 0.28;
    const locked = this.ready[player];

    this.selectorGraphics
      .rect(
        card.x - card.w / 2 - SELECTOR_OUTER_PAD + frameOffset,
        card.y - card.h / 2 - SELECTOR_OUTER_PAD + frameOffset,
        card.w + SELECTOR_OUTER_PAD * 2,
        card.h + SELECTOR_OUTER_PAD * 2
      )
      .stroke({ color, width: locked ? 8 : 5, alpha: locked ? 1 : pulse });

    const pointerX = this.getPointerX(player, card);
    const cardTop = card.y - card.h / 2 - SELECTOR_OUTER_PAD;
    const arrowTipY = cardTop - POINTER_TIP_GAP;
    const arrowBaseY = arrowTipY - 30;
    this.selectorGraphics
      .moveTo(pointerX, arrowTipY)
      .lineTo(pointerX - 22, arrowBaseY)
      .lineTo(pointerX + 22, arrowBaseY)
      .closePath()
      .fill({ color, alpha: locked ? 1 : pulse });
  }

  private drawCpuSelector(): void {
    const card = this.cards[this.selected.p2];
    if (!card) return;
    this.selectorGraphics
      .rect(card.x - card.w / 2 - 12, card.y - card.h / 2 - 12, card.w + 24, card.h + 24)
      .stroke({ color: P2_COLOR, width: 3, alpha: 0.45 });
  }

  private updateBadges(): void {
    this.positionBadge(this.p1Badge, 'p1', P1_COLOR, 'P1');
    this.p2Badge.visible = this.mode === 'pvp';
    this.cpuBadge.visible = this.mode === 'pve';
    if (this.mode === 'pvp') {
      this.positionBadge(this.p2Badge, 'p2', P2_COLOR, 'P2');
    } else {
      this.positionCpuBadge();
    }

    this.p1ReadyStamp.visible = this.ready.p1;
    this.p2ReadyStamp.visible = this.ready.p2;
    this.positionReadyStamp(this.p1ReadyStamp, this.selected.p1, -28);
    this.positionReadyStamp(this.p2ReadyStamp, this.selected.p2, 28);
  }

  private positionBadge(
    badge: Text,
    player: PlayerSlot,
    color: number,
    label: string
  ): void {
    const card = this.cards[this.selected[player]];
    if (!card) return;
    const pointerX = this.getPointerX(player, card);
    badge.style.fill = color;
    badge.text = label;
    badge.x = pointerX;
    badge.y = card.y - card.h / 2 - SELECTOR_OUTER_PAD - POINTER_TIP_GAP - POINTER_LABEL_GAP;
    badge.alpha = 0.82 + Math.sin(this.highlightFrame * 0.1) * 0.18;
  }

  private positionCpuBadge(): void {
    const card = this.cards[this.selected.p2];
    if (!card) return;
    this.cpuBadge.text = 'CPU';
    this.cpuBadge.style.fill = P2_COLOR;
    this.cpuBadge.x = card.x;
    this.cpuBadge.y = card.y - card.h / 2 - SELECTOR_OUTER_PAD - POINTER_TIP_GAP - POINTER_LABEL_GAP;
    this.cpuBadge.alpha = 0.82 + Math.sin(this.highlightFrame * 0.1) * 0.18;
  }

  private getPointerX(player: PlayerSlot, card: CardLayout): number {
    if (this.mode !== 'pvp' || this.selected.p1 !== this.selected.p2) return card.x;
    return card.x + (player === 'p1' ? -SAME_CARD_LABEL_OFFSET : SAME_CARD_LABEL_OFFSET);
  }

  private positionReadyStamp(stamp: Text, cardIndex: number, yOffset: number): void {
    const card = this.cards[cardIndex];
    if (!card) return;
    const bothOnSame = this.mode === 'pvp' && this.selected.p1 === this.selected.p2;
    stamp.x = card.x;
    stamp.y = card.y + (bothOnSame ? yOffset : 0);
  }

  private updateStatusText(): void {
    this.positionControlPrompts();

    if (this.startDelayMS >= 0) {
      this.statusText.visible = true;
      this.statusText.text = 'READY  FIGHT!';
      this.p1Prompt.root.visible = false;
      this.p2Prompt.root.visible = false;
      this.helpText.text = 'loading selected fighters...';
      return;
    }

    this.p1Prompt.root.visible = true;
    this.p2Prompt.root.visible = true;

    if (this.mode === 'pve') {
      const player = this.cards[this.selected.p1]?.character.name ?? 'P1';
      const cpu = this.cards[this.selected.p2]?.character.name ?? 'CPU';
      this.statusText.visible = true;
      this.statusText.text = `P1: ${player}  VS  CPU: ${cpu}`;
      this.setControlPrompt(this.p1Prompt, 'P1', P1_COLOR, this.ready.p1 ? 'READY' : 'A/D 或 ←/→ 选择 · Enter/Space/U 确认');
      this.setControlPrompt(this.p2Prompt, 'CPU', P2_COLOR, '自动选择对手');
      this.helpText.text = 'Q/Esc 返回菜单';
      return;
    }

    this.statusText.visible = false;
    this.setControlPrompt(this.p1Prompt, 'P1', P1_COLOR, this.ready.p1 ? 'READY' : 'A/D 选择 · U/Enter Ready');
    this.setControlPrompt(this.p2Prompt, 'P2', P2_COLOR, this.ready.p2 ? 'READY' : '←/→ 选择 · J/Space Ready');
    this.helpText.text = '双方 Ready 后自动开始 · Q/Esc 返回菜单';
  }

  private positionControlPrompts(): void {
    const w = 520;
    const h = 44;
    const y = STAGE_HEIGHT - 66;
    this.p1Prompt.root.x = 34;
    this.p1Prompt.root.y = y;
    this.p2Prompt.root.x = STAGE_WIDTH - w - 34;
    this.p2Prompt.root.y = y;
    this.redrawControlPanel(this.p1Prompt, w, h, P1_COLOR);
    this.redrawControlPanel(this.p2Prompt, w, h, P2_COLOR);
  }

  private redrawControlPanel(prompt: ControlPrompt, w: number, h: number, color: number): void {
    prompt.panel
      .clear()
      .rect(0, -h / 2, w, h)
      .fill({ color: 0x020617, alpha: 0.58 })
      .rect(0, -h / 2, w, h)
      .stroke({ color, width: 2, alpha: 0.6 });
  }

  private setControlPrompt(
    prompt: ControlPrompt,
    label: string,
    color: number,
    detail: string
  ): void {
    prompt.label.text = label;
    prompt.label.style.fill = color;
    prompt.detail.text = detail;
  }
}
