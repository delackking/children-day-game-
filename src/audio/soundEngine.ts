import { DEFAULT_DJ_PLAYLIST } from '../shared/catalog';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterVolume = 0.65;
  private djInterval: number | null = null;
  private djStep = 0;
  private lastFireworksClipAt = 0;
  private activeAudioEls = new Set<HTMLAudioElement>();

  private playAudioClip(src: string, volumeScale = 1): boolean {
    if (this.muted || typeof Audio === 'undefined') return false;
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * volumeScale));
      this.activeAudioEls.add(audio);
      const cleanup = () => this.activeAudioEls.delete(audio);
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });
      audio.play().catch(() => cleanup());
      return true;
    } catch {
      return false;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopDjSynth();
      for (const a of this.activeAudioEls) {
        a.pause();
      }
      this.activeAudioEls.clear();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(vol01: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol01));
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.15,
    slideToFreq?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideToFreq), now + duration);
    }
    const level = Math.max(0.001, gainVal * this.masterVolume);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playClick(): void {
    this.playTone(540, 0.06, 'triangle', 0.1, 720);
  }

  playJump(): void {
    this.playTone(220, 0.16, 'sine', 0.14, 480);
  }

  playFootstep(running = false): void {
    const pitch = (running ? 130 : 105) * (0.92 + Math.random() * 0.16);
    this.playTone(pitch, 0.05, 'triangle', 0.05, 65);
  }

  playCoin(): void {
    this.playTone(880, 0.08, 'sine', 0.14);
    setTimeout(() => this.playTone(1318, 0.16, 'sine', 0.14), 70);
  }

  playEatBite(): void {
    const pitch = 280 * (0.9 + Math.random() * 0.2);
    this.playTone(pitch, 0.08, 'square', 0.07, 140);
    setTimeout(() => this.playTone(340, 0.06, 'triangle', 0.07, 190), 50);
  }

  playDrinkSip(): void {
    this.playTone(420, 0.14, 'sine', 0.1, 660);
  }

  playKick(): void {
    this.playTone(160, 0.14, 'sine', 0.22, 52);
  }

  playGoalCheer(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.22, 'triangle', 0.16), i * 80);
    });
  }

  private noiseBuffer: AudioBuffer | null = null;

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  private playNoiseBurst(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    gainVal: number,
    endFreq?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.ensureNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    if (endFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    const gain = ctx.createGain();
    const level = Math.max(0.001, gainVal * this.masterVolume);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  playSutliBomb(): void {
    const played = this.playAudioClip('/assets/aistudio/Sutli_Bomb_Sound_aa44674d.mp3', 1.0);
    setTimeout(() => {
      if (this.muted) return;
      this.playTone(75, 0.45, 'sine', 0.34, 28);
      if (!played) {
        this.playNoiseBurst(0.55, 700, 'lowpass', 0.45, 110);
      }
    }, 900);
  }

  playFireworksShow(): void {
    const now = Date.now();
    if (now - this.lastFireworksClipAt < 1800) return;
    this.lastFireworksClipAt = now;
    this.playAudioClip('/assets/aistudio/dragon-studio-fireworks-07-419025_f76b2787.mp3', 0.95);
  }

  playFirework(): void {
    this.playFireworksShow();
    // Deep aerial boom + sparkling scatter crackles
    this.playTone(135, 0.42, 'sine', 0.24, 34);
    this.playNoiseBurst(0.45, 900, 'lowpass', 0.26, 180);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.playNoiseBurst(0.06, 2600 + Math.random() * 2400, 'bandpass', 0.12);
      }, 90 + i * 55);
    }
  }

  playTrampolineBoing(combo = 1): void {
    const base = Math.min(420, 150 + combo * 35);
    this.playTone(base, 0.26, 'sine', 0.18, base * 2.3);
    setTimeout(() => this.playTone(base * 1.5, 0.14, 'triangle', 0.08, base * 2.1), 50);
  }

  playSkyshotLaunch(): void {
    this.playFireworksShow();
    this.playTone(220, 0.72, 'sawtooth', 0.1, 1550);
    this.playNoiseBurst(0.68, 550, 'bandpass', 0.14, 2800);
  }

  playCrackerPop(): void {
    // Sharp firecracker snap + echoing mini crackles
    this.playNoiseBurst(0.055, 2200 + Math.random() * 1400, 'bandpass', 0.34, 600);
    this.playTone(190 + Math.random() * 90, 0.05, 'square', 0.14, 55);
    setTimeout(() => {
      this.playNoiseBurst(0.04, 3000 + Math.random() * 1400, 'highpass', 0.22);
    }, 38 + Math.random() * 40);
  }

  playFountainSparkle(): void {
    this.playNoiseBurst(0.14, 3400, 'highpass', 0.07);
    const f = 920 + Math.random() * 680;
    this.playTone(f, 0.08, 'sine', 0.05, f * 1.25);
  }

  playPop(): void {
    this.playTone(460, 0.06, 'sine', 0.18, 980);
    this.playNoiseBurst(0.03, 2800, 'highpass', 0.12);
  }

  playBellRing(): void {
    [1046.5, 1318.5, 1568, 2093].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.35, 'triangle', 0.18), idx * 35);
    });
  }

  playSplash(): void {
    this.playNoiseBurst(0.32, 1400, 'bandpass', 0.24, 320);
    this.playTone(280, 0.18, 'sine', 0.14, 110);
  }

  playPotBreak(): void {
    this.playNoiseBurst(0.16, 1800, 'bandpass', 0.28, 420);
    this.playTone(340, 0.11, 'triangle', 0.16, 95);
  }

  playArcadeWin(): void {
    [523, 587, 659, 784, 1046].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.14, 'triangle', 0.14), idx * 75);
    });
  }

  startDjSynth(trackId: string, volumePct: number): void {
    this.stopDjSynth();
    if (this.muted) return;
    const track = DEFAULT_DJ_PLAYLIST.find((t) => t.id === trackId) || DEFAULT_DJ_PLAYLIST[0];
    const stepMs = Math.round((60 / track.bpm / 2) * 1000);
    const scale = [1, 1.125, 1.25, 1.5, 1.667, 2];

    this.djInterval = window.setInterval(() => {
      if (this.muted) return;
      const vol = (volumePct / 100) * 0.09;
      if (vol <= 0.002) return;
      // Kick/dhol beat on even steps
      if (this.djStep % 2 === 0) {
        this.playTone(this.djStep % 4 === 0 ? 110 : 140, 0.14, 'sine', vol * 1.4, 55);
      }
      // Festive melody arpeggio
      const noteMult = scale[(this.djStep * 3 + (this.djStep % 4)) % scale.length];
      this.playTone(track.keyHz * noteMult, 0.16, 'triangle', vol * 0.8);
      this.djStep++;
    }, stepMs);
  }

  stopDjSynth(): void {
    if (this.djInterval !== null) {
      clearInterval(this.djInterval);
      this.djInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();
