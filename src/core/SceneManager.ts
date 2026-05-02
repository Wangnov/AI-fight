import { Container } from 'pixi.js';
import { Scene } from './Scene';

export class SceneManager {
  private current: Scene | null = null;

  constructor(private readonly root: Container) {}

  switchTo(scene: Scene): void {
    if (this.current) {
      this.current.onUnmount();
      this.root.removeChild(this.current);
      this.current.destroy({ children: true });
    }
    this.current = scene;
    this.root.addChild(scene);
  }

  update(deltaMS: number): void {
    this.current?.update(deltaMS);
  }
}
