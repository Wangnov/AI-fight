import { Container, Graphics, Text } from 'pixi.js';
import {
  ENERGY_BG_COLOR,
  HP_BG_COLOR,
  MAX_ENERGY,
  MAX_HP,
  STAGE_WIDTH,
} from '../config/constants';
import { Fighter } from '../entities/Fighter';

const HP_BAR_WIDTH = 540;
const HP_BAR_HEIGHT = 28;
const ENERGY_BAR_WIDTH = 220;
const ENERGY_BAR_HEIGHT = 14;
const HUD_TOP = 24;

export class HUD extends Container {
  private readonly p1HpFill: Graphics;
  private readonly p2HpFill: Graphics;
  private readonly p1EnergyFill: Graphics;
  private readonly p2EnergyFill: Graphics;
  private readonly p1HpText: Text;
  private readonly p2HpText: Text;
  private readonly p1EnergyText: Text;
  private readonly p2EnergyText: Text;
  private readonly timerText: Text;
  private readonly subtitleText: Text;

  constructor(
    private readonly p1: Fighter,
    private readonly p2: Fighter
  ) {
    super();

    // === 血条 ===
    const p1HpBg = new Graphics()
      .rect(40, HUD_TOP, HP_BAR_WIDTH, HP_BAR_HEIGHT)
      .fill(HP_BG_COLOR)
      .rect(40, HUD_TOP, HP_BAR_WIDTH, HP_BAR_HEIGHT)
      .stroke({ color: 0xffffff, width: 2 });
    this.addChild(p1HpBg);

    const p2HpBg = new Graphics()
      .rect(STAGE_WIDTH - 40 - HP_BAR_WIDTH, HUD_TOP, HP_BAR_WIDTH, HP_BAR_HEIGHT)
      .fill(HP_BG_COLOR)
      .rect(STAGE_WIDTH - 40 - HP_BAR_WIDTH, HUD_TOP, HP_BAR_WIDTH, HP_BAR_HEIGHT)
      .stroke({ color: 0xffffff, width: 2 });
    this.addChild(p2HpBg);

    this.p1HpFill = new Graphics();
    this.p2HpFill = new Graphics();
    this.addChild(this.p1HpFill);
    this.addChild(this.p2HpFill);

    // === 能量条 ===
    const p1EnergyBg = new Graphics()
      .rect(40, HUD_TOP + HP_BAR_HEIGHT + 10, ENERGY_BAR_WIDTH, ENERGY_BAR_HEIGHT)
      .fill(ENERGY_BG_COLOR)
      .rect(40, HUD_TOP + HP_BAR_HEIGHT + 10, ENERGY_BAR_WIDTH, ENERGY_BAR_HEIGHT)
      .stroke({ color: 0xffffff, width: 1 });
    this.addChild(p1EnergyBg);

    const p2EnergyBg = new Graphics()
      .rect(
        STAGE_WIDTH - 40 - ENERGY_BAR_WIDTH,
        HUD_TOP + HP_BAR_HEIGHT + 10,
        ENERGY_BAR_WIDTH,
        ENERGY_BAR_HEIGHT
      )
      .fill(ENERGY_BG_COLOR)
      .rect(
        STAGE_WIDTH - 40 - ENERGY_BAR_WIDTH,
        HUD_TOP + HP_BAR_HEIGHT + 10,
        ENERGY_BAR_WIDTH,
        ENERGY_BAR_HEIGHT
      )
      .stroke({ color: 0xffffff, width: 1 });
    this.addChild(p2EnergyBg);

    this.p1EnergyFill = new Graphics();
    this.p2EnergyFill = new Graphics();
    this.addChild(this.p1EnergyFill);
    this.addChild(this.p2EnergyFill);

    // === 文本 ===
    const p1Name = new Text({
      text: p1.preset.name,
      style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xffffff, fontWeight: 'bold' },
    });
    p1Name.x = 40;
    p1Name.y = HUD_TOP - 22;
    this.addChild(p1Name);

    const p2Name = new Text({
      text: p2.preset.name,
      style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xffffff, fontWeight: 'bold' },
    });
    p2Name.anchor.set(1, 0);
    p2Name.x = STAGE_WIDTH - 40;
    p2Name.y = HUD_TOP - 22;
    this.addChild(p2Name);

    this.p1HpText = new Text({
      text: '',
      style: { fontFamily: 'system-ui', fontSize: 13, fill: 0xffffff },
    });
    this.p1HpText.x = 40 + HP_BAR_WIDTH + 8;
    this.p1HpText.y = HUD_TOP + 6;
    this.addChild(this.p1HpText);

    this.p2HpText = new Text({
      text: '',
      style: { fontFamily: 'system-ui', fontSize: 13, fill: 0xffffff },
    });
    this.p2HpText.anchor.set(1, 0);
    this.p2HpText.x = STAGE_WIDTH - 40 - HP_BAR_WIDTH - 8;
    this.p2HpText.y = HUD_TOP + 6;
    this.addChild(this.p2HpText);

    this.p1EnergyText = new Text({
      text: '',
      style: { fontFamily: 'system-ui', fontSize: 11, fill: 0xffffff },
    });
    this.p1EnergyText.x = 40 + ENERGY_BAR_WIDTH + 8;
    this.p1EnergyText.y = HUD_TOP + HP_BAR_HEIGHT + 8;
    this.addChild(this.p1EnergyText);

    this.p2EnergyText = new Text({
      text: '',
      style: { fontFamily: 'system-ui', fontSize: 11, fill: 0xffffff },
    });
    this.p2EnergyText.anchor.set(1, 0);
    this.p2EnergyText.x = STAGE_WIDTH - 40 - ENERGY_BAR_WIDTH - 8;
    this.p2EnergyText.y = HUD_TOP + HP_BAR_HEIGHT + 8;
    this.addChild(this.p2EnergyText);

    this.timerText = new Text({
      text: '60',
      style: {
        fontFamily: 'system-ui',
        fontSize: 36,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.x = STAGE_WIDTH / 2;
    this.timerText.y = HUD_TOP - 10;
    this.addChild(this.timerText);

    this.subtitleText = new Text({
      text: 'WHO GETS TO USE THE MODEL?',
      style: {
        fontFamily: 'system-ui',
        fontSize: 14,
        fill: 0x9ca3af,
        fontStyle: 'italic',
      },
    });
    this.subtitleText.anchor.set(0.5, 0);
    this.subtitleText.x = STAGE_WIDTH / 2;
    this.subtitleText.y = HUD_TOP + 36;
    this.addChild(this.subtitleText);
  }

  /** 每帧调用，刷新血量/能量/计时器 */
  update(secondsLeft: number): void {
    const p1HpRatio = Math.max(0, this.p1.hp / MAX_HP);
    const p2HpRatio = Math.max(0, this.p2.hp / MAX_HP);
    const p1EnergyRatio = Math.max(0, this.p1.energy / MAX_ENERGY);
    const p2EnergyRatio = Math.max(0, this.p2.energy / MAX_ENERGY);

    // 左侧血条：从右向左缩短（fill 起点固定在左）
    this.p1HpFill.clear();
    this.p1HpFill
      .rect(40, HUD_TOP, HP_BAR_WIDTH * p1HpRatio, HP_BAR_HEIGHT)
      .fill(this.p1.preset.hpFillColor);

    // 右侧血条：从左向右缩短（fill 终点固定在右）
    this.p2HpFill.clear();
    const p2FillWidth = HP_BAR_WIDTH * p2HpRatio;
    this.p2HpFill
      .rect(
        STAGE_WIDTH - 40 - p2FillWidth,
        HUD_TOP,
        p2FillWidth,
        HP_BAR_HEIGHT
      )
      .fill(this.p2.preset.hpFillColor);

    // 能量条
    this.p1EnergyFill.clear();
    this.p1EnergyFill
      .rect(
        40,
        HUD_TOP + HP_BAR_HEIGHT + 10,
        ENERGY_BAR_WIDTH * p1EnergyRatio,
        ENERGY_BAR_HEIGHT
      )
      .fill(this.p1.preset.energyFillColor);

    this.p2EnergyFill.clear();
    const p2EnergyFillWidth = ENERGY_BAR_WIDTH * p2EnergyRatio;
    this.p2EnergyFill
      .rect(
        STAGE_WIDTH - 40 - p2EnergyFillWidth,
        HUD_TOP + HP_BAR_HEIGHT + 10,
        p2EnergyFillWidth,
        ENERGY_BAR_HEIGHT
      )
      .fill(this.p2.preset.energyFillColor);

    this.p1HpText.text = `${this.p1.hp} / ${MAX_HP}`;
    this.p2HpText.text = `${this.p2.hp} / ${MAX_HP}`;
    this.p1EnergyText.text = `${this.p1.preset.energyLabel} ${Math.floor(this.p1.energy)}/${MAX_ENERGY}`;
    this.p2EnergyText.text = `${this.p2.preset.energyLabel} ${Math.floor(this.p2.energy)}/${MAX_ENERGY}`;
    this.timerText.text = `${Math.max(0, Math.ceil(secondsLeft))}`;
  }
}
