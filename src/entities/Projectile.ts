import { Container, Graphics } from 'pixi.js';
import type { ProjectileData } from '../config/constants';
import { STAGE_WIDTH } from '../config/constants';
import type { AABB, FighterId } from '../types';

export class Projectile extends Container {
  alive = true;
  vx: number;
  framesLeft: number;
  readonly damage: number;
  readonly knockback: number;
  readonly hitstopFrames: number;
  readonly energyGain: number;
  readonly width_: number;
  readonly height_: number;
  readonly ownerId: FighterId;

  constructor(
    x: number,
    y: number,
    direction: 1 | -1,
    color: number,
    data: ProjectileData,
    ownerId: FighterId
  ) {
    super();
    this.x = x;
    this.y = y;
    this.vx = data.speed * direction;
    this.framesLeft = data.lifetimeFrames;
    this.damage = data.damage;
    this.knockback = data.knockback;
    this.hitstopFrames = data.hitstopFrames;
    this.energyGain = data.energyGain;
    this.width_ = data.width;
    this.height_ = data.height;
    this.ownerId = ownerId;

    const g = new Graphics();
    g.rect(-data.width / 2, -data.height / 2, data.width, data.height).fill(color);
    g.rect(-data.width / 2, -data.height / 2, data.width, data.height).stroke({
      color: 0xffffff,
      width: 2,
    });
    this.addChild(g);
  }

  /** 推进一帧。frozen=true 时（HitStop）冻结物理 */
  update(frozen: boolean): void {
    if (!this.alive) return;
    if (frozen) return;
    this.x += this.vx;
    this.framesLeft -= 1;
    if (this.framesLeft <= 0 || this.x < -100 || this.x > STAGE_WIDTH + 100) {
      this.alive = false;
    }
  }

  getHitbox(): AABB {
    return {
      x: this.x - this.width_ / 2,
      y: this.y - this.height_ / 2,
      w: this.width_,
      h: this.height_,
    };
  }
}
