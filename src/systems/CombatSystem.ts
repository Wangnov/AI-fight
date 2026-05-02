import { Fighter } from '../entities/Fighter';
import { Projectile } from '../entities/Projectile';
import {
  HITSTOP_FRAMES_HEAVY,
  HITSTOP_FRAMES_LIGHT,
  HITSTOP_FRAMES_ULTIMATE,
  SHAKE_AMPLITUDE_HEAVY,
  SHAKE_AMPLITUDE_LIGHT,
  SHAKE_AMPLITUDE_ULTIMATE,
  SHAKE_DURATION_FRAMES,
} from '../config/constants';
import type { AABB } from '../types';

export interface EffectsAdapter {
  shake(amplitude: number, duration: number): void;
  flashScreen(): void;
}

export interface CombatEvent {
  attackerId: 'P1' | 'P2';
  targetId: 'P1' | 'P2';
  kind: 'jab' | 'combo1' | 'combo2' | 'ultimate';
  blocked: boolean;
  damage: number;
}

function intersects(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * 命中判定 + 伤害结算 + 击退 + HitStop。
 * 视觉级反馈（屏幕震动、闪白）通过 EffectsAdapter 注入。
 */
export class CombatSystem {
  readonly events: CombatEvent[] = [];

  constructor(
    private readonly fighters: readonly [Fighter, Fighter],
    private readonly getProjectiles: () => Projectile[],
    private readonly effects: EffectsAdapter
  ) {}

  step(): void {
    this.events.length = 0;
    this.checkMelee(this.fighters[0], this.fighters[1]);
    this.checkMelee(this.fighters[1], this.fighters[0]);
    this.checkProjectiles();
  }

  private checkMelee(attacker: Fighter, target: Fighter): void {
    if (!target.isAlive()) return;
    const active = attacker.getActiveAttackHitbox();
    if (!active) return;
    if (active.attack.hitTargets.has(target.id)) return;

    const hurt = target.getHurtbox();
    if (!intersects(active.box, hurt)) return;

    active.attack.hitTargets.add(target.id);

    const dir: 1 | -1 = attacker.x < target.x ? 1 : -1;
    const isUltimate = active.attack.kind === 'ultimate';
    const hitstop =
      active.attack.kind === 'jab'
        ? HITSTOP_FRAMES_LIGHT
        : isUltimate
          ? HITSTOP_FRAMES_ULTIMATE
          : HITSTOP_FRAMES_HEAVY;

    const hitstun =
      active.attack.kind === 'jab' ? 12 : isUltimate ? 60 : 24;

    const result = target.takeHit({
      damage: active.attack.data.damage,
      knockback: active.attack.data.knockback,
      hitstopFrames: hitstop,
      hitstunFrames: hitstun,
      fromDirection: dir,
      energyOnHit: active.attack.data.energyGain,
      isUltimate,
    });

    if (!result.blocked) {
      attacker.addEnergy(active.attack.data.energyGain);
    }
    attacker.hitstopFrames = Math.max(attacker.hitstopFrames, hitstop);

    // 视觉反馈
    if (isUltimate) {
      this.effects.shake(SHAKE_AMPLITUDE_ULTIMATE, SHAKE_DURATION_FRAMES * 2);
      this.effects.flashScreen();
    } else if (active.attack.kind === 'combo2') {
      this.effects.shake(SHAKE_AMPLITUDE_HEAVY, SHAKE_DURATION_FRAMES);
    } else {
      this.effects.shake(SHAKE_AMPLITUDE_LIGHT, SHAKE_DURATION_FRAMES);
    }

    this.events.push({
      attackerId: attacker.id,
      targetId: target.id,
      kind: active.attack.kind,
      blocked: result.blocked,
      damage: result.dealt,
    });
  }

  private checkProjectiles(): void {
    const list = this.getProjectiles();
    for (const p of list) {
      if (!p.alive) continue;
      for (const f of this.fighters) {
        if (f.id === p.ownerId) continue;
        if (!f.isAlive()) continue;
        if (!intersects(p.getHitbox(), f.getHurtbox())) continue;

        const dir: 1 | -1 = p.vx >= 0 ? 1 : -1;
        const result = f.takeHit({
          damage: p.damage,
          knockback: p.knockback,
          hitstopFrames: p.hitstopFrames,
          hitstunFrames: 24,
          fromDirection: dir,
          energyOnHit: p.energyGain,
        });
        if (!result.blocked) {
          const owner = this.fighters.find((x) => x.id === p.ownerId);
          if (owner) owner.addEnergy(p.energyGain);
        }
        f.hitstopFrames = Math.max(f.hitstopFrames, p.hitstopFrames);
        this.effects.shake(SHAKE_AMPLITUDE_HEAVY, SHAKE_DURATION_FRAMES);

        this.events.push({
          attackerId: p.ownerId,
          targetId: f.id,
          kind: 'combo1',
          blocked: result.blocked,
          damage: result.dealt,
        });
        p.alive = false;
        break;
      }
    }
  }
}
