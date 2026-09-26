/**
 * Pure Line Room - Procedural Web Audio Engine
 * 100% Web Audio API procedural synthesis. ZERO external audio files or CDNs.
 *
 * Provides:
 * - Autoplay unlock on first user interaction
 * - Master limiter / compressor & procedural warm room reverb convolver
 * - Switch snap & lamp click
 * - Door swing creak & latch thud
 * - Drawer slide friction & soft bump
 * - Record player: vinyl needle drop + procedural crackle + warm Lo-Fi jazz electric piano (Dm9 -> G13 -> Cmaj9 -> A7#9)
 * - Resonant harmonic wind chimes (crystalline metallic FM bell synthesis)
 * - Analog wall clock escapement tick & tock
 * - Ceiling fan rotating air whoosh with dynamic speed modulation
 * - Ambient room tone: daytime gentle breeze / distant bird chirps vs nighttime tranquil crickets / soft sine drone
 * - Master volume & mute controls
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this.isMuted = false;
    this.masterVolume = 0.8;

    // Master nodes
    this.masterGain = null;
    this.limiter = null;
    this.reverbNode = null;
    this.reverbGain = null;

    // Continuous sound managers
    this._fanNode = null;
    this._fanSpeed = 0.0;
    this._isFanRunning = false;

    this._turntableCrackleNode = null;
    this._turntableCrackleGain = null;
    this._isTurntablePlaying = false;
    this._jazzLoopTimer = null;
    this._currentChordIndex = 0;
    this._activePianoVoices = [];

    this._ambientDayGain = null;
    this._ambientNightGain = null;
    this._isAmbientRunning = false;
    this._dayNightMode = 'day'; // 'day' | 'night'
    this._birdTimer = null;

    this._lastClockWasTock = false;

    // Lazy initialization & user interaction listeners
    this._initUserUnlockListeners();
  }

  /**
   * Set up listeners to unlock AudioContext on first user interaction.
   */
  _initUserUnlockListeners() {
    const unlockHandler = () => {
      this.unlock();
      if (this.isUnlocked) {
        window.removeEventListener('pointerdown', unlockHandler);
        window.removeEventListener('click', unlockHandler);
        window.removeEventListener('keydown', unlockHandler);
        window.removeEventListener('touchstart', unlockHandler);
      }
    };

    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('click', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });
  }

  /**
   * Unlock and resume AudioContext. Safe to call multiple times.
   */
  async unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[AudioManager] Web Audio API is not supported in this browser.');
        return false;
      }
      this.ctx = new AudioCtx();
      this._setupMasterChain();
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[AudioManager] Failed to resume AudioContext:', err);
      }
    }

    if (this.ctx.state === 'running') {
      this.isUnlocked = true;
      // Prime engine with tiny silent buffer
      try {
        const silentBuf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch (e) {
        // Ignored
      }
      return true;
    }

    return false;
  }

  /**
   * Ensure AudioContext is ready before triggering sound synthesis.
   */
  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this._setupMasterChain();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Build master limiter, master volume, and procedural reverb bus.
   */
  _setupMasterChain() {
    const ctx = this.ctx;

    // Master Dynamics Compressor (Limiter)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-2.0, ctx.currentTime);
    this.limiter.knee.setValueAtTime(4.0, ctx.currentTime);
    this.limiter.ratio.setValueAtTime(16.0, ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, ctx.currentTime);
    this.limiter.release.setValueAtTime(0.25, ctx.currentTime);
    this.limiter.connect(ctx.destination);

    // Master Gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : this.masterVolume, ctx.currentTime);
    this.masterGain.connect(this.limiter);

    // Procedural Room Reverb (synthetic impulse response)
    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = this._generateProceduralReverbBuffer(1.6, 2.8);

    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.35, ctx.currentTime);

    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  /**
   * Generate stereo impulse response for warm, natural interior acoustic space.
   */
  _generateProceduralReverbBuffer(duration = 1.6, decayRate = 2.8) {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let lFilter = 0;
    let rFilter = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-decayRate * t);
      // Gaussian noise with warm 1-pole lowpass filter
      const whiteL = (Math.random() * 2 - 1) * envelope;
      const whiteR = (Math.random() * 2 - 1) * envelope;
      lFilter = lFilter * 0.72 + whiteL * 0.28;
      rFilter = rFilter * 0.72 + whiteR * 0.28;

      left[i] = lFilter;
      right[i] = rFilter;
    }

    return impulse;
  }

  // =========================================================================
  // Master Controls
  // =========================================================================

  setMasterVolume(val) {
    this.masterVolume = Math.max(0.0, Math.min(1.0, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.linearRampToValueAtTime(this.masterVolume, this.ctx.currentTime + 0.05);
    }
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  setMute(state) {
    this.isMuted = !!state;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0.0 : this.masterVolume;
      this.masterGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.05);
    }
  }

  // =========================================================================
  // 1. Switch Snap (Light switch / Wall toggle)
  // =========================================================================
  playSwitchSnap(isOn = true, volume = 1.0) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gainVal = volume * 0.6;

    // Transient noise pulse (high-speed friction/click)
    const noiseLen = 0.012;
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseLen), ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.25));
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(isOn ? 5200 : 4400, now);
    noiseFilter.Q.setValueAtTime(4.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gainVal * 0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseLen);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSrc.start(now);

    // Mechanical toggle body snap (fast pitch drop)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';

    const startFreq = isOn ? 1650 : 1380;
    const endFreq = isOn ? 210 : 170;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.018);

    oscGain.gain.setValueAtTime(gainVal * 0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.025);

    // Secondary contact bounce (subtle microscopic toggle settlement)
    const bounceOsc = ctx.createOscillator();
    const bounceGain = ctx.createGain();
    bounceOsc.type = 'sine';
    bounceOsc.frequency.setValueAtTime(isOn ? 850 : 720, now + 0.007);
    bounceGain.gain.setValueAtTime(0.0, now);
    bounceGain.gain.setValueAtTime(gainVal * 0.25, now + 0.007);
    bounceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.019);

    bounceOsc.connect(bounceGain);
    bounceGain.connect(this.masterGain);
    bounceOsc.start(now + 0.007);
    bounceOsc.stop(now + 0.022);
  }

  // =========================================================================
  // 2. Lamp Click (Rotary / pull cord tactile mechanism)
  // =========================================================================
  playLampClick(volume = 1.0) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gainVal = volume * 0.55;

    // High transient ping (metallic latch)
    const transientOsc = ctx.createOscillator();
    const transientGain = ctx.createGain();
    transientOsc.type = 'sine';
    transientOsc.frequency.setValueAtTime(7400, now);
    transientOsc.frequency.exponentialRampToValueAtTime(2600, now + 0.008);

    transientGain.gain.setValueAtTime(gainVal * 0.9, now);
    transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);

    transientOsc.connect(transientGain);
    transientGain.connect(this.masterGain);
    transientOsc.start(now);
    transientOsc.stop(now + 0.012);

    // Metallic housing resonance
    const metalOsc = ctx.createOscillator();
    const metalGain = ctx.createGain();
    metalOsc.type = 'sine';
    metalOsc.frequency.setValueAtTime(3200, now);

    metalGain.gain.setValueAtTime(gainVal * 0.35, now);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    metalOsc.connect(metalGain);
    metalGain.connect(this.masterGain);
    metalGain.connect(this.reverbNode);
    metalOsc.start(now);
    metalOsc.stop(now + 0.045);

    // Deep housing knock
    const knockOsc = ctx.createOscillator();
    const knockGain = ctx.createGain();
    knockOsc.type = 'triangle';
    knockOsc.frequency.setValueAtTime(340, now);
    knockOsc.frequency.exponentialRampToValueAtTime(95, now + 0.025);

    knockGain.gain.setValueAtTime(gainVal * 0.5, now);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    knockOsc.connect(knockGain);
    knockGain.connect(this.masterGain);
    knockOsc.start(now);
    knockOsc.stop(now + 0.035);
  }

  // =========================================================================
  // 3. Door Swing Creak & Latch Thud
  // =========================================================================
  playDoorCreak(duration = 1.1, volume = 0.75) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = Math.max(0.4, duration);

    // Stick-slip friction oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(260, now + dur * 0.4);
    osc.frequency.exponentialRampToValueAtTime(95, now + dur);

    // Resonant bandpass filter with slight jitter
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.linearRampToValueAtTime(580, now + dur * 0.5);
    filter.frequency.exponentialRampToValueAtTime(280, now + dur);
    filter.Q.setValueAtTime(11.0, now);

    // Friction AM envelope (simulating micro-catches)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(24, now);
    lfo.frequency.linearRampToValueAtTime(14, now + dur);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.45, now);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.0001, now);
    mainGain.gain.linearRampToValueAtTime(volume * 0.4, now + dur * 0.2);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    lfo.connect(lfoGain.gain);
    osc.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(this.masterGain);
    mainGain.connect(this.reverbNode);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + dur + 0.05);
    osc.stop(now + dur + 0.05);
  }

  playDoorLatch(volume = 0.85) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gainVal = volume * 0.7;

    // Metallic bolt strike click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2200, now);
    clickOsc.frequency.exponentialRampToValueAtTime(450, now + 0.02);

    clickGain.gain.setValueAtTime(gainVal * 0.6, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickGain.connect(this.reverbNode);
    clickOsc.start(now);
    clickOsc.stop(now + 0.03);

    // Heavy wooden door frame thud
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(95, now);
    thudOsc.frequency.exponentialRampToValueAtTime(32, now + 0.09);

    thudGain.gain.setValueAtTime(gainVal * 0.9, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    thudOsc.connect(thudGain);
    thudGain.connect(this.masterGain);
    thudOsc.start(now);
    thudOsc.stop(now + 0.12);

    // Wood body knock
    const woodFilter = ctx.createBiquadFilter();
    woodFilter.type = 'bandpass';
    woodFilter.frequency.setValueAtTime(240, now);
    woodFilter.Q.setValueAtTime(3.0, now);

    const woodNoise = ctx.createBufferSource();
    const noiseLen = 0.04;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseLen), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    woodNoise.buffer = buf;

    const woodGain = ctx.createGain();
    woodGain.gain.setValueAtTime(gainVal * 0.5, now);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseLen);

    woodNoise.connect(woodFilter);
    woodFilter.connect(woodGain);
    woodGain.connect(this.masterGain);
    woodNoise.start(now);
  }

  // =========================================================================
  // 4. Drawer Slide Friction & Soft Bump
  // =========================================================================
  playDrawerSlide(duration = 0.65, volume = 0.65) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = Math.max(0.3, duration);

    // Friction noise buffer
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.9 + white * 0.1;
      data[i] = last;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Resonant bandpass for wooden grain
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(560, now);
    filter.frequency.linearRampToValueAtTime(640, now + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(480, now + dur);
    filter.Q.setValueAtTime(2.8, now);

    // Slide gain envelope (swell and taper)
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.45, now + dur * 0.25);
    gain.gain.linearRampToValueAtTime(volume * 0.35, now + dur * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
  }

  playDrawerBump(volume = 0.75) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gainVal = volume * 0.7;

    // Soft hollow wooden contact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.065);

    gain.gain.setValueAtTime(gainVal * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);

    // Muffled tap
    const tapOsc = ctx.createOscillator();
    const tapGain = ctx.createGain();
    tapOsc.type = 'triangle';
    tapOsc.frequency.setValueAtTime(260, now);
    tapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.03);

    tapGain.gain.setValueAtTime(gainVal * 0.35, now);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    tapOsc.connect(tapGain);
    tapGain.connect(this.masterGain);
    tapOsc.start(now);
    tapOsc.stop(now + 0.04);
  }

  // =========================================================================
  // 5. Turntable / Record Player (Needle Drop + Vinyl Crackle + Lo-Fi Jazz Electric Piano)
  // =========================================================================

  /**
   * Start record player: needle drop sound, vinyl crackle loop, and warm Lo-Fi jazz electric piano chords.
   */
  startTurntable(volume = 0.8) {
    if (this._isTurntablePlaying) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    this._isTurntablePlaying = true;
    this.playNeedleDrop(volume);

    // Start continuous vinyl crackle
    this._startVinylCrackle(volume * 0.35);

    // Start procedural Lo-Fi jazz piano chord progression
    this._currentChordIndex = 0;
    this._scheduleJazzChords();
  }

  /**
   * Stop record player: slow vinyl pitch stop, needle lift click, and silence.
   */
  stopTurntable() {
    if (!this._isTurntablePlaying) return;
    this._isTurntablePlaying = false;

    if (this._jazzLoopTimer) {
      clearTimeout(this._jazzLoopTimer);
      this._jazzLoopTimer = null;
    }

    // Stop active piano voices with vinyl brake pitch drop
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const voice of this._activePianoVoices) {
      try {
        if (voice.osc && voice.osc.frequency) {
          voice.osc.frequency.cancelScheduledValues(now);
          voice.osc.frequency.exponentialRampToValueAtTime(30, now + 0.55);
        }
        if (voice.gain) {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
        }
      } catch (e) {
        // Voice might already be ended
      }
    }
    this._activePianoVoices = [];

    // Fade out vinyl crackle
    if (this._turntableCrackleGain && this.ctx) {
      const now = this.ctx.currentTime;
      this._turntableCrackleGain.gain.cancelScheduledValues(now);
      this._turntableCrackleGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      setTimeout(() => {
        if (this._turntableCrackleNode) {
          try {
            this._turntableCrackleNode.stop();
            this._turntableCrackleNode.disconnect();
          } catch (e) {}
          this._turntableCrackleNode = null;
        }
      }, 550);
    }

    // Needle lift click
    this.playNeedleLift(0.6);
  }

  toggleTurntable() {
    if (this._isTurntablePlaying) {
      this.stopTurntable();
      return false;
    } else {
      this.startTurntable();
      return true;
    }
  }

  get isTurntablePlaying() {
    return this._isTurntablePlaying;
  }

  playNeedleDrop(volume = 0.8) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gainVal = volume * 0.7;

    // Needle touchdown rumble
    const bumpOsc = ctx.createOscillator();
    const bumpGain = ctx.createGain();
    bumpOsc.type = 'sine';
    bumpOsc.frequency.setValueAtTime(65, now);
    bumpOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    bumpGain.gain.setValueAtTime(gainVal * 0.7, now);
    bumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    bumpOsc.connect(bumpGain);
    bumpGain.connect(this.masterGain);
    bumpOsc.start(now);
    bumpOsc.stop(now + 0.1);

    // Needle friction scrape
    const scrapeLen = 0.06;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * scrapeLen), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
    }
    const scrapeSrc = ctx.createBufferSource();
    scrapeSrc.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3800, now);
    filter.Q.setValueAtTime(3.0, now);

    const scrapeGain = ctx.createGain();
    scrapeGain.gain.setValueAtTime(gainVal * 0.4, now);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + scrapeLen);

    scrapeSrc.connect(filter);
    filter.connect(scrapeGain);
    scrapeGain.connect(this.masterGain);
    scrapeSrc.start(now + 0.02);
  }

  playNeedleLift(volume = 0.6) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.015);

    gain.gain.setValueAtTime(volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.025);
  }

  _startVinylCrackle(volume = 0.25) {
    const ctx = this.ctx;
    if (!ctx) return;

    // Create 6-second procedural vinyl loop buffer
    const dur = 6.0;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * dur);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    let lPink = 0;
    let rPink = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // 33.3 RPM rotation modulation (period = 1.8s)
      const rot = 1.0 + 0.2 * Math.sin(2 * Math.PI * (t / 1.8018));

      // Continuous surface noise
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      lPink = lPink * 0.94 + wL * 0.06;
      rPink = rPink * 0.94 + wR * 0.06;

      let popL = 0;
      let popR = 0;
      // Sporadic Poisson dust crackles
      if (Math.random() < 0.0005) {
        const pAmp = (Math.random() * 0.4 + 0.1) * (Math.random() < 0.5 ? 1 : -1);
        popL = pAmp;
        popR = pAmp * (0.8 + Math.random() * 0.4);
      }

      left[i] = (lPink * 0.12 * rot) + popL;
      right[i] = (rPink * 0.12 * rot) + popR;
    }

    this._turntableCrackleNode = ctx.createBufferSource();
    this._turntableCrackleNode.buffer = buffer;
    this._turntableCrackleNode.loop = true;

    this._turntableCrackleGain = ctx.createGain();
    this._turntableCrackleGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this._turntableCrackleGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.8);

    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.setValueAtTime(120, ctx.currentTime);

    this._turntableCrackleNode.connect(crackleFilter);
    crackleFilter.connect(this._turntableCrackleGain);
    this._turntableCrackleGain.connect(this.masterGain);

    this._turntableCrackleNode.start(ctx.currentTime + 0.1);
  }

  /**
   * Procedural warm Lo-Fi jazz electric piano chord progression:
   * 1. Dm9   : D3, F3, A3, C4, E4
   * 2. G13   : G2, F3, B3, E4, A4
   * 3. Cmaj9 : C3, E3, G3, B3, D4
   * 4. A7#9  : A2, G3, C#4, F4, C5 (Altered dominant turnaround)
   */
  _scheduleJazzChords() {
    if (!this._isTurntablePlaying || !this.ctx) return;

    const chords = [
      // Dm9
      { name: 'Dm9', notes: [146.83, 174.61, 220.00, 261.63, 329.63] },
      // G13
      { name: 'G13', notes: [98.00, 174.61, 246.94, 329.63, 440.00] },
      // Cmaj9
      { name: 'Cmaj9', notes: [130.81, 164.81, 196.00, 246.94, 293.66] },
      // A7#9
      { name: 'A7#9', notes: [110.00, 196.00, 277.18, 349.23, 523.25] },
    ];

    const currentChord = chords[this._currentChordIndex];
    const chordDuration = 3.35; // seconds per chord (72 BPM lo-fi tempo)

    this._playRhodesChord(currentChord.notes, chordDuration);

    this._currentChordIndex = (this._currentChordIndex + 1) % chords.length;

    this._jazzLoopTimer = setTimeout(() => {
      this._scheduleJazzChords();
    }, chordDuration * 1000);
  }

  /**
   * Synthesize a warm Rhodes / Wurlitzer electric piano chord with FM tine bell attack,
   * subtle tremolo, stereo pan, and warm lowpass filter.
   */
  _playRhodesChord(notes, duration = 3.35) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;

    // Prune old voice references
    this._activePianoVoices = this._activePianoVoices.filter(v => v.endTime > now);

    notes.forEach((freq, idx) => {
      // Humanized slight arpeggiated strum delay
      const strumOffset = idx * 0.028 + (Math.random() * 0.008);
      const startTime = now + strumOffset;
      const noteDur = duration - strumOffset;

      // FM Operator: Carrier (warm sine)
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, startTime);

      // FM Operator: Modulator (bell/tine strike at non-integer harmonic)
      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq * 3.98, startTime);

      const modGain = ctx.createGain();
      // Decay tine index rapidly
      modGain.gain.setValueAtTime(freq * 1.5, startTime);
      modGain.gain.exponentialRampToValueAtTime(1.0, startTime + 0.28);

      modulator.connect(carrier.frequency);

      // Tremolo LFO (4.6 Hz subtle vibrato)
      const tremolo = ctx.createOscillator();
      tremolo.type = 'sine';
      tremolo.frequency.setValueAtTime(4.6, startTime);

      const tremoloDepth = ctx.createGain();
      tremoloDepth.gain.setValueAtTime(0.12, startTime);

      // Note Amplitude Envelope
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, startTime);
      // Soft touch attack
      noteGain.gain.linearRampToValueAtTime(0.24, startTime + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(0.11, startTime + 0.8);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDur);

      tremolo.connect(tremoloDepth.gain);

      // Warm vintage tone filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1450, startTime);
      filter.frequency.exponentialRampToValueAtTime(950, startTime + noteDur);

      // Stereo panning spread across the keyboard
      const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panNode) {
        const panPos = ((idx / (notes.length - 1)) - 0.5) * 0.6;
        panNode.pan.setValueAtTime(panPos, startTime);
      }

      // Connect graph
      carrier.connect(noteGain);
      noteGain.connect(filter);

      if (panNode) {
        filter.connect(panNode);
        panNode.connect(this.masterGain);
        panNode.connect(this.reverbNode);
      } else {
        filter.connect(this.masterGain);
        filter.connect(this.reverbNode);
      }

      modulator.start(startTime);
      carrier.start(startTime);
      tremolo.start(startTime);

      const stopTime = startTime + noteDur + 0.05;
      modulator.stop(stopTime);
      carrier.stop(stopTime);
      tremolo.stop(stopTime);

      this._activePianoVoices.push({
        osc: carrier,
        gain: noteGain,
        endTime: stopTime,
      });
    });
  }

  // =========================================================================
  // 6. Wind Chimes (Crystalline metallic pentatonic chimes with FM bell synthesis)
  // =========================================================================

  /**
   * Resonant pentatonic wind chimes in E Major / C# minor:
   * E5 (659Hz), G#5 (831Hz), B5 (988Hz), C#6 (1109Hz), E6 (1319Hz), F#6 (1480Hz).
   */
  playWindChime({ tubeIndex = null, intensity = 0.6, count = 2 } = {}) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const chimePitches = [659.25, 830.61, 987.77, 1108.73, 1318.51, 1479.98];
    const strikes = Math.min(4, Math.max(1, count));

    for (let i = 0; i < strikes; i++) {
      const idx = tubeIndex !== null ? (tubeIndex + i) % chimePitches.length : Math.floor(Math.random() * chimePitches.length);
      const freq = chimePitches[idx];
      const delay = i * (0.05 + Math.random() * 0.09);
      const vel = intensity * (0.7 + Math.random() * 0.3);

      this._synthesizeChimeTube(freq, ctx.currentTime + delay, vel);
    }
  }

  _synthesizeChimeTube(freq, startTime, intensity = 0.6) {
    const ctx = this.ctx;
    const gainVal = intensity * 0.45;
    const decayTime = 2.8 + Math.random() * 1.2;

    // Metallic Tubular Chime Mode 1 (Fundamental)
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, startTime);

    // Tubular Chime Mode 2 (First harmonic mode at ~2.756x)
    const mode2 = ctx.createOscillator();
    mode2.type = 'sine';
    mode2.frequency.setValueAtTime(freq * 2.756, startTime);

    // Mode 3 (High inharmonic shimmer at ~5.404x)
    const mode3 = ctx.createOscillator();
    mode3.type = 'sine';
    mode3.frequency.setValueAtTime(freq * 5.404, startTime);

    // Gains for modes
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(gainVal * 0.7, startTime);
    gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(gainVal * 0.35, startTime);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime * 0.65);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(gainVal * 0.15, startTime);
    gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime * 0.35);

    // Strike transient ping (high bandpass click)
    const pingOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    pingOsc.type = 'sine';
    pingOsc.frequency.setValueAtTime(freq * 4.2, startTime);
    pingGain.gain.setValueAtTime(gainVal * 0.5, startTime);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.012);

    carrier.connect(gain1);
    mode2.connect(gain2);
    mode3.connect(gain3);
    pingOsc.connect(pingGain);

    const chimeBus = ctx.createGain();
    chimeBus.gain.setValueAtTime(1.0, startTime);

    gain1.connect(chimeBus);
    gain2.connect(chimeBus);
    gain3.connect(chimeBus);
    pingGain.connect(chimeBus);

    // Deep reverb send for resonant harmonic bell ring
    chimeBus.connect(this.masterGain);
    chimeBus.connect(this.reverbNode);

    carrier.start(startTime);
    mode2.start(startTime);
    mode3.start(startTime);
    pingOsc.start(startTime);

    const stopTime = startTime + decayTime + 0.1;
    carrier.stop(stopTime);
    mode2.stop(stopTime);
    mode3.stop(stopTime);
    pingOsc.stop(stopTime);
  }

  // =========================================================================
  // 7. Wall Clock (Realistic escapement tick-tock)
  // =========================================================================

  /**
   * Play clock escapement sound. Alternates between tick and tock automatically if isTock is omitted.
   */
  playClockTick(isTock = null, volume = 0.7) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    if (isTock === null) {
      this._lastClockWasTock = !this._lastClockWasTock;
      isTock = this._lastClockWasTock;
    } else {
      this._lastClockWasTock = isTock;
    }

    const now = ctx.currentTime;
    const gainVal = volume * 0.5;

    // Escapement pallet strike frequency:
    // Tick is crisper and higher (1920Hz), Tock is deeper and woodier (1540Hz)
    const strikeFreq = isTock ? 1540 : 1920;
    const bodyFreq = isTock ? 380 : 440;
    const strikeDecay = isTock ? 0.011 : 0.009;

    // Pallet sharp mechanical impact
    const strikeOsc = ctx.createOscillator();
    const strikeGain = ctx.createGain();
    strikeOsc.type = 'triangle';
    strikeOsc.frequency.setValueAtTime(strikeFreq, now);
    strikeOsc.frequency.exponentialRampToValueAtTime(strikeFreq * 0.45, now + strikeDecay);

    strikeGain.gain.setValueAtTime(gainVal * 0.8, now);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + strikeDecay);

    strikeOsc.connect(strikeGain);
    strikeGain.connect(this.masterGain);
    strikeOsc.start(now);
    strikeOsc.stop(now + strikeDecay + 0.005);

    // Clock casing acoustic body resonance
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(bodyFreq, now);

    bodyGain.gain.setValueAtTime(gainVal * 0.4, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    bodyGain.connect(this.reverbNode);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.045);

    // Escape wheel tooth micro-click
    const toothOsc = ctx.createOscillator();
    const toothGain = ctx.createGain();
    toothOsc.type = 'sine';
    toothOsc.frequency.setValueAtTime(isTock ? 2800 : 3400, now);
    toothGain.gain.setValueAtTime(gainVal * 0.35, now);
    toothGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.004);

    toothOsc.connect(toothGain);
    toothGain.connect(this.masterGain);
    toothOsc.start(now);
    toothOsc.stop(now + 0.006);
  }

  // =========================================================================
  // 8. Ceiling Fan (Gentle rotating whoosh with speed modulation)
  // =========================================================================

  startFan(speed = 0.7) {
    if (this._isFanRunning) {
      this.setFanSpeed(speed);
      return;
    }
    const ctx = this._ensureContext();
    if (!ctx) return;

    this._isFanRunning = true;
    this._fanSpeed = speed;

    // Filtered pink noise source
    const bufSize = Math.floor(ctx.sampleRate * 2.0);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.98 * b0 + white * 0.08;
      b1 = 0.94 * b1 + white * 0.08;
      b2 = 0.86 * b2 + white * 0.08;
      d[i] = (b0 + b1 + b2) * 0.3;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;

    // Resonant bandpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    // LFO to modulate filter frequency at blade passage rate
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    const bladePassRate = Math.max(1.5, this._fanSpeed * 8.5);
    lfo.frequency.setValueAtTime(bladePassRate, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(140 * this._fanSpeed, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // Motor low-frequency hum (soft 60Hz hum)
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(60, ctx.currentTime);

    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0.018 * this._fanSpeed, ctx.currentTime);

    hum.connect(humGain);

    // Fan master gain
    const fanGain = ctx.createGain();
    const targetGain = Math.max(0.0, Math.min(1.0, this._fanSpeed)) * 0.38;
    fanGain.gain.setValueAtTime(0.001, ctx.currentTime);
    fanGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 1.2);

    noiseSrc.connect(filter);
    filter.connect(fanGain);
    humGain.connect(fanGain);
    fanGain.connect(this.masterGain);

    noiseSrc.start(ctx.currentTime);
    lfo.start(ctx.currentTime);
    hum.start(ctx.currentTime);

    this._fanNode = {
      noiseSrc,
      filter,
      lfo,
      lfoGain,
      hum,
      humGain,
      fanGain,
    };
  }

  setFanSpeed(speed) {
    this._fanSpeed = Math.max(0.0, Math.min(1.0, speed));
    if (!this._isFanRunning || !this._fanNode || !this.ctx) return;

    const now = this.ctx.currentTime;
    const targetGain = this._fanSpeed * 0.38;
    this._fanNode.fanGain.gain.linearRampToValueAtTime(targetGain, now + 0.3);

    const bladePassRate = Math.max(0.5, this._fanSpeed * 8.5);
    this._fanNode.lfo.frequency.linearRampToValueAtTime(bladePassRate, now + 0.3);
    this._fanNode.lfoGain.gain.linearRampToValueAtTime(140 * this._fanSpeed, now + 0.3);
    this._fanNode.humGain.gain.linearRampToValueAtTime(0.018 * this._fanSpeed, now + 0.3);
  }

  stopFan() {
    if (!this._isFanRunning || !this._fanNode) return;
    this._isFanRunning = false;
    const now = this.ctx ? this.ctx.currentTime : 0;

    if (this._fanNode.fanGain && this.ctx) {
      this._fanNode.fanGain.gain.cancelScheduledValues(now);
      this._fanNode.fanGain.gain.linearRampToValueAtTime(0.0001, now + 1.5);
    }

    const nodeRef = this._fanNode;
    this._fanNode = null;

    setTimeout(() => {
      try {
        nodeRef.noiseSrc.stop();
        nodeRef.lfo.stop();
        nodeRef.hum.stop();
        nodeRef.noiseSrc.disconnect();
        nodeRef.fanGain.disconnect();
      } catch (e) {}
    }, 1600);
  }

  toggleFan() {
    if (this._isFanRunning) {
      this.stopFan();
      return false;
    } else {
      this.startFan(0.7);
      return true;
    }
  }

  get isFanRunning() {
    return this._isFanRunning;
  }

  // =========================================================================
  // 9. Ambient Room Tone (Daytime breeze / birds vs Nighttime crickets / drone)
  // =========================================================================

  startAmbient(mode = 'day') {
    if (this._isAmbientRunning) {
      this.setDayNightMode(mode);
      return;
    }
    const ctx = this._ensureContext();
    if (!ctx) return;

    this._isAmbientRunning = true;
    this._dayNightMode = mode;

    // Day Breeze node
    this._startDayBreeze();
    // Night Ambience node
    this._startNightAmbience();

    this.setDayNightMode(mode);
    this._scheduleBirdChirps();
  }

  setDayNightMode(mode) {
    this._dayNightMode = mode === 'night' ? 'night' : 'day';
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isDay = this._dayNightMode === 'day';

    if (this._ambientDayGain) {
      this._ambientDayGain.gain.cancelScheduledValues(now);
      this._ambientDayGain.gain.linearRampToValueAtTime(isDay ? 0.32 : 0.0, now + 2.0);
    }
    if (this._ambientNightGain) {
      this._ambientNightGain.gain.cancelScheduledValues(now);
      this._ambientNightGain.gain.linearRampToValueAtTime(isDay ? 0.0 : 0.28, now + 2.0);
    }
  }

  get dayNightMode() {
    return this._dayNightMode;
  }

  _startDayBreeze() {
    const ctx = this.ctx;
    const bufSize = Math.floor(ctx.sampleRate * 3.0);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      d[i] = last;
    }

    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = buf;
    breezeSrc.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, ctx.currentTime);

    // Subtle breath LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(70, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this._ambientDayGain = ctx.createGain();
    this._ambientDayGain.gain.setValueAtTime(this._dayNightMode === 'day' ? 0.32 : 0.0, ctx.currentTime);

    breezeSrc.connect(filter);
    filter.connect(this._ambientDayGain);
    this._ambientDayGain.connect(this.masterGain);

    breezeSrc.start(ctx.currentTime);
    lfo.start(ctx.currentTime);
  }

  _startNightAmbience() {
    const ctx = this.ctx;

    // Tranquil Night Crickets
    const cricketBufSize = Math.floor(ctx.sampleRate * 2.5);
    const buf = ctx.createBuffer(1, cricketBufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < cricketBufSize; i++) {
      d[i] = Math.random() * 2 - 1;
    }

    const cricketSrc = ctx.createBufferSource();
    cricketSrc.buffer = buf;
    cricketSrc.loop = true;

    const cricketFilter = ctx.createBiquadFilter();
    cricketFilter.type = 'bandpass';
    cricketFilter.frequency.setValueAtTime(4750, ctx.currentTime);
    cricketFilter.Q.setValueAtTime(14.0, ctx.currentTime);

    // Rhythmic 16Hz chirp pulse train
    const chirpLFO = ctx.createOscillator();
    chirpLFO.type = 'square';
    chirpLFO.frequency.setValueAtTime(16.0, ctx.currentTime);

    const chirpLFOGain = ctx.createGain();
    chirpLFOGain.gain.setValueAtTime(0.08, ctx.currentTime);

    const cricketGain = ctx.createGain();
    cricketGain.gain.setValueAtTime(0.0, ctx.currentTime);

    chirpLFO.connect(chirpLFOGain);
    chirpLFOGain.connect(cricketGain.gain);

    cricketSrc.connect(cricketFilter);
    cricketFilter.connect(cricketGain);

    // Peaceful night drone (warm A1/E2 sine chord)
    const droneRoot = ctx.createOscillator();
    droneRoot.type = 'sine';
    droneRoot.frequency.setValueAtTime(55.0, ctx.currentTime); // A1

    const droneFifth = ctx.createOscillator();
    droneFifth.type = 'sine';
    droneFifth.frequency.setValueAtTime(82.41, ctx.currentTime); // E2

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(160, ctx.currentTime);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.12, ctx.currentTime);

    droneRoot.connect(droneFilter);
    droneFifth.connect(droneFilter);
    droneFilter.connect(droneGain);

    this._ambientNightGain = ctx.createGain();
    this._ambientNightGain.gain.setValueAtTime(this._dayNightMode === 'night' ? 0.28 : 0.0, ctx.currentTime);

    cricketGain.connect(this._ambientNightGain);
    droneGain.connect(this._ambientNightGain);
    this._ambientNightGain.connect(this.masterGain);
    this._ambientNightGain.connect(this.reverbNode);

    cricketSrc.start(ctx.currentTime);
    chirpLFO.start(ctx.currentTime);
    droneRoot.start(ctx.currentTime);
    droneFifth.start(ctx.currentTime);
  }

  _scheduleBirdChirps() {
    if (!this._isAmbientRunning) return;

    if (this._dayNightMode === 'day') {
      this._playBirdChirp();
    }

    const nextDelay = 12000 + Math.random() * 16000;
    this._birdTimer = setTimeout(() => {
      this._scheduleBirdChirps();
    }, nextDelay);
  }

  _playBirdChirp() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chirpCount = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < chirpCount; i++) {
      const startTime = now + i * 0.18 + Math.random() * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const baseFreq = 3100 + Math.random() * 600;
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, startTime + 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, startTime + 0.12);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.065, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);
      gain.connect(this.reverbNode);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }
  }

  stopAmbient() {
    this._isAmbientRunning = false;
    if (this._birdTimer) {
      clearTimeout(this._birdTimer);
      this._birdTimer = null;
    }
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this._ambientDayGain && this.ctx) {
      this._ambientDayGain.gain.cancelScheduledValues(now);
      this._ambientDayGain.gain.linearRampToValueAtTime(0.0, now + 0.8);
    }
    if (this._ambientNightGain && this.ctx) {
      this._ambientNightGain.gain.cancelScheduledValues(now);
      this._ambientNightGain.gain.linearRampToValueAtTime(0.0, now + 0.8);
    }
  }
}

// Export singleton instance as default / named export
export const audioManager = new AudioManager();
