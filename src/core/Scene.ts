import { Container } from 'pixi.js';

/**
 * 场景基类。继承 Container，子类负责自身的视觉与逻辑更新。
 */
export abstract class Scene extends Container {
  /** 由 SceneManager 每帧调用，单位 ms */
  abstract update(deltaMS: number): void;

  /** 切换前由 SceneManager 调用，做事件解绑等清理 */
  onUnmount(): void {
    /* 默认空实现 */
  }
}
