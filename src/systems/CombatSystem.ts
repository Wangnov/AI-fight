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
import type { MoveSetId } from '../config/moveSets';

export interface EffectsAdapter {
  shake(amplitude: number, duration: number): void;
  flashScreen(): void;
}

export interface CombatEvent {
  attackerId: 'P1' | 'P2';
  attackerMoveSetId: MoveSetId;
  targetId: 'P1' | 'P2';
  kind: 'jab' | 'combo1' | 'combo2' | 'ultimate';
  blocked: boolean;
  damage: number;
  hitPoint: { x: number; y: number };
}

function intersects(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function intersectionCenter(a: AABB, b: AABB): { x: number; y: number } {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  };
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
    const hitPoint = intersectionCenter(active.box, hurt);

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
    if (!isUltimate) {
      attacker.nudgeOnHit(dir, active.attack.kind === 'jab' ? 5 : 9);
    }

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
      attackerMoveSetId: attacker.preset.moveSetId,
      targetId: target.id,
      kind: active.attack.kind,
      blocked: result.blocked,
      damage: result.dealt,
      hitPoint,
    });
  }

  private checkProjectiles(): void {
    const list = this.getProjectiles();
    for (const p of list) {
      if (!p.alive) continue;
      for (const f of this.fighters) {
        if (f.id === p.ownerId) continue;
        if (!f.isAlive()) continue;
        const projectileBox = p.getHitbox();
        const hurt = f.getHurtbox();
        if (!intersects(projectileBox, hurt)) continue;
        const hitPoint = intersectionCenter(projectileBox, hurt);
        const owner = this.fighters.find((x) => x.id === p.ownerId);

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
          if (owner) owner.addEnergy(p.energyGain);
        }
        f.hitstopFrames = Math.max(f.hitstopFrames, p.hitstopFrames);
        this.effects.shake(SHAKE_AMPLITUDE_HEAVY, SHAKE_DURATION_FRAMES);

        this.events.push({
          attackerId: p.ownerId,
          attackerMoveSetId: owner?.preset.moveSetId ?? 'altman',
          targetId: f.id,
          kind: 'combo1',
          blocked: result.blocked,
          damage: result.dealt,
          hitPoint,
        });
        p.alive = false;
        break;
      }
    }
  }
}
