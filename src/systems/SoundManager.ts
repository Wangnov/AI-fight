/**
 * 用 Web Audio API 合成街机风格音效（不依赖外部音频文件）。
 *
 * 触发事件：
 *   - 'jab'           普攻击中
 *   - 'heavy'         重击 / 投射命中
 *   - 'block'         防御
 *   - 'ko'            击杀
 *   - 'ultimate'      大招触发
 *   - 'beep'          倒计时滴答
 *   - 'fight'         FIGHT! 开战
 *   - 'select'        菜单选择
 *   - 'confirm'       确认
 *   - 'jump'          跳跃
 *   - 'land'          落地
 *
 * 音量统一受 setMasterVolume 控制。
 */
export type SoundEvent =
  | 'jab'
  | 'heavy'
  | 'block'
  | 'ko'
  | 'ultimate'
  | 'beep'
  | 'fight'
  | 'select'
  | 'confirm'
  | 'jump'
  | 'land';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVolume = 0.5;
  private muted = false;

  ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVolume;
  }
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.masterVolume;
  }
  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 短暂的 oscillator 包络 */
  private playOsc(type: OscillatorType, freq: number, dur: number, vol = 0.3, freqEnd?: number): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), ctx.currentTime + dur);
    }
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  /** 噪声脉冲（拳头打击感） */
  private playNoise(dur: number, vol = 0.3, lowpassHz = 3000): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!this.master) return;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHz;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  play(event: SoundEvent): void {
    if (this.muted) return;
    switch (event) {
      case 'jab':
        // 短促高频 + 噪声
        this.playOsc('square', 600, 0.06, 0.18, 200);
        this.playNoise(0.06, 0.15);
        break;
      case 'heavy':
        // 低频砸击 + 长一些噪声
        this.playOsc('sawtooth', 180, 0.18, 0.32, 60);
        this.playNoise(0.15, 0.25, 1200);
        break;
      case 'block':
        // 金属铛声
        this.playOsc('square', 1100, 0.08, 0.14);
        this.playOsc('sawtooth', 550, 0.05, 0.10);
        break;
      case 'ko':
        // 戏剧性下沉重音 + 长尾
        this.playOsc('sawtooth', 220, 0.6, 0.4, 40);
        this.playNoise(0.3, 0.2, 800);
        setTimeout(() => this.playOsc('sine', 110, 0.5, 0.3, 55), 100);
        break;
      case 'ultimate':
        // 上行号角 + 大噪声爆发
        this.playOsc('sawtooth', 200, 0.4, 0.3, 800);
        setTimeout(() => this.playOsc('square', 800, 0.3, 0.25, 1600), 200);
        setTimeout(() => this.playNoise(0.4, 0.18, 4000), 350);
        break;
      case 'beep':
        // 倒计时滴答（短促 piano）
        this.playOsc('square', 880, 0.08, 0.2);
        break;
      case 'fight':
        // FIGHT! 长 fanfare
        this.playOsc('square', 440, 0.1, 0.3);
        setTimeout(() => this.playOsc('square', 660, 0.1, 0.3), 100);
        setTimeout(() => this.playOsc('square', 880, 0.25, 0.32), 200);
        break;
      case 'select':
        // 菜单移动
        this.playOsc('square', 440, 0.04, 0.15);
        break;
      case 'confirm':
        // 菜单确认（上行二音）
        this.playOsc('square', 660, 0.06, 0.22);
        setTimeout(() => this.playOsc('square', 990, 0.10, 0.22), 60);
        break;
      case 'jump':
        // 跳跃 swoop up
        this.playOsc('sine', 220, 0.18, 0.18, 660);
        break;
      case 'land':
        this.playOsc('sine', 110, 0.1, 0.18, 70);
        this.playNoise(0.05, 0.1, 600);
        break;
    }
  }
}

// 单例
export const sfx = new SoundManager();
