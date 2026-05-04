import { Container } from 'pixi.js';
import type { SpriteSet } from '../assets/SpriteSet';
import type { CombatEvent } from './CombatSystem';
import { HitEffectsLayer } from './HitEffectsLayer';

export class CombatFeedbackLayer extends Container {
  private readonly hitEffects: HitEffectsLayer;

  constructor(vfx: SpriteSet) {
    super();
    this.hitEffects = new HitEffectsLayer(vfx);
    this.addChild(this.hitEffects);
  }

  showActiveAttacks(_fighters: readonly unknown[]): void {}

  ingest(events: readonly CombatEvent[]): void {
    this.hitEffects.ingest(events);
  }

  update(): void {
    this.hitEffects.update();
  }
}
