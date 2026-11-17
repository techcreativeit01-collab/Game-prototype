import { SettingsData, WeaponId, ZombieType } from '../types/game';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceStarted = false;
  private ambienceNodes: AudioNode[] = [];
  private windInterval: number | null = null;
  private reloadTimers: number[] = [];
  private settings: SettingsData;
  private rainActive = false;

  constructor(settings: SettingsData) {
    this.settings = { ...settings };
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;

      this.musicGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.rainGain = this.ctx.createGain();
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.28;

      this.createNoiseBuffer();
      this.createForestReverb();

      this.musicGain.connect(this.compressor);
      this.ambientGain.connect(this.compressor);
      this.rainGain.connect(this.ambientGain);
      this.sfxGain.connect(this.compressor);
      if (this.reverbNode) {
        this.reverbSend.connect(this.reverbNode);
        this.reverbNode.connect(this.compressor);
      }
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.06 * white) / 1.06;
      lastOut = data[i];
      data[i] *= 2.4;
    }
    this.noiseBuffer = buffer;
  }

  private createForestReverb(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const duration = 1.45;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // Early tree-trunk scatter + smooth night forest tail
        const earlyBoost = t < 0.09 ? 1.35 : 1.0;
        const env = Math.exp(-t * 3.1) * earlyBoost;
        data[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
    }
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;
  }

  updateSettings(settings: SettingsData): void {
    this.settings = { ...settings };
    this.rainActive = settings.rainEnabled;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.03);
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(this.settings.ambientVolume, now, 0.04);
    }
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(this.rainActive ? 0.22 : 0.0, now, 0.25);
    }
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && !this.ambienceStarted) {
      this.rainActive = this.settings.rainEnabled;
      this.startAmbience();
    }
  }

  private startAmbience(): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer || this.ambienceStarted) return;
    this.ambienceStarted = true;

    // 1. Subterranean survival horror tension pad
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const droneGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 44;
    osc2.type = 'triangle';
    osc2.frequency.value = 65.8;

    filter.type = 'lowpass';
    filter.frequency.value = 125;
    droneGain.gain.value = 0.075;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.musicGain);

    osc1.start();
    osc2.start();
    this.ambienceNodes.push(osc1, osc2, filter, droneGain);

    // 2. Pine canopy wind bed
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 1.4;

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.14;

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain ?? this.musicGain);
    windSrc.start();
    this.ambienceNodes.push(windSrc, windFilter, windGain);

    // 2b. Optional rain ambience layer (gated by rainGain)
    if (this.rainGain) {
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;
      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 1100;
      rainSrc.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      rainSrc.start();
      this.ambienceNodes.push(rainSrc, rainFilter);
      this.rainGain.gain.value = this.rainActive ? 0.22 : 0.0;
    }

    // 3. Modulated wind gusts + distant horror wildlife / zombie echoes
    this.windInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const targetFreq = 240 + Math.random() * 340;
      windFilter.frequency.setTargetAtTime(targetFreq, t, 1.6);
      windGain.gain.setTargetAtTime(0.11 + Math.random() * 0.08, t, 1.8);
      if (Math.random() < 0.35) {
        this.playNightCricket();
      }
      if (Math.random() < 0.24) {
        this.playDistantGroan();
      }
    }, 3200);
  }

  private playNightCricket(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const now = ctx.currentTime;
    const baseFreq = 4150 + Math.random() * 350;
    for (let pulse = 0; pulse < 3; pulse++) {
      const start = now + pulse * 0.095;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.016, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.06);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(start);
      osc.stop(start + 0.065);
    }
  }

  private playDistantGroan(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.reverbSend) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const base = 70 + Math.random() * 32;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 0.7, now + 1.5);

    filter.type = 'bandpass';
    filter.frequency.value = 250;
    filter.Q.value = 3.2;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    gain.connect(this.reverbSend);

    osc.start(now);
    osc.stop(now + 1.7);
  }

  playUIClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.045);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playChatPing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1180, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playFlashlightClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [1400, 920].forEach((freq, idx) => {
      const t = now + idx * 0.022;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.02);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.024);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.026);
    });
  }

  playWeaponSwitch(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Holster fabric rustle
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.11, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    src.start(now, 0.2, 0.14);

    // Metallic safety click
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1120, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);
    oGain.gain.setValueAtTime(0.1, now + 0.07);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(oGain);
    oGain.connect(this.sfxGain);
    osc.start(now + 0.07);
    osc.stop(now + 0.12);
  }

  playPurchase(success: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.06);
      osc.frequency.setValueAtTime(783.99, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.14);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.17);
    }
  }

  playFootstep(sprinting: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Crunchy forest floor grit + boot heel thud
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (sprinting ? 480 : 340) + Math.random() * 110;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(sprinting ? 0.16 : 0.095, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 0.8, 0.1);

    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(sprinting ? 95 : 74, now);
    thud.frequency.exponentialRampToValueAtTime(34, now + 0.07);
    tGain.gain.setValueAtTime(sprinting ? 0.11 : 0.06, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thud.connect(tGain);
    tGain.connect(this.sfxGain);
    thud.start(now);
    thud.stop(now + 0.085);
  }

  playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(840, now + 0.11);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, 0.1, 0.13);
  }

  playLand(impactSpeed: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const intensity = Math.min(1.0, Math.max(0.35, impactSpeed / 14));

    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(105, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.14);
    tGain.gain.setValueAtTime(0.28 * intensity, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thud.connect(tGain);
    tGain.connect(this.sfxGain);
    thud.start(now);
    thud.stop(now + 0.16);

    const grit = ctx.createBufferSource();
    grit.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    const gGain = ctx.createGain();
    gGain.gain.setValueAtTime(0.18 * intensity, now);
    gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    grit.connect(filter);
    filter.connect(gGain);
    gGain.connect(this.sfxGain);
    grit.start(now, 0.3, 0.15);
  }

  playSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.42);
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, 0.05, 0.45);
  }

  playWeaponFire(weaponId: WeaponId, suppressed = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    if (weaponId === WeaponId.KATANA) {
      // Steel blade shimmer + sweeping air whoosh
      const ring = ctx.createOscillator();
      const rGain = ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(2850, now);
      ring.frequency.exponentialRampToValueAtTime(1450, now + 0.14);
      rGain.gain.setValueAtTime(0.08, now);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      ring.connect(rGain);
      rGain.connect(this.sfxGain);
      ring.start(now);
      ring.stop(now + 0.16);

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.18);
      filter.Q.value = 1.3;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.36, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now, 0, 0.21);
      return;
    }

    // Calibrated multi-layered ballistics signature per weapon
    let pitchStart = 185;
    let duration = 0.15;
    let noiseVol = 0.44;
    let filterFreq = 1850;
    let snapFreq = 2600;
    let boltDelay = 0.038;
    let reverbAmt = 0.35;

    switch (weaponId) {
      case WeaponId.M1911:
        pitchStart = 230;
        duration = 0.15;
        noiseVol = 0.4;
        filterFreq = 2100;
        snapFreq = 2900;
        boltDelay = 0.032;
        reverbAmt = 0.32;
        break;
      case WeaponId.UZI:
        pitchStart = 300;
        duration = 0.095;
        noiseVol = 0.3;
        filterFreq = 2500;
        snapFreq = 3400;
        boltDelay = 0.022;
        reverbAmt = 0.22;
        break;
      case WeaponId.BENELLI_M4:
        pitchStart = 115;
        duration = 0.31;
        noiseVol = 0.68;
        filterFreq = 1450;
        snapFreq = 2100;
        boltDelay = 0.065;
        reverbAmt = 0.55;
        break;
      case WeaponId.AK74:
        pitchStart = 175;
        duration = 0.16;
        noiseVol = 0.48;
        filterFreq = 1950;
        snapFreq = 2850;
        boltDelay = 0.034;
        reverbAmt = 0.4;
        break;
      case WeaponId.M4:
        pitchStart = 215;
        duration = 0.13;
        noiseVol = 0.42;
        filterFreq = 2350;
        snapFreq = 3200;
        boltDelay = 0.028;
        reverbAmt = 0.36;
        break;
      case WeaponId.M107:
        pitchStart = 88;
        duration = 0.48;
        noiseVol = 0.78;
        filterFreq = 1650;
        snapFreq = 2400;
        boltDelay = 0.08;
        reverbAmt = 0.72;
        break;
      case WeaponId.M249:
        pitchStart = 190;
        duration = 0.13;
        noiseVol = 0.44;
        filterFreq = 2200;
        snapFreq = 3000;
        boltDelay = 0.026;
        reverbAmt = 0.34;
        break;
      case WeaponId.M2:
        pitchStart = 96;
        duration = 0.25;
        noiseVol = 0.62;
        filterFreq = 1400;
        snapFreq = 2150;
        boltDelay = 0.05;
        reverbAmt = 0.58;
        break;
    }

    if (suppressed) {
      filterFreq *= 0.45;
      snapFreq *= 0.52;
      noiseVol *= 0.42;
      duration *= 0.65;
      reverbAmt *= 0.2;
    }

    // Layer 1: Supersonic muzzle crack (sharp bandpass transient)
    const crack = ctx.createBufferSource();
    crack.buffer = this.noiseBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(snapFreq, now);
    crackFilter.Q.value = 0.9;
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(noiseVol * 0.85, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    crack.connect(crackFilter);
    crackFilter.connect(cGain);
    cGain.connect(this.sfxGain);
    crack.start(now, Math.random() * 0.2, 0.055);

    // Layer 2: Propellant blast body + forest echo tail
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(190, now + duration);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(noiseVol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    if (this.reverbSend) {
      const rGain = ctx.createGain();
      rGain.gain.value = reverbAmt;
      nGain.connect(rGain);
      rGain.connect(this.reverbSend);
    }
    noise.start(now, Math.random() * 0.3, duration + 0.03);

    // Layer 3: Deep chamber punch
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitchStart, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + duration * 0.72);
    oGain.gain.setValueAtTime(noiseVol * 0.92, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.78);
    osc.connect(oGain);
    oGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration * 0.82);

    // Layer 4: Mechanical bolt cycle clack
    const bolt = ctx.createOscillator();
    const bGain = ctx.createGain();
    bolt.type = 'square';
    bolt.frequency.setValueAtTime(1850, now + boltDelay);
    bolt.frequency.exponentialRampToValueAtTime(640, now + boltDelay + 0.018);
    bGain.gain.setValueAtTime(0.065, now + boltDelay);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + boltDelay + 0.02);
    bolt.connect(bGain);
    bGain.connect(this.sfxGain);
    bolt.start(now + boltDelay);
    bolt.stop(now + boltDelay + 0.024);
  }

  playTurretFire(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.095);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    src.start(now, 0.4, 0.09);
  }

  playShellCasingBounce(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const base = 3600 + Math.random() * 650;
    [base, base * 1.44].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(idx === 0 ? 0.045 : 0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.048);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 0.052);
    });
  }

  playBulletImpact(surface: 'flesh' | 'wood' | 'stone', headshot = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    if (surface === 'flesh') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(headshot ? 320 : 140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.075);
      gain.gain.setValueAtTime(headshot ? 0.24 : 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.085);

      if (headshot) {
        // Crisp skull-crack snap
        const snap = ctx.createBufferSource();
        snap.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        const sGain = ctx.createGain();
        sGain.gain.setValueAtTime(0.24, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        snap.connect(filter);
        filter.connect(sGain);
        sGain.connect(this.sfxGain);
        snap.start(now, 0.1, 0.065);
      }
      return;
    }

    if (surface === 'stone') {
      // Ricochet zing
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200 + Math.random() * 500, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.11);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    // Wood splinter thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playReload(durationSec = 1.6): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.reloadTimers.forEach((id) => clearTimeout(id));
    this.reloadTimers = [];

    const now = ctx.currentTime;
    const stages: Array<{ delay: number; fStart: number; fEnd: number; type: OscillatorType; vol: number }> = [
      { delay: 0.02, fStart: 560, fEnd: 240, type: 'square', vol: 0.13 }, // Mag release
      { delay: Math.min(0.65, durationSec * 0.42), fStart: 220, fEnd: 110, type: 'triangle', vol: 0.18 }, // Mag seat thud
      { delay: Math.max(0.28, durationSec * 0.78), fStart: 920, fEnd: 460, type: 'square', vol: 0.14 }, // Bolt rack
    ];

    stages.forEach((st) => {
      const t = now + st.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = st.type;
      osc.frequency.setValueAtTime(st.fStart, t);
      osc.frequency.exponentialRampToValueAtTime(st.fEnd, t + 0.048);
      gain.gain.setValueAtTime(st.vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  playHit(headshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(headshot ? 1420 : 780, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 940 : 440, now + 0.05);
    gain.gain.setValueAtTime(headshot ? 0.22 : 0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.058);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.062);
  }

  playMeleeHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.24, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    src.start(now, 0.15, 0.09);
  }

  playZombieSound(type: ZombieType, distance: number, isDeath = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const atten = Math.max(0.08, Math.min(1.0, 1 - distance / 34));
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    let startF = 115;
    let endF = 65;
    let dur = 0.45;
    let filterF = 440;

    if (isDeath) {
      startF = type === ZombieType.FEMALE ? 240 : 125;
      endF = 38;
      dur = 0.52;
      filterF = 360;
    } else if (type === ZombieType.FEMALE) {
      startF = 340 + Math.random() * 80;
      endF = 180;
      dur = 0.42;
      filterF = 1100;
    } else if (type === ZombieType.TANK || type === ZombieType.BOSS) {
      startF = 68 + Math.random() * 14;
      endF = 36;
      dur = 0.68;
      filterF = 280;
    } else if (type === ZombieType.FAST) {
      startF = 180 + Math.random() * 45;
      endF = 115;
      dur = 0.3;
      filterF = 680;
    }

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + dur);

    filter.type = 'bandpass';
    filter.frequency.value = filterF;
    filter.Q.value = 2.4;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * atten, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    if (this.reverbSend) {
      gain.connect(this.reverbSend);
    }

    osc.start(now);
    osc.stop(now + dur + 0.04);
  }

  playZombieAttack(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.24);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  playPlayerHurt(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1150, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    if (this.reverbSend) {
      gain.connect(this.reverbSend);
    }
    src.start(now, 0, 1.0);

    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(105, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 0.65);
    sGain.gain.setValueAtTime(0.7, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sub.connect(sGain);
    sGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.72);
  }

  playWaveBanner(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    // Deep brass-like horror horn
    [82.41, 123.47].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.12, now + 0.45);
      filter.type = 'lowpass';
      filter.frequency.value = idx === 0 ? 320 : 540;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.22 : 0.14, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [220, 196, 164.81, 130.81].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);
      gain.gain.setValueAtTime(0.2, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.38);
    });
  }

  dispose(): void {
    if (this.windInterval !== null) {
      clearInterval(this.windInterval);
      this.windInterval = null;
    }
    this.reloadTimers.forEach((id) => clearTimeout(id));
    this.reloadTimers = [];
    this.ambienceNodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    });
    this.ambienceNodes = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
