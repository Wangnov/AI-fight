import { MAX_ENERGY } from '../config/constants';
import { Fighter } from '../entities/Fighter';
import { Projectile } from '../entities/Projectile';
import { VirtualInputProvider } from '../input/InputProvider';

type AIState = 'approach' | 'retreat' | 'wait';

/**
 * Phase 1 占位 AI：决策周期 + 基础规则。
 * - 能量满优先放大招
 * - 投射物逼近时尝试防御
 * - 近距离随机普攻 / combo2，中距离偶尔丢投射物
 * - 决策每 30~60 帧刷新一次，避免抽搐
 */
export class AIController {
  private state: AIState = 'approach';
  private stateTimer = 0;
  private nextAttackTimer = 30;

  constructor(
    private readonly self: Fighter,
    private readonly opponent: Fighter,
    private readonly input: VirtualInputProvider
  ) {}

  update(projectiles: Projectile[]): void {
    this.input.releaseAll();

    if (!this.self.isAlive() || !this.opponent.isAlive()) return;

    const dx = this.opponent.x - this.self.x;
    const dist = Math.abs(dx);
    const facingRight = dx > 0;

    // === 优先级 1：能量满，立刻大招 ===
    if (this.self.energy >= MAX_ENERGY) {
      this.input.press('ultimate');
      return;
    }

    // === 优先级 2：附近有敌方投射物，试格挡 ===
    const incoming = projectiles.find(
      (p) =>
        p.alive &&
        p.ownerId !== this.self.id &&
        Math.abs(p.x - this.self.x) < 240 &&
        Math.sign(p.vx) === Math.sign(this.self.x - p.x)
    );
    if (incoming) {
      this.input.hold('block');
      return;
    }

    // === 优先级 3：常规决策 ===
    this.stateTimer -= 1;
    if (this.stateTimer <= 0) {
      this.pickState(dist);
    }

    this.nextAttackTimer -= 1;

    if (this.state === 'approach') {
      this.input.hold(facingRight ? 'right' : 'left');
    } else if (this.state === 'retreat') {
      this.input.hold(facingRight ? 'left' : 'right');
    }

    // 主动出招（受 nextAttackTimer 限速）
    if (this.nextAttackTimer <= 0) {
      if (dist < 160) {
        const r = Math.random();
        if (r < 0.55) this.input.press('jab');
        else if (r < 0.8) this.input.press('combo2');
        this.nextAttackTimer = 24 + Math.floor(Math.random() * 30);
      } else if (dist > 250 && dist < 700) {
        if (Math.random() < 0.6) {
          this.input.press('combo1');
        }
        this.nextAttackTimer = 60 + Math.floor(Math.random() * 60);
      } else {
        this.nextAttackTimer = 12;
      }
    }
  }

  private pickState(dist: number): void {
    this.stateTimer = 30 + Math.floor(Math.random() * 40);
    if (dist > 500) {
      this.state = 'approach';
      return;
    }
    if (dist < 120) {
      // 太近偶尔后退拉开拳脚距离
      this.state = Math.random() < 0.4 ? 'retreat' : 'wait';
      return;
    }
    const r = Math.random();
    if (r < 0.6) this.state = 'approach';
    else if (r < 0.85) this.state = 'wait';
    else this.state = 'retreat';
  }
}
