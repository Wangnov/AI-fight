import { InputManager } from './InputManager';
import type { KeyMap } from '../config/constants';

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jab'
  | 'combo1'
  | 'combo2'
  | 'ultimate'
  | 'block';

/**
 * Fighter 通过 InputProvider 拿输入，对人类和 AI 透明。
 */
export interface InputProvider {
  isHeld(action: Action): boolean;
  wasPressed(action: Action): boolean;
}

/** 人类玩家：把抽象 Action 映射到键码 */
export class HumanInputProvider implements InputProvider {
  constructor(private readonly input: InputManager, private readonly keys: KeyMap) {}

  isHeld(action: Action): boolean {
    return this.input.isHeld(this.keys[action]);
  }

  wasPressed(action: Action): boolean {
    return this.input.wasPressed(this.keys[action]);
  }
}

/** AI 输入：由 AIController 写入，由 Fighter 读取 */
export class VirtualInputProvider implements InputProvider {
  private readonly heldSet = new Set<Action>();
  private readonly pressedSet = new Set<Action>();

  hold(action: Action): void {
    if (!this.heldSet.has(action)) {
      this.pressedSet.add(action);
    }
    this.heldSet.add(action);
  }

  release(action: Action): void {
    this.heldSet.delete(action);
  }

  press(action: Action): void {
    this.pressedSet.add(action);
  }

  endFrame(): void {
    this.pressedSet.clear();
  }

  releaseAll(): void {
    this.heldSet.clear();
    this.pressedSet.clear();
  }

  isHeld(action: Action): boolean {
    return this.heldSet.has(action);
  }

  wasPressed(action: Action): boolean {
    return this.pressedSet.has(action);
  }
}
