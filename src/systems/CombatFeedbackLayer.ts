import { Container, Graphics } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import { Fighter } from '../entities/Fighter';
import type { CombatEvent } from './CombatSystem';
import { HitEffectsLayer } from './HitEffectsLayer';

interface AttackCue {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  framesLeft: number;
  totalFrames: number;
}

export class CombatFeedbackLayer extends Container {
  private readonly attackCues = new Graphics();
  private readonly hitEffects: HitEffectsLayer;
  private readonly activeCues: AttackCue[] = [];

  constructor(vfx: SpriteSet) {
    super();
    this.attackCues.blendMode = 'add';
    this.addChild(this.attackCues);
    this.hitEffects = new HitEffectsLayer(vfx);
    this.addChild(this.hitEffects);
  }

  showActiveAttacks(fighters: readonly Fighter[]): void {
    if (fighters.length === 0) {
      this.activeCues.length = 0;
      this.drawAttackCues();
      return;
    }

    for (const fighter of fighters) {
      const active = fighter.getActiveAttackHitbox();
      if (!active || active.attack.kind === 'ultimate') continue;

      const color = fighter.id === 'P1' ? 0x4ade80 : 0xfb923c;
      this.activeCues.push({
        ...active.box,
        color,
        framesLeft: 18,
        totalFrames: 18,
      });
    }
    this.drawAttackCues();
  }

  private drawAttackCues(): void {
    this.attackCues.clear();
    for (const cue of this.activeCues) {
      const alpha = cue.framesLeft / cue.totalFrames;
      this.attackCues
        .rect(cue.x, cue.y, cue.w, cue.h)
        .fill({ color: cue.color, alpha: 0.2 * alpha })
        .rect(cue.x, cue.y, cue.w, cue.h)
        .stroke({ color: cue.color, width: 4, alpha: 0.85 * alpha });
    }
  }

  ingest(events: readonly CombatEvent[], hitPoints: Map<string, { x: number; y: number }>): void {
    this.hitEffects.ingest(events, hitPoints);
  }

  update(): void {
    for (let i = this.activeCues.length - 1; i >= 0; i -= 1) {
      this.activeCues[i].framesLeft -= 1;
      if (this.activeCues[i].framesLeft <= 0) {
        this.activeCues.splice(i, 1);
      }
    }
    this.drawAttackCues();
    this.hitEffects.update();
  }
}
