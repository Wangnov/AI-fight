/**
 * 全局键盘状态。把"按下"和"持有"分开，方便区分一次性触发与持续动作。
 */
export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly releasedThisFrame = new Set<string>();
  private attached = false;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (!this.held.has(e.code)) {
      this.pressedThisFrame.add(e.code);
    }
    this.held.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
    this.releasedThisFrame.add(e.code);
  };

  attach(): void {
    if (this.attached) return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.held.clear();
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.attached = false;
  }

  /** 必须在每个逻辑帧的末尾调用，清掉一次性事件 */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }

  isHeld(code: string): boolean {
    return this.held.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  wasReleased(code: string): boolean {
    return this.releasedThisFrame.has(code);
  }
}
