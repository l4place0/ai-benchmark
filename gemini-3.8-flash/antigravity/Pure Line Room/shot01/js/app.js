/* Pure Line Room - Self-Contained Standalone Bundle (Zero CORS, 100% Offline file:// Compatible) */
(function() {
  "use strict";
  const THREE = window.THREE || globalThis.THREE;


/* --- Begin js/audio.js --- */
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
class AudioManager {
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
const audioManager = new AudioManager();

/* --- End js/audio.js --- */

/* --- Begin js/cameraController.js --- */
// Camera Controller with smooth spherical orbit, pan, zoom and preset focus transitions
// [Stripped import]
class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Target look-at point
    this.target = new THREE.Vector3(0, 1.6, 0);
    this.targetCurrent = this.target.clone();

    // Spherical coordinates (radius, phi [polar], theta [azimuthal])
    this.radius = 8.5;
    this.radiusTarget = 8.5;
    this.minRadius = 2.8;
    this.maxRadius = 14.0;

    this.theta = 0.75; // Horizontal angle
    this.thetaTarget = 0.75;

    this.phi = Math.PI / 4.2; // Vertical angle from Y+
    this.phiTarget = Math.PI / 4.2;
    this.minPhi = 0.15;
    this.maxPhi = Math.PI / 2 - 0.05; // Don't go below floor

    // Damping factor
    this.damping = 0.08;

    // Preset transitions
    this.isTransitioning = false;
    this.transitionDuration = 1.0;
    this.transitionTime = 0;
    this.startState = null;
    this.endState = null;

    // Mouse state
    this.isDragging = false;
    this.isRightDragging = false;
    this.prevMouse = { x: 0, y: 0 };
    this.dragThreshold = 4;
    this.totalDragDist = 0;

    this.initListeners();
    this.updateCameraImmediate();
  }

  initListeners() {
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.domElement.addEventListener('pointerdown', (e) => {
      this.isDragging = e.button === 0;
      this.isRightDragging = e.button === 2;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
      this.totalDragDist = 0;
      if (this.isTransitioning) {
        this.isTransitioning = false;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging && !this.isRightDragging) return;

      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
      this.totalDragDist += Math.hypot(dx, dy);

      if (this.isDragging) {
        // Orbit
        this.thetaTarget -= dx * 0.006;
        this.phiTarget -= dy * 0.006;
        this.phiTarget = Math.max(this.minPhi, Math.min(this.maxPhi, this.phiTarget));
      } else if (this.isRightDragging) {
        // Pan target along camera plane
        const forward = new THREE.Vector3().subVectors(this.camera.position, this.target).normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
        const up = new THREE.Vector3().crossVectors(forward, right).normalize();

        const panSpeed = 0.004 * this.radius;
        this.target.addScaledVector(right, -dx * panSpeed);
        this.target.addScaledVector(up, dy * panSpeed);

        // Limit target bounds so user stays near room
        this.target.x = Math.max(-3.5, Math.min(3.5, this.target.x));
        this.target.y = Math.max(0.2, Math.min(3.8, this.target.y));
        this.target.z = Math.max(-3.5, Math.min(3.5, this.target.z));
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
      this.isRightDragging = false;
    });

    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1 + Math.abs(e.deltaY) * 0.0012;
      if (e.deltaY > 0) {
        this.radiusTarget = Math.min(this.maxRadius, this.radiusTarget * zoomFactor);
      } else {
        this.radiusTarget = Math.max(this.minRadius, this.radiusTarget / zoomFactor);
      }
      this.isTransitioning = false;
    }, { passive: false });
  }

  // Smooth transition to camera preset
  moveToPreset(theta, phi, radius, target, duration = 1.2) {
    this.isTransitioning = true;
    this.transitionDuration = duration;
    this.transitionTime = 0;
    this.startState = {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      target: this.targetCurrent.clone()
    };
    this.endState = {
      theta: theta,
      phi: phi,
      radius: radius,
      target: target.clone()
    };
    this.thetaTarget = theta;
    this.phiTarget = phi;
    this.radiusTarget = radius;
    this.target.copy(target);
  }

  update(delta) {
    if (this.isTransitioning) {
      this.transitionTime += delta;
      const t = Math.min(1.0, this.transitionTime / this.transitionDuration);
      // Ease in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.theta = THREE.MathUtils.lerp(this.startState.theta, this.endState.theta, ease);
      this.phi = THREE.MathUtils.lerp(this.startState.phi, this.endState.phi, ease);
      this.radius = THREE.MathUtils.lerp(this.startState.radius, this.endState.radius, ease);
      this.targetCurrent.lerpVectors(this.startState.target, this.endState.target, ease);

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      // Normal smooth inertia damping
      this.theta += (this.thetaTarget - this.theta) * this.damping;
      this.phi += (this.phiTarget - this.phi) * this.damping;
      this.radius += (this.radiusTarget - this.radius) * this.damping;
      this.targetCurrent.lerp(this.target, this.damping);
    }

    this.updateCameraImmediate();
  }

  updateCameraImmediate() {
    const sinPhiRadius = this.radius * Math.sin(this.phi);
    this.camera.position.x = this.targetCurrent.x + sinPhiRadius * Math.sin(this.theta);
    this.camera.position.y = this.targetCurrent.y + this.radius * Math.cos(this.phi);
    this.camera.position.z = this.targetCurrent.z + sinPhiRadius * Math.cos(this.theta);
    this.camera.lookAt(this.targetCurrent);
  }

  hasDragged() {
    return this.totalDragDist > this.dragThreshold;
  }
}

/* --- End js/cameraController.js --- */

/* --- Begin js/dynamics.js --- */
/**
 * Pure Line Room - Continuous Environment Dynamics Engine
 *
 * Implements real-time visual dynamics:
 * 1. Real-time analog clock: accurate Date.now() tracking, smooth escapement spring snap, audio tick-tock sync.
 * 2. Coffee cup steam: procedural rising, curling vector lines using animated bezier curves drifting upwards and dissipating.
 * 3. Turntable dynamics: continuous vinyl rotation with inertia, tonearm tracking, rising floating musical note vector particles.
 * 4. Ceiling fan: continuous angular rotation with smooth acceleration/deceleration inertia.
 * 5. Wind chime: natural ambient pendulum sway with gentle random breeze perturbations and interactive impulse chime strikes.
 * 6. Floating sunbeam/moonlight dust motes: drifting fine vector particles in the light beam with turbulent convection.
 */
// [Stripped import]
class DynamicsManager {
  /**
   * @param {THREE.Scene} scene - The Three.js scene.
   * @param {Object} [audioManager] - Optional AudioManager instance for procedural audio sync.
   * @param {Object} [options] - Optional custom mesh bindings or configuration.
   */
  constructor(scene, audioManager = null, options = {}) {
    this.scene = scene;
    this.audio = audioManager;
    this.options = options;

    this.isDay = options.isDay !== undefined ? options.isDay : true;
    this.dayNightRatio = this.isDay ? 1.0 : 0.0;

    // Subsystem containers
    this.clock = null;
    this.steam = null;
    this.turntable = null;
    this.fan = null;
    this.windChime = null;
    this.dustMotes = null;

    // Root dynamics group in scene
    this.group = new THREE.Group();
    this.group.name = 'Dynamics_Root_Group';
    if (this.scene) {
      this.scene.add(this.group);
    }

    // Initialize all continuous dynamics systems
    this._initClock();
    this._initCoffeeSteam();
    this._initTurntable();
    this._initCeilingFan();
    this._initWindChime();
    this._initDustMotes();
  }

  // =========================================================================
  // 1. Real-Time Clock System
  // =========================================================================
  _initClock() {
    let hourHand = this.options.clockHourHand;
    let minHand = this.options.clockMinuteHand;
    let secHand = this.options.clockSecondHand;
    let clockGroup = this.options.clockGroup;

    // Search scene if not explicitly provided
    if (!hourHand || !minHand || !secHand) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (!hourHand && (name.includes('clock') || name.includes('hand')) && name.includes('hour')) {
          hourHand = child;
        }
        if (!minHand && (name.includes('clock') || name.includes('hand')) && (name.includes('min') || name.includes('minute'))) {
          minHand = child;
        }
        if (!secHand && (name.includes('clock') || name.includes('hand')) && (name.includes('sec') || name.includes('second'))) {
          secHand = child;
        }
        if (!clockGroup && name.includes('clock') && !name.includes('hand')) {
          clockGroup = child;
        }
      });
    }

    // If hands don't exist in scene, do not create duplicate ghost mesh
    this.clock = {
      group: clockGroup,
      hourHand,
      minHand,
      secHand,
      lastSecond: -1,
      tickStartTime: 0,
      axis: this.options.clockAxis || 'x', // hand rotation axis
    };
  }

  _updateClock(time) {
    if (!this.clock) return;

    const now = new Date();
    const ms = now.getMilliseconds();
    const sec = now.getSeconds();
    const min = now.getMinutes();
    const hour = now.getHours() % 12;

    // Detect second boundary tick
    if (sec !== this.clock.lastSecond) {
      this.clock.lastSecond = sec;
      this.clock.tickStartTime = time;
      if (this.audio) {
        this.audio.playClockTick();
      }
    }

    // Escapement mechanical spring snap bounce (120ms settlement)
    const tickDuration = 0.12;
    const elapsed = time - this.clock.tickStartTime;
    let smoothSec = sec;
    if (elapsed < tickDuration && elapsed >= 0) {
      const p = elapsed / tickDuration;
      // Damped harmonic bounce
      const bounce = Math.sin(p * Math.PI) * Math.exp(-p * 4.5) * 0.12;
      smoothSec = (sec === 0 ? 60 : sec) - 1.0 + Math.min(1.0, p) + bounce;
    }

    const secFraction = ms / 1000.0;
    const smoothMin = min + secFraction / 60.0;
    const smoothHour = hour + smoothMin / 60.0;

    const hourAngle = -(smoothHour / 12.0) * Math.PI * 2;
    const minAngle = -(smoothMin / 60.0) * Math.PI * 2;
    const secAngle = -(smoothSec / 60.0) * Math.PI * 2;

    const axis = this.clock.axis;
    if (this.clock.hourHand) this.clock.hourHand.rotation[axis] = hourAngle;
    if (this.clock.minHand) this.clock.minHand.rotation[axis] = minAngle;
    if (this.clock.secHand) this.clock.secHand.rotation[axis] = secAngle;
  }

  // =========================================================================
  // 2. Coffee Cup Curling Vector Steam Lines
  // =========================================================================
  _initCoffeeSteam() {
    const group = new THREE.Group();
    group.name = 'Coffee_Steam_System';

    if (this.options.coffeeCup) {
      this.options.coffeeCup.add(group);
      group.position.set(0, 0.088, 0);
    } else {
      group.position.set(-0.42, 0.84, -1.95);
      this.group.add(group);
    }

    const tendrilCount = 5;
    const pointsPerTendril = 32;
    const tendrils = [];

    for (let t = 0; t < tendrilCount; t++) {
      const points = [];
      for (let i = 0; i < pointsPerTendril; i++) {
        points.push(new THREE.Vector3(0, 0, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);

      const mat = new THREE.LineBasicMaterial({
        color: this.isDay ? 0xf0ede6 : 0xaecce8,
        transparent: true,
        opacity: 0.55,
        blending: THREE.NormalBlending,
        linewidth: 1.5,
      });

      const line = new THREE.Line(geo, mat);
      group.add(line);

      tendrils.push({
        line,
        geo,
        mat,
        phase: (t / tendrilCount) * Math.PI * 2,
        seedX: Math.random() * 10,
        seedZ: Math.random() * 10,
        speed: 0.28 + Math.random() * 0.12,
        maxHeight: 0.35 + Math.random() * 0.1,
        radiusOffset: 0.015 + Math.random() * 0.02,
      });
    }

    this.steam = {
      group,
      tendrils,
      pointsPerTendril,
    };
  }

  _updateCoffeeSteam(delta, time) {
    if (!this.steam) return;

    const { tendrils, pointsPerTendril } = this.steam;

    for (let t = 0; t < tendrils.length; t++) {
      const item = tendrils[t];
      const posAttr = item.geo.attributes.position;
      const positions = posAttr.array;

      // Cycle phase for upward continuous drift
      const tendrilCycleTime = (time * item.speed + item.phase) % 1.0;
      const currentHeight = item.maxHeight * (0.8 + 0.2 * Math.sin(time * 0.8 + item.phase));

      // Tendril fade envelope: transparent at rim, peaks at 0.35, dissolves at top
      const baseOpacity = this.isDay ? 0.45 : 0.35;
      item.mat.opacity = baseOpacity * (0.85 + 0.15 * Math.sin(time * 2.0 + item.phase));

      for (let i = 0; i < pointsPerTendril; i++) {
        const u = i / (pointsPerTendril - 1); // 0 (cup rim) to 1 (evaporated top)
        const y = u * currentHeight;

        // Curling vector equations using harmonic trigonometric displacement
        const curlSpeed = time * 2.2;
        const wave1 = Math.sin(u * 5.0 - curlSpeed + item.seedX);
        const wave2 = Math.cos(u * 4.2 - curlSpeed * 0.8 + item.seedZ);
        const wave3 = Math.sin(u * 8.0 + curlSpeed * 1.2);

        // Broaden curls as steam ascends
        const spread = u * 0.08 + Math.pow(u, 2) * 0.06;
        const x = (wave1 * 0.025 + wave3 * 0.012) * (1.0 + u * 2.5) + (u * 0.02);
        const z = (wave2 * 0.022) * (1.0 + u * 2.0);

        const idx = i * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }

      posAttr.needsUpdate = true;
    }
  }

  // =========================================================================
  // 3. Turntable Dynamics (Record rotation, tonearm tracking, floating musical note lines)
  // =========================================================================
  _initTurntable() {
    let platter = this.options.turntablePlatter;
    let tonearm = this.options.turntableArm;
    let turntableGroup = this.options.turntableGroup;

    // Search scene if not passed
    if (!platter || !tonearm) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (!platter && (name.includes('platter') || name.includes('vinyl') || name.includes('record'))) {
          platter = child;
        }
        if (!tonearm && (name.includes('arm') || name.includes('tonearm'))) {
          tonearm = child;
        }
        if (!turntableGroup && (name.includes('turntable') || name.includes('player'))) {
          turntableGroup = child;
        }
      });
    }

    // Do not create duplicate procedural line turntable

    // Floating musical note vector particles
    const notesGroup = new THREE.Group();
    notesGroup.name = 'Turntable_Floating_Notes';
    this.group.add(notesGroup);

    const notePool = [];
    const poolSize = 14;
    for (let i = 0; i < poolSize; i++) {
      const noteMesh = this._createVectorMusicalNote(i % 3);
      noteMesh.visible = false;
      notesGroup.add(noteMesh);
      notePool.push({
        mesh: noteMesh,
        active: false,
        age: 0,
        lifespan: 2.8,
        velocity: new THREE.Vector3(),
        rotSpeed: 0,
        scale: 1,
      });
    }

    this.turntable = {
      group: turntableGroup,
      platter,
      tonearm,
      notesGroup,
      notePool,
      lastSpawnTime: 0,
      currentSpeed: 0.0,
      targetSpeed: 0.0,
      maxSpeed: (33.333 / 60) * Math.PI * 2, // 33 1/3 RPM in rad/s ~ 3.4906
      armAngle: 0.0,
      targetArmAngle: 0.0,
      restArmAngle: 0.0,
      playArmAngle: 0.38, // Radians tracking over vinyl grooves
    };

    // Auto-sync with audio turntable state if already playing
    if (this.audio && this.audio.isTurntablePlaying) {
      this.startTurntable();
    }
  }

  _createVectorMusicalNote(type = 0) {
    const group = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({
      color: this.isDay ? 0xd4a359 : 0x76b4e8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85,
    });

    const scale = 0.05;

    if (type === 0) {
      // Eighth Note ♪ (Head + Stem + Flag)
      const headPts = [];
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * Math.PI * 2;
        headPts.push(new THREE.Vector3(Math.cos(th) * 0.35, Math.sin(th) * 0.25, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(headPts), lineMat));

      const stemPts = [
        new THREE.Vector3(0.35, 0, 0),
        new THREE.Vector3(0.35, 1.2, 0),
        new THREE.Vector3(0.65, 0.95, 0), // Flag
        new THREE.Vector3(0.35, 0.70, 0),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(stemPts), lineMat));
    } else if (type === 1) {
      // Beamed Double Eighth Note ♫
      // Note Head 1
      const h1 = [];
      for (let i = 0; i <= 12; i++) {
        const th = (i / 12) * Math.PI * 2;
        h1.push(new THREE.Vector3(-0.45 + Math.cos(th) * 0.28, Math.sin(th) * 0.22, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(h1), lineMat));

      // Note Head 2
      const h2 = [];
      for (let i = 0; i <= 12; i++) {
        const th = (i / 12) * Math.PI * 2;
        h2.push(new THREE.Vector3(0.45 + Math.cos(th) * 0.28, 0.15 + Math.sin(th) * 0.22, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(h2), lineMat));

      // Stems and Beam Bar
      const framePts = [
        new THREE.Vector3(-0.20, 0, 0),
        new THREE.Vector3(-0.20, 1.15, 0),
        new THREE.Vector3(0.70, 1.30, 0),
        new THREE.Vector3(0.70, 0.15, 0),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(framePts), lineMat));
    } else {
      // Quarter Note ♩
      const headPts = [];
      for (let i = 0; i <= 14; i++) {
        const th = (i / 14) * Math.PI * 2;
        headPts.push(new THREE.Vector3(Math.cos(th) * 0.35, Math.sin(th) * 0.25, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(headPts), lineMat));

      const stemPts = [new THREE.Vector3(0.35, 0, 0), new THREE.Vector3(0.35, 1.15, 0)];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(stemPts), lineMat));
    }

    group.scale.set(scale, scale, scale);
    return group;
  }

  startTurntable() {
    if (!this.turntable) return;
    this.turntable.targetSpeed = this.turntable.maxSpeed;
    this.turntable.targetArmAngle = this.turntable.playArmAngle;
    if (this.audio && !this.audio.isTurntablePlaying) {
      this.audio.startTurntable();
    }
  }

  stopTurntable() {
    if (!this.turntable) return;
    this.turntable.targetSpeed = 0.0;
    this.turntable.targetArmAngle = this.turntable.restArmAngle;
    if (this.audio && this.audio.isTurntablePlaying) {
      this.audio.stopTurntable();
    }
  }

  toggleTurntable() {
    if (!this.turntable) return false;
    if (this.turntable.targetSpeed > 0) {
      this.stopTurntable();
      return false;
    } else {
      this.startTurntable();
      return true;
    }
  }

  _updateTurntable(delta, time) {
    if (!this.turntable) return;

    // Check external audio sync
    if (this.audio) {
      if (this.audio.isTurntablePlaying && this.turntable.targetSpeed === 0) {
        this.turntable.targetSpeed = this.turntable.maxSpeed;
        this.turntable.targetArmAngle = this.turntable.playArmAngle;
      } else if (!this.audio.isTurntablePlaying && this.turntable.targetSpeed > 0) {
        this.turntable.targetSpeed = 0.0;
        this.turntable.targetArmAngle = this.turntable.restArmAngle;
      }
    }

    // Platter rotation with physical inertia
    const accelRate = this.turntable.targetSpeed > this.turntable.currentSpeed ? 2.2 : 1.4;
    this.turntable.currentSpeed += (this.turntable.targetSpeed - this.turntable.currentSpeed) * (1.0 - Math.exp(-delta * accelRate));

    if (this.turntable.platter) {
      this.turntable.platter.rotation.y += this.turntable.currentSpeed * delta;
    }

    // Tonearm tracking with spring damping
    this.turntable.armAngle += (this.turntable.targetArmAngle - this.turntable.armAngle) * (1.0 - Math.exp(-delta * 3.0));
    if (this.turntable.tonearm) {
      this.turntable.tonearm.rotation.y = this.turntable.armAngle;
    }

    // Floating musical note particle system
    const isSpinning = this.turntable.currentSpeed > this.turntable.maxSpeed * 0.6;
    if (isSpinning && time - this.turntable.lastSpawnTime > 0.45) {
      this._spawnMusicalNote(time);
      this.turntable.lastSpawnTime = time;
    }

    this._updateMusicalNotes(delta, time);
  }

  _spawnMusicalNote(time) {
    const pool = this.turntable.notePool;
    const item = pool.find((p) => !p.active);
    if (!item) return;

    item.active = true;
    item.age = 0;
    item.lifespan = 2.4 + Math.random() * 0.8;
    item.rotSpeed = (Math.random() - 0.5) * 1.5;

    // Stylus world position
    const spawnPos = new THREE.Vector3();
    if (this.turntable.tonearm) {
      this.turntable.tonearm.getWorldPosition(spawnPos);
      spawnPos.x += (Math.random() - 0.5) * 0.08;
      spawnPos.y += 0.04;
      spawnPos.z += (Math.random() - 0.5) * 0.08;
    } else {
      spawnPos.set(-0.85, 0.85, 0.15);
    }

    item.mesh.position.copy(spawnPos);
    item.mesh.visible = true;

    // Rising spiral velocity
    item.velocity.set(
      (Math.random() - 0.5) * 0.05,
      0.18 + Math.random() * 0.12,
      (Math.random() - 0.5) * 0.05
    );
  }

  _updateMusicalNotes(delta, time) {
    const pool = this.turntable.notePool;
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      if (!item.active) continue;

      item.age += delta;
      if (item.age >= item.lifespan) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }

      const p = item.age / item.lifespan;

      // Spiral waft
      item.mesh.position.x += item.velocity.x * delta + Math.sin(time * 3.0 + i) * 0.001;
      item.mesh.position.y += item.velocity.y * delta;
      item.mesh.position.z += item.velocity.z * delta + Math.cos(time * 2.5 + i) * 0.001;
      item.mesh.rotation.z += item.rotSpeed * delta;

      // Opacity fade in and fade out
      let alpha = 1.0;
      if (p < 0.2) alpha = p / 0.2;
      else if (p > 0.6) alpha = 1.0 - (p - 0.6) / 0.4;

      item.mesh.traverse((child) => {
        if (child.material) {
          child.material.opacity = alpha * 0.85;
        }
      });
    }
  }

  // =========================================================================
  // 4. Ceiling Fan Dynamics (Inertial continuous rotation & audio sync)
  // =========================================================================
  _initCeilingFan() {
    let fanBlades = this.options.fanBlades;
    let fanGroup = this.options.fanGroup;

    if (!fanBlades) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (!fanBlades && (name.includes('blade') || name.includes('fan_rotor') || name.includes('propeller'))) {
          fanBlades = child;
        }
        if (!fanGroup && name.includes('fan') && !name.includes('blade')) {
          fanGroup = child;
        }
      });
    }
    // Do not create duplicate procedural line fan

    this.fan = {
      group: fanGroup,
      blades: fanBlades,
      isRunning: true,
      currentSpeed: 0.0,
      targetSpeed: 4.8, // Rad/s (~46 RPM aesthetic smooth rotation)
      maxSpeed: 4.8,
    };

    if (this.audio) {
      this.audio.startFan(0.75);
    }
  }

  _createProceduralLineFan() {
    const group = new THREE.Group();
    group.name = 'Procedural_Line_Fan';
    group.position.set(0, 3.2, 0); // Ceiling center position

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85,
    });

    // Downrod & Ceiling Mount
    const rodPts = [new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0, 0, 0)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rodPts), lineMat));

    // Motor Hub Circle
    const hubPts = [];
    for (let i = 0; i <= 32; i++) {
      const th = (i / 32) * Math.PI * 2;
      hubPts.push(new THREE.Vector3(Math.cos(th) * 0.12, 0, Math.sin(th) * 0.12));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hubPts), lineMat));

    // Rotating Blades Group
    const blades = new THREE.Group();
    blades.name = 'Fan_Blades_Rotating';

    const bladeCount = 4;
    const bladeLen = 0.85;
    const bladeWidth = 0.14;

    for (let b = 0; b < bladeCount; b++) {
      const angle = (b / bladeCount) * Math.PI * 2;
      const bladeArm = new THREE.Group();
      bladeArm.rotation.y = angle;

      const pts = [
        new THREE.Vector3(0.12, 0, -bladeWidth * 0.3),
        new THREE.Vector3(0.12 + bladeLen, 0, -bladeWidth * 0.5),
        new THREE.Vector3(0.12 + bladeLen, 0, bladeWidth * 0.5),
        new THREE.Vector3(0.12, 0, bladeWidth * 0.3),
        new THREE.Vector3(0.12, 0, -bladeWidth * 0.3),
      ];
      bladeArm.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      blades.add(bladeArm);
    }

    group.add(blades);
    return { group, blades };
  }

  setFanSpeed(rpmRatio) {
    if (!this.fan) return;
    const ratio = Math.max(0.0, Math.min(1.0, rpmRatio));
    this.fan.targetSpeed = this.fan.maxSpeed * ratio;
    this.fan.isRunning = ratio > 0.01;
    if (this.audio) {
      if (this.fan.isRunning) {
        if (!this.audio.isFanRunning) this.audio.startFan(ratio);
        else this.audio.setFanSpeed(ratio);
      } else {
        this.audio.stopFan();
      }
    }
  }

  toggleFan() {
    if (!this.fan) return false;
    if (this.fan.isRunning) {
      this.setFanSpeed(0.0);
      return false;
    } else {
      this.setFanSpeed(1.0);
      return true;
    }
  }

  _updateCeilingFan(delta) {
    if (!this.fan || !this.fan.blades) return;

    // Acceleration / Deceleration Inertia
    const inertia = this.fan.isRunning ? 1.4 : 0.65;
    this.fan.currentSpeed += (this.fan.targetSpeed - this.fan.currentSpeed) * (1.0 - Math.exp(-delta * inertia));

    // Continuous blade rotation
    this.fan.blades.rotation.y += this.fan.currentSpeed * delta;

    // Audio pitch/volume sync
    if (this.audio && this.audio.isFanRunning) {
      this.audio.setFanSpeed(this.fan.currentSpeed / this.fan.maxSpeed);
    }
  }

  // =========================================================================
  // 5. Wind Chime Dynamics (Ambient pendulum sway & click impulse chime strikes)
  // =========================================================================
  _initWindChime() {
    let chimeGroup = this.options.windChime;

    if (!chimeGroup) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (name.includes('chime')) {
          chimeGroup = child;
        }
      });
    }
    // Do not create duplicate procedural line wind chime

    this.windChime = {
      group: chimeGroup,
      pendulum: chimeGroup?.getObjectByName ? chimeGroup.getObjectByName('Chime_Pendulum') : null,
      tubes: chimeGroup?.getObjectByName ? chimeGroup.getObjectByName('Chime_Tubes') : null,
      // Pendulum 2D physics state
      thetaX: 0.0,
      thetaZ: 0.0,
      velX: 0.0,
      velZ: 0.0,
      targetImpulse: 0.0,
      strikeCooldown: 0.0,
      lastTubeIndex: -1,
    };
  }

  /**
   * Apply an interactive impulse to the wind chime (e.g. on mouse click / touch).
   */
  triggerWindChime(strength = 1.0) {
    if (!this.windChime) return;
    const angle = Math.random() * Math.PI * 2;
    const force = 3.5 * strength;
    this.windChime.velX += Math.cos(angle) * force;
    this.windChime.velZ += Math.sin(angle) * force;

    if (this.audio) {
      this.audio.playWindChime({ count: 3, intensity: Math.min(1.0, strength) });
    }
  }

  _updateWindChime(delta, time) {
    if (!this.windChime) return;

    const wc = this.windChime;

    // Ambient gentle breeze force + multi-frequency gust modulation
    const ambientBreeze = this.isDay ? 0.28 : 0.15;
    const gustX = Math.sin(time * 0.7) * Math.cos(time * 0.23 + 1.2) * 0.45;
    const gustZ = Math.cos(time * 0.55) * Math.sin(time * 0.31 + 0.5) * 0.45;

    const forceX = (ambientBreeze * 0.6 + gustX) * 0.8;
    const forceZ = (ambientBreeze * 0.4 + gustZ) * 0.8;

    // Damped harmonic pendulum simulation
    const k = 14.0; // Restoring gravity spring constant
    const damping = 1.8; // Air resistance damping

    const accX = -k * wc.thetaX - damping * wc.velX + forceX;
    const accZ = -k * wc.thetaZ - damping * wc.velZ + forceZ;

    wc.velX += accX * delta;
    wc.velZ += accZ * delta;
    wc.thetaX += wc.velX * delta;
    wc.thetaZ += wc.velZ * delta;

    // Apply rotation to pendulum
    if (wc.pendulum) {
      wc.pendulum.rotation.z = wc.thetaX;
      wc.pendulum.rotation.x = wc.thetaZ;
    }

    // Subtle sympathetic sway on tubes
    if (wc.tubes) {
      wc.tubes.rotation.z = wc.thetaX * 0.25;
      wc.tubes.rotation.x = wc.thetaZ * 0.25;
    }

    // Natural strike detection based on clapper deflection amplitude
    wc.strikeCooldown -= delta;
    const deflection = Math.sqrt(wc.thetaX * wc.thetaX + wc.thetaZ * wc.thetaZ);
    if (deflection > 0.14 && wc.strikeCooldown <= 0) {
      // Determine which tube is closest to the deflection vector
      const strikeAngle = Math.atan2(wc.thetaZ, wc.thetaX);
      const tubeIdx = Math.floor(((strikeAngle + Math.PI) / (Math.PI * 2)) * 5) % 5;

      if (tubeIdx !== wc.lastTubeIndex || deflection > 0.25) {
        wc.lastTubeIndex = tubeIdx;
        wc.strikeCooldown = 0.35 + Math.random() * 0.25;
        if (this.audio) {
          const intensity = Math.min(1.0, deflection * 3.5);
          this.audio.playWindChime({ tubeIndex: tubeIdx, intensity, count: 1 });
        }
      }
    }
  }

  // =========================================================================
  // 6. Floating Sunbeam / Moonlight Dust Motes System
  // =========================================================================
  _initDustMotes() {
    const moteCount = 280;
    const group = new THREE.Group();
    group.name = 'Sunbeam_Dust_Motes';

    const positions = new Float32Array(moteCount * 3);
    const seeds = new Float32Array(moteCount * 3);
    const motesData = [];

    // Light beam bounding prism (from window into room)
    const bounds = {
      minX: -1.2, maxX: 1.8,
      minY: 0.4,  maxY: 3.0,
      minZ: -2.0, maxZ: 1.2,
    };

    for (let i = 0; i < moteCount; i++) {
      const idx = i * 3;
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      seeds[idx] = Math.random() * 100;
      seeds[idx + 1] = Math.random() * 100;
      seeds[idx + 2] = Math.random() * 100;

      motesData.push({
        baseSpeedY: 0.015 + Math.random() * 0.025,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.5 + Math.random() * 2.5,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Circular vector particle texture generated via canvas (ZERO external asset dependencies)
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.038,
      map: texture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: this.isDay ? 0xffeaaf : 0xaad2f5,
    });

    const points = new THREE.Points(geo, mat);
    group.add(points);
    this.group.add(group);

    this.dustMotes = {
      group,
      points,
      geo,
      mat,
      motesData,
      moteCount,
      bounds,
    };
  }

  _updateDustMotes(delta, time) {
    if (!this.dustMotes) return;

    const { geo, motesData, moteCount, bounds } = this.dustMotes;
    const posAttr = geo.attributes.position;
    const positions = posAttr.array;

    for (let i = 0; i < moteCount; i++) {
      const idx = i * 3;
      let x = positions[idx];
      let y = positions[idx + 1];
      let z = positions[idx + 2];

      const data = motesData[i];

      // Atmospheric thermal drift + curl noise convection field
      const curlX = Math.sin(y * 2.8 + time * 0.45 + i) * 0.016;
      const curlZ = Math.cos(y * 2.4 + time * 0.38 + i * 1.3) * 0.016;

      x += curlX * delta;
      y += data.baseSpeedY * delta;
      z += curlZ * delta;

      // Wrap boundaries smoothly within sunbeam volume
      if (y > bounds.maxY) y = bounds.minY;
      if (x < bounds.minX) x = bounds.maxX;
      if (x > bounds.maxX) x = bounds.minX;
      if (z < bounds.minZ) z = bounds.maxZ;
      if (z > bounds.maxZ) z = bounds.minZ;

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
    }

    posAttr.needsUpdate = true;
  }

  // =========================================================================
  // Day / Night Atmosphere Control
  // =========================================================================
  setDayNight(mode) {
    this.isDay = mode === 'day' || mode === true || mode === 1;
    this.dayNightRatio = this.isDay ? 1.0 : 0.0;

    // Update dust motes color
    if (this.dustMotes && this.dustMotes.mat) {
      const targetColor = this.isDay ? new THREE.Color(0xffeaaf) : new THREE.Color(0xaad2f5);
      this.dustMotes.mat.color.copy(targetColor);
    }

    // Update coffee steam color
    if (this.steam && this.steam.tendrils) {
      const steamColor = this.isDay ? new THREE.Color(0xf0ede6) : new THREE.Color(0xaecce8);
      for (const t of this.steam.tendrils) {
        t.mat.color.copy(steamColor);
      }
    }

    // Forward to audio engine
    if (this.audio && typeof this.audio.setDayNightMode === 'function') {
      this.audio.setDayNightMode(this.isDay ? 'day' : 'night');
    }
  }

  // =========================================================================
  // Main Per-Frame Update Loop
  // =========================================================================
  update(delta, time) {
    const dt = Math.min(delta || 0.016, 0.1);
    const t = time !== undefined ? time : performance.now() / 1000.0;

    this._updateClock(t);
    this._updateCoffeeSteam(dt, t);
    this._updateTurntable(dt, t);
    this._updateCeilingFan(dt);
    this._updateWindChime(dt, t);
    this._updateDustMotes(dt, t);
  }

  // =========================================================================
  // Cleanup / Dispose
  // =========================================================================
  dispose() {
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }

    // Dispose geometries & materials
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}

/* --- End js/dynamics.js --- */

/* --- Begin js/roomGeometry.js --- */
// Pure Line Room - Procedural 3D Vector Line Art Geometry & Interactive Environment
// Ligne Claire / Architectural Sketch / Manga Background Aesthetic
// [Stripped import]
/**
 * Helper: Create a Vector Line Art mesh pair (occluding backing mesh + silhouette/crease lines)
 * Uses polygonOffset to guarantee clean, crisp lines without z-fighting artifacts.
 */
function createVectorMesh(geometry, meshMat, lineMat, thresholdAngle = 24) {
  const group = new THREE.Group();

  // 1. Occluding backing mesh (solid fill matching room theme)
  const mesh = new THREE.Mesh(geometry, meshMat);
  group.add(mesh);

  // 2. Crease and silhouette line segments
  const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
  const lines = new THREE.LineSegments(edges, lineMat);
  group.add(lines);

  return { group, mesh, lines, geometry, edges };
}

/**
 * Helper: Create a polyline from an array of Vector3 points
 */
function createLine(points, lineMat) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geom, lineMat);
}

/**
 * Helper: Create independent line segments from an array of Vector3 point pairs
 */
function createLineSegments(points, lineMat) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geom, lineMat);
}

/**
 * Helper: Create a circle line on XZ, XY, or YZ plane
 */
function createCircleLine(radius, segments = 32, lineMat, plane = 'xz') {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const c = Math.cos(theta) * radius;
    const s = Math.sin(theta) * radius;
    if (plane === 'xz') pts.push(new THREE.Vector3(c, 0, s));
    else if (plane === 'xy') pts.push(new THREE.Vector3(c, s, 0));
    else pts.push(new THREE.Vector3(0, c, s));
  }
  return createLine(pts, lineMat);
}

/**
 * Helper: Create an arc line on XY plane
 */
function createArcLine(radius, startAngle, endAngle, segments = 16, lineMat, plane = 'xy') {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = startAngle + (i / segments) * (endAngle - startAngle);
    const c = Math.cos(theta) * radius;
    const s = Math.sin(theta) * radius;
    if (plane === 'xy') pts.push(new THREE.Vector3(c, s, 0));
    else if (plane === 'xz') pts.push(new THREE.Vector3(c, 0, s));
    else pts.push(new THREE.Vector3(0, c, s));
  }
  return createLine(pts, lineMat);
}

/**
 * Helper: Create a 2D rectangle line outline
 */
function createRectOutline(width, height, lineMat, plane = 'xy') {
  const hw = width / 2;
  const hh = height / 2;
  let pts;
  if (plane === 'xy') {
    pts = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0)
    ];
  } else if (plane === 'xz') {
    pts = [
      new THREE.Vector3(-hw, 0, -hh),
      new THREE.Vector3(hw, 0, -hh),
      new THREE.Vector3(hw, 0, hh),
      new THREE.Vector3(-hw, 0, hh),
      new THREE.Vector3(-hw, 0, -hh)
    ];
  } else {
    pts = [
      new THREE.Vector3(0, -hw, -hh),
      new THREE.Vector3(0, hw, -hh),
      new THREE.Vector3(0, hw, hh),
      new THREE.Vector3(0, -hw, hh),
      new THREE.Vector3(0, -hw, -hh)
    ];
  }
  return createLine(pts, lineMat);
}

/**
 * Setup material palette for Day and Night architectural vector styling
 */
function createMaterials() {
  // Day Palette defaults
  const dayBg = 0xf6f7f9;
  const dayLine = 0x22262e;
  const daySubtle = 0x64748b;
  const dayAccent = 0x2563eb;
  const dayBeam = 0xfef08a;

  // Solid backing mesh material (matches background color, pushed back by polygonOffset)
  const bgMaterial = new THREE.MeshBasicMaterial({
    color: dayBg,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide
  });

  // Main silhouette and crease line material
  const lineMaterial = new THREE.LineBasicMaterial({
    color: dayLine,
    linewidth: 1
  });

  // Secondary structural / texture line material (for wood grain, tick marks, grooves)
  const subtleLineMaterial = new THREE.LineBasicMaterial({
    color: daySubtle,
    linewidth: 1
  });

  // Accent interactive line material
  const accentLineMaterial = new THREE.LineBasicMaterial({
    color: dayAccent,
    linewidth: 1
  });

  // Lamp volumetric light cone translucent material
  const lampBeamMaterial = new THREE.MeshBasicMaterial({
    color: dayBeam,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  // Coffee liquid surface material
  const coffeeMaterial = new THREE.MeshBasicMaterial({
    color: 0xc27838,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  return {
    bgMaterial,
    lineMaterial,
    subtleLineMaterial,
    accentLineMaterial,
    lampBeamMaterial,
    coffeeMaterial,
    isNight: false,
    updateTheme(night) {
      this.isNight = night;
      if (night) {
        this.bgMaterial.color.setHex(0x13161c);
        this.lineMaterial.color.setHex(0xe2e8f0);
        this.subtleLineMaterial.color.setHex(0x94a3b8);
        this.accentLineMaterial.color.setHex(0x38bdf8);
        this.lampBeamMaterial.color.setHex(0x38bdf8);
        this.lampBeamMaterial.opacity = 0.22;
        this.coffeeMaterial.color.setHex(0x9a5b28);
      } else {
        this.bgMaterial.color.setHex(0xf6f7f9);
        this.lineMaterial.color.setHex(0x22262e);
        this.subtleLineMaterial.color.setHex(0x64748b);
        this.accentLineMaterial.color.setHex(0x2563eb);
        this.lampBeamMaterial.color.setHex(0xfef08a);
        this.lampBeamMaterial.opacity = 0.14;
        this.coffeeMaterial.color.setHex(0xc27838);
      }
    }
  };
}

/**
 * Register an interactive item with user data and hit-test target mesh
 */
function tagInteractive(targetMesh, parentGroup, metadata, interactiveTargets) {
  const data = {
    id: metadata.id || '00',
    code: metadata.code || 'ITEM',
    name: metadata.name || 'Room Item',
    hint: metadata.hint || '点击互动',
    category: metadata.category || '室内陈设',
    interactive: true,
    parentGroup: parentGroup,
    targetMesh: targetMesh,
    onClick: metadata.onClick || null
  };

  targetMesh.userData = data;
  parentGroup.userData = data;
  interactiveTargets.push(targetMesh);
  return data;
}

// =========================================================================
// PROCEDURAL ARCHITECTURE & 20 REQUIRED ROOM ITEMS
// =========================================================================

/**
 * 0. Room Shell (Floor, Left Wall, Back Wall, Cornice, Parquet Grid)
 */
function buildArchitecture(root, mats) {
  const group = new THREE.Group();
  group.name = 'Architecture_Shell';

  // Floor (7.0m x 7.0m x 0.2m)
  const floorGeom = new THREE.BoxGeometry(7.0, 0.2, 7.0);
  const floor = createVectorMesh(floorGeom, mats.bgMaterial, mats.lineMaterial);
  floor.group.position.set(0, -0.1, 0);
  group.add(floor.group);

  // Parquet wood plank line art on floor surface
  const floorLines = [];
  const plankW = 0.28;
  const plankL = 0.875;
  for (let x = -3.5 + plankW; x < 3.5; x += plankW) {
    floorLines.push(new THREE.Vector3(x, 0.001, -3.5), new THREE.Vector3(x, 0.001, 3.5));
  }
  let row = 0;
  for (let z = -3.5; z <= 3.5; z += plankL) {
    row++;
    const xOffset = (row % 2) * (plankW * 0.5);
    for (let x = -3.5 + xOffset; x <= 3.5; x += plankW * 2) {
      floorLines.push(new THREE.Vector3(x, 0.001, z), new THREE.Vector3(Math.min(3.5, x + plankW), 0.001, z));
    }
  }
  const parquetSegments = createLineSegments(floorLines, mats.subtleLineMaterial);
  group.add(parquetSegments);

  // Left Wall (x = -3.5, height = 3.6m, depth = 7.0m)
  const leftWallGeom = new THREE.BoxGeometry(0.2, 3.6, 7.0);
  const leftWall = createVectorMesh(leftWallGeom, mats.bgMaterial, mats.lineMaterial);
  leftWall.group.position.set(-3.5, 1.8, 0);
  group.add(leftWall.group);

  // Back Wall (z = -3.5, height = 3.6m, width = 7.0m)
  const backWallGeom = new THREE.BoxGeometry(7.0, 3.6, 0.2);
  const backWall = createVectorMesh(backWallGeom, mats.bgMaterial, mats.lineMaterial);
  backWall.group.position.set(0, 1.8, -3.5);
  group.add(backWall.group);

  // Baseboards (Skirting)
  const baseboardLeft = createVectorMesh(new THREE.BoxGeometry(0.04, 0.12, 7.0), mats.bgMaterial, mats.lineMaterial);
  baseboardLeft.group.position.set(-3.38, 0.06, 0);
  group.add(baseboardLeft.group);

  const baseboardBack = createVectorMesh(new THREE.BoxGeometry(7.0, 0.12, 0.04), mats.bgMaterial, mats.lineMaterial);
  baseboardBack.group.position.set(0, 0.06, -3.38);
  group.add(baseboardBack.group);

  // Ceiling Perimeter Beams & Crown Moldings
  const crownLeft = createVectorMesh(new THREE.BoxGeometry(0.12, 0.12, 7.0), mats.bgMaterial, mats.lineMaterial);
  crownLeft.group.position.set(-3.34, 3.54, 0);
  group.add(crownLeft.group);

  const crownBack = createVectorMesh(new THREE.BoxGeometry(7.0, 0.12, 0.12), mats.bgMaterial, mats.lineMaterial);
  crownBack.group.position.set(0, 3.54, -3.34);
  group.add(crownBack.group);

  root.add(group);
  return group;
}

/**
 * 1. Door (Frame, Panel, Handle, Hinges, Opens smoothly on Hinge)
 */
function buildDoor(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_01_Door';
  group.position.set(-3.38, 0, 1.7);

  // Door Frame Casing (Jambs & Header)
  const leftJamb = createVectorMesh(new THREE.BoxGeometry(0.08, 2.3, 0.06), mats.bgMaterial, mats.lineMaterial);
  leftJamb.group.position.set(0, 1.15, -0.48);
  group.add(leftJamb.group);

  const rightJamb = createVectorMesh(new THREE.BoxGeometry(0.08, 2.3, 0.06), mats.bgMaterial, mats.lineMaterial);
  rightJamb.group.position.set(0, 1.15, 0.48);
  group.add(rightJamb.group);

  const topJamb = createVectorMesh(new THREE.BoxGeometry(0.08, 0.08, 1.02), mats.bgMaterial, mats.lineMaterial);
  topJamb.group.position.set(0, 2.31, 0);
  group.add(topJamb.group);

  // Door Hinge Pivot (rotates around hinge edge)
  const hingePivot = new THREE.Group();
  hingePivot.position.set(0, 0, -0.45);
  group.add(hingePivot);

  // Door Leaf Panel (Width: 0.90m, Height: 2.22m, Depth: 0.045m)
  const panelGeom = new THREE.BoxGeometry(0.045, 2.22, 0.90);
  const doorPanel = createVectorMesh(panelGeom, mats.bgMaterial, mats.lineMaterial);
  doorPanel.group.position.set(0, 1.11, 0.45);
  hingePivot.add(doorPanel.group);

  // 4 Recessed Decorative Panels on Door
  const panelPositions = [
    { y: 1.62, h: 0.72 },
    { y: 0.62, h: 0.72 }
  ];
  panelPositions.forEach(pos => {
    // Upper and lower raised moldings
    const trim = createVectorMesh(new THREE.BoxGeometry(0.052, pos.h, 0.72), mats.bgMaterial, mats.subtleLineMaterial);
    trim.group.position.set(0, pos.y, 0.45);
    hingePivot.add(trim.group);

    const innerLine = createRectOutline(0.64, pos.h - 0.08, mats.lineMaterial, 'zy');
    innerLine.position.set(0.027, pos.y, 0.45);
    hingePivot.add(innerLine);
  });

  // Cylindrical Hinges (top and bottom)
  [-0.45].forEach(hz => {
    [0.35, 1.85].forEach(hy => {
      const hinge = createVectorMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12), mats.bgMaterial, mats.lineMaterial);
      hinge.group.position.set(0, hy, hz);
      group.add(hinge.group);
    });
  });

  // Door Handle & Lock Plate (Brass Lever on both sides)
  const lockPlate = createVectorMesh(new THREE.BoxGeometry(0.065, 0.22, 0.06), mats.bgMaterial, mats.lineMaterial);
  lockPlate.group.position.set(0, 1.05, 0.82);
  hingePivot.add(lockPlate.group);

  // Lever Handle (L-shaped)
  const handleStem = createVectorMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 12), mats.bgMaterial, mats.lineMaterial);
  handleStem.group.rotation.z = Math.PI / 2;
  handleStem.group.position.set(0.05, 1.08, 0.82);
  hingePivot.add(handleStem.group);

  const handleLever = createVectorMesh(new THREE.BoxGeometry(0.012, 0.016, 0.12), mats.bgMaterial, mats.lineMaterial);
  handleLever.group.position.set(0.08, 1.08, 0.76);
  hingePivot.add(handleLever.group);

  // Keyhole line detail
  const keyholeLine = createLine([
    new THREE.Vector3(0.034, 1.01, 0.82),
    new THREE.Vector3(0.034, 0.98, 0.82)
  ], mats.lineMaterial);
  hingePivot.add(keyholeLine);

  // Interactive state
  const doorState = {
    isOpen: false,
    currentAngle: 0,
    targetAngle: 0,
    toggle() {
      this.isOpen = !this.isOpen;
      this.targetAngle = this.isOpen ? -Math.PI * 0.45 : 0;
    }
  };

  tagInteractive(doorPanel.mesh, group, {
    id: '01',
    code: 'DOOR',
    name: '平开木门 / Wooden Door',
    hint: '点击推拉开关木门，感受线稿空间的虚实开合',
    category: '建筑构件 / Architectural',
    onClick: () => doorState.toggle()
  }, interactiveTargets);

  root.add(group);
  return { group, hingePivot, doorState };
}

/**
 * 2. Window (Frame, Mullions, Sill, Outdoor Landscape Line Art)
 */
function buildWindow(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_02_Window';
  group.position.set(-0.7, 2.05, -3.42);

  const winW = 2.2;
  const winH = 1.6;
  const winD = 0.12;

  // Window Outer Frame
  const outerCasing = createVectorMesh(new THREE.BoxGeometry(winW + 0.16, winH + 0.16, winD), mats.bgMaterial, mats.lineMaterial);
  group.add(outerCasing.group);

  // Window Sill (Projecting ledge below)
  const sill = createVectorMesh(new THREE.BoxGeometry(winW + 0.28, 0.07, 0.24), mats.bgMaterial, mats.lineMaterial);
  sill.group.position.set(0, -(winH / 2 + 0.035), 0.06);
  group.add(sill.group);

  // Window Sky Backing Plane (Behind landscape)
  const windowBacking = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), mats.bgMaterial);
  windowBacking.position.set(0, 0, -0.055);
  group.add(windowBacking);

  // Mullions (Cross Divider: 1 vertical center, 1 horizontal transom at upper 1/3)
  const vertMullion = createVectorMesh(new THREE.BoxGeometry(0.04, winH, 0.05), mats.bgMaterial, mats.lineMaterial);
  group.add(vertMullion.group);

  const horizMullion = createVectorMesh(new THREE.BoxGeometry(winW, 0.04, 0.05), mats.bgMaterial, mats.lineMaterial);
  horizMullion.group.position.set(0, winH * 0.18, 0);
  group.add(horizMullion.group);

  // Vector Outdoor Landscape Lines (Drawn directly in front of sky backing plane)
  const landscapeGroup = new THREE.Group();
  landscapeGroup.position.set(0, 0, -0.04);

  // Horizon Line
  landscapeGroup.add(createLine([
    new THREE.Vector3(-winW / 2 + 0.05, -0.2, 0),
    new THREE.Vector3(winW / 2 - 0.05, -0.2, 0)
  ], mats.lineMaterial));

  // Mountain Ridge 1 (Distant Peaks)
  const mountain1Pts = [
    new THREE.Vector3(-1.1, -0.2, 0),
    new THREE.Vector3(-0.85, 0.18, 0),
    new THREE.Vector3(-0.6, -0.05, 0),
    new THREE.Vector3(-0.35, 0.32, 0),
    new THREE.Vector3(-0.1, 0.02, 0),
    new THREE.Vector3(0.2, 0.28, 0),
    new THREE.Vector3(0.55, -0.08, 0),
    new THREE.Vector3(0.85, 0.22, 0),
    new THREE.Vector3(1.1, -0.2, 0)
  ];
  landscapeGroup.add(createLine(mountain1Pts, mats.lineMaterial));

  // Mountain Ridge 2 (Foreground Rolling Hills)
  const mountain2Pts = [
    new THREE.Vector3(-1.1, -0.35, 0),
    new THREE.Vector3(-0.7, -0.08, 0),
    new THREE.Vector3(-0.2, -0.22, 0),
    new THREE.Vector3(0.35, -0.05, 0),
    new THREE.Vector3(0.75, -0.25, 0),
    new THREE.Vector3(1.1, -0.15, 0)
  ];
  landscapeGroup.add(createLine(mountain2Pts, mats.subtleLineMaterial));

  // Sun / Moon with Radiating Aura Rings
  const sunPos = new THREE.Vector3(0.58, 0.52, 0);
  const sunCircle = createCircleLine(0.12, 24, mats.lineMaterial, 'xy');
  sunCircle.position.copy(sunPos);
  landscapeGroup.add(sunCircle);

  const sunAura = createCircleLine(0.18, 24, mats.subtleLineMaterial, 'xy');
  sunAura.position.copy(sunPos);
  landscapeGroup.add(sunAura);

  // Stylized Clouds (Concentric curve arcs)
  [
    { x: -0.65, y: 0.55, r: 0.14 },
    { x: -0.45, y: 0.58, r: 0.18 },
    { x: -0.25, y: 0.53, r: 0.13 },
    { x: 0.1, y: 0.46, r: 0.12 }
  ].forEach(c => {
    const cloudArc = createArcLine(c.r, 0, Math.PI, 16, mats.subtleLineMaterial, 'xy');
    cloudArc.position.set(c.x, c.y, 0);
    landscapeGroup.add(cloudArc);
  });

  // Flying Birds (V-shapes)
  [
    { x: -0.1, y: 0.62, s: 0.035 },
    { x: 0.06, y: 0.68, s: 0.03 },
    { x: 0.18, y: 0.61, s: 0.025 }
  ].forEach(b => {
    const bird = createLine([
      new THREE.Vector3(b.x - b.s, b.y - b.s * 0.6, 0),
      new THREE.Vector3(b.x, b.y, 0),
      new THREE.Vector3(b.x + b.s, b.y - b.s * 0.6, 0)
    ], mats.lineMaterial);
    landscapeGroup.add(bird);
  });

  group.add(landscapeGroup);

  tagInteractive(sill.mesh, group, {
    id: '02',
    code: 'WINDOW',
    name: '建筑景观窗 / Architectural Window',
    hint: '点击远眺窗外群山、日月与飞鸟的矢量全景',
    category: '建筑构件 / Architectural'
  }, interactiveTargets);

  root.add(group);
  return { group, landscapeGroup };
}

/**
 * 3. Blinds (Slats Array, Top Header, Pull Cords, Tilt/Lift Capability)
 */
function buildBlinds(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_03_Blinds';
  group.position.set(-0.7, 2.75, -3.34);

  const blindsW = 2.12;
  const slatCount = 20;
  const slatH = 0.055;
  const dropLength = 1.30;

  // Top Valance / Headrail
  const headrail = createVectorMesh(new THREE.BoxGeometry(blindsW + 0.04, 0.06, 0.07), mats.bgMaterial, mats.lineMaterial);
  group.add(headrail.group);

  // Slats Group & Pivot Array
  const slatsContainer = new THREE.Group();
  group.add(slatsContainer);

  const slatGroups = [];
  for (let i = 0; i < slatCount; i++) {
    const slatPivot = new THREE.Group();
    const yPos = -0.06 - (i / (slatCount - 1)) * dropLength;
    slatPivot.position.set(0, yPos, 0);

    const slatGeom = new THREE.BoxGeometry(blindsW, 0.003, slatH);
    const slat = createVectorMesh(slatGeom, mats.bgMaterial, mats.lineMaterial);
    slatPivot.add(slat.group);

    slatsContainer.add(slatPivot);
    slatGroups.push({ pivot: slatPivot, defaultY: yPos });
  }

  // Vertical Braided Ladder Cords (3 cord pairs: left, center, right)
  const cordXPositions = [-blindsW * 0.38, 0, blindsW * 0.38];
  const cordLines = [];
  cordXPositions.forEach(x => {
    // Front and back cord strands
    cordLines.push(new THREE.Vector3(x, 0, 0.026), new THREE.Vector3(x, -dropLength - 0.08, 0.026));
    cordLines.push(new THREE.Vector3(x, 0, -0.026), new THREE.Vector3(x, -dropLength - 0.08, -0.026));
  });
  group.add(createLineSegments(cordLines, mats.subtleLineMaterial));

  // Pull Cord with Wooden Acorn on Right Side
  const pullCordPts = [
    new THREE.Vector3(blindsW * 0.48, 0, 0.03),
    new THREE.Vector3(blindsW * 0.48, -0.85, 0.03)
  ];
  group.add(createLine(pullCordPts, mats.lineMaterial));

  const acorn = createVectorMesh(new THREE.CylinderGeometry(0.01, 0.006, 0.05, 10), mats.bgMaterial, mats.lineMaterial);
  acorn.group.position.set(blindsW * 0.48, -0.87, 0.03);
  group.add(acorn.group);

  // Bottom Weighted Rail
  const bottomRail = createVectorMesh(new THREE.BoxGeometry(blindsW, 0.03, 0.06), mats.bgMaterial, mats.lineMaterial);
  bottomRail.group.position.set(0, -dropLength - 0.08, 0);
  slatsContainer.add(bottomRail.group);

  // Interactive Blinds State
  const blindsState = {
    isOpen: true,
    tiltAngle: 1.15, // near horizontal
    targetAngle: 1.15,
    toggle() {
      this.isOpen = !this.isOpen;
      this.targetAngle = this.isOpen ? 1.15 : 0.08; // 0.08 = closed vertical
    }
  };

  tagInteractive(headrail.mesh, group, {
    id: '03',
    code: 'BLINDS',
    name: '百叶窗帘 / Venetian Blinds',
    hint: '点击拉绳调节百叶片倾角，控制室外采光入界',
    category: '室内陈设 / Furnishing',
    onClick: () => blindsState.toggle()
  }, interactiveTargets);

  root.add(group);
  return { group, slatGroups, blindsState };
}

/**
 * 4. Desk (Desktop, Wooden Legs, Crossbars, Pen Holder with Pencils & Ruler)
 */
function buildDesk(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_04_Desk';
  group.position.set(-0.7, 0, -2.15);

  const deskW = 1.6;
  const deskD = 0.8;
  const deskH = 0.75;
  const topThick = 0.04;

  // Solid Desktop
  const topGeom = new THREE.BoxGeometry(deskW, topThick, deskD);
  const desktop = createVectorMesh(topGeom, mats.bgMaterial, mats.lineMaterial);
  desktop.group.position.set(0, deskH - topThick / 2, 0);
  group.add(desktop.group);

  // Under-desk Framing Beams
  const apronLongF = createVectorMesh(new THREE.BoxGeometry(deskW - 0.16, 0.06, 0.03), mats.bgMaterial, mats.lineMaterial);
  apronLongF.group.position.set(0, deskH - 0.06, deskD / 2 - 0.06);
  group.add(apronLongF.group);

  const apronLongB = createVectorMesh(new THREE.BoxGeometry(deskW - 0.16, 0.06, 0.03), mats.bgMaterial, mats.lineMaterial);
  apronLongB.group.position.set(0, deskH - 0.06, -deskD / 2 + 0.06);
  group.add(apronLongB.group);

  // 4 Tapered Wooden Legs
  const legH = deskH - topThick;
  const legOffsetX = deskW / 2 - 0.1;
  const legOffsetZ = deskD / 2 - 0.1;
  [
    { x: -legOffsetX, z: -legOffsetZ, rotZ: 0.04, rotX: -0.04 },
    { x: legOffsetX, z: -legOffsetZ, rotZ: -0.04, rotX: -0.04 },
    { x: -legOffsetX, z: legOffsetZ, rotZ: 0.04, rotX: 0.04 },
    { x: legOffsetX, z: legOffsetZ, rotZ: -0.04, rotX: 0.04 }
  ].forEach(legCfg => {
    const legGeom = new THREE.CylinderGeometry(0.024, 0.015, legH, 14);
    const leg = createVectorMesh(legGeom, mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(legCfg.x, legH / 2, legCfg.z);
    leg.group.rotation.z = legCfg.rotZ;
    leg.group.rotation.x = legCfg.rotX;
    group.add(leg.group);
  });

  // Crossbar Stretcher (Rear reinforcement)
  const crossbar = createVectorMesh(new THREE.BoxGeometry(deskW - 0.28, 0.025, 0.025), mats.bgMaterial, mats.lineMaterial);
  crossbar.group.position.set(0, 0.26, -legOffsetZ);
  group.add(crossbar.group);

  // Leather Desk Blotter / Pad with Double Stitch Lines
  const blotterW = 0.78;
  const blotterD = 0.48;
  const blotter = createVectorMesh(new THREE.BoxGeometry(blotterW, 0.005, blotterD), mats.bgMaterial, mats.lineMaterial);
  blotter.group.position.set(0.04, deskH + 0.003, 0.05);
  group.add(blotter.group);

  const stitchLine = createRectOutline(blotterW - 0.03, blotterD - 0.03, mats.subtleLineMaterial, 'xz');
  stitchLine.position.set(0.04, deskH + 0.006, 0.05);
  group.add(stitchLine);

  // Pen Holder Cup
  const penCup = createVectorMesh(new THREE.CylinderGeometry(0.042, 0.038, 0.11, 16), mats.bgMaterial, mats.lineMaterial);
  penCup.group.position.set(0.62, deskH + 0.055, -0.22);
  group.add(penCup.group);

  // Writing Pencils inside holder
  const pencils = [
    { x: 0.61, z: -0.21, rx: 0.15, rz: 0.1, len: 0.17 },
    { x: 0.63, z: -0.23, rx: -0.12, rz: -0.15, len: 0.15 },
    { x: 0.62, z: -0.24, rx: 0.08, rz: -0.12, len: 0.18 }
  ];
  pencils.forEach(p => {
    const shaft = createVectorMesh(new THREE.CylinderGeometry(0.004, 0.004, p.len, 8), mats.bgMaterial, mats.lineMaterial);
    shaft.group.position.set(p.x, deskH + 0.07 + p.len / 2, p.z);
    shaft.group.rotation.x = p.rx;
    shaft.group.rotation.z = p.rz;
    group.add(shaft.group);

    // Sharpened cone tip
    const tip = createVectorMesh(new THREE.ConeGeometry(0.004, 0.016, 8), mats.bgMaterial, mats.lineMaterial);
    tip.group.position.set(p.x, deskH + 0.07 + p.len + 0.008, p.z);
    tip.group.rotation.x = p.rx;
    tip.group.rotation.z = p.rz;
    group.add(tip.group);
  });

  // Architectural 30-60-90 Drafting Triangle Ruler
  const rulerPts = [
    new THREE.Vector3(0.48, deskH + 0.005, -0.12),
    new THREE.Vector3(0.48, deskH + 0.005, 0.14),
    new THREE.Vector3(0.33, deskH + 0.005, -0.12),
    new THREE.Vector3(0.48, deskH + 0.005, -0.12)
  ];
  group.add(createLine(rulerPts, mats.lineMaterial));

  // Inner cutout for ruler
  const innerRulerPts = [
    new THREE.Vector3(0.46, deskH + 0.005, -0.09),
    new THREE.Vector3(0.46, deskH + 0.005, 0.08),
    new THREE.Vector3(0.36, deskH + 0.005, -0.09),
    new THREE.Vector3(0.46, deskH + 0.005, -0.09)
  ];
  group.add(createLine(innerRulerPts, mats.subtleLineMaterial));

  tagInteractive(desktop.mesh, group, {
    id: '04',
    code: 'DESK',
    name: '实木工作台 / Solid Wood Desk',
    hint: '极简北欧实木桌，配有皮质桌垫与精密绘图工具',
    category: '家具器物 / Furniture'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 5. Desk Lamp (Base, Dual Articulated Arms with Hinges, Shade, Bulb, Light Beam Cone Mesh)
 */
function buildDeskLamp(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_05_DeskLamp';
  group.position.set(-1.35, 0.75, -2.15);

  // Stepped Heavy Base
  const baseGeom = new THREE.CylinderGeometry(0.095, 0.105, 0.026, 24);
  const base = createVectorMesh(baseGeom, mats.bgMaterial, mats.lineMaterial);
  base.group.position.set(0, 0.013, 0);
  group.add(base.group);

  // Base Toggle Switch
  const toggle = createVectorMesh(new THREE.CylinderGeometry(0.007, 0.007, 0.016, 10), mats.bgMaterial, mats.lineMaterial);
  toggle.group.position.set(0.05, 0.028, 0);
  group.add(toggle.group);

  // Swivel Lower Joint
  const basePivot = new THREE.Group();
  basePivot.position.set(0, 0.026, 0);
  group.add(basePivot);

  // Lower Dual Articulated Rods (leaning towards center desk)
  const lowerArmLen = 0.36;
  const lowerArmPivot = new THREE.Group();
  lowerArmPivot.rotation.z = -0.45;
  lowerArmPivot.rotation.y = 0.25;
  basePivot.add(lowerArmPivot);

  [-0.012, 0.012].forEach(zOffset => {
    const rod = createVectorMesh(new THREE.CylinderGeometry(0.004, 0.004, lowerArmLen, 10), mats.bgMaterial, mats.lineMaterial);
    rod.group.position.set(0, lowerArmLen / 2, zOffset);
    lowerArmPivot.add(rod.group);
  });

  // Lower Tension Spring Line Art
  const springPts = [];
  for (let s = 0; s <= 16; s++) {
    const sy = 0.08 + (s / 16) * 0.18;
    const sx = Math.sin(s * Math.PI) * 0.008;
    springPts.push(new THREE.Vector3(sx, sy, 0));
  }
  lowerArmPivot.add(createLine(springPts, mats.subtleLineMaterial));

  // Elbow Joint Hub with Wing Nut
  const elbowPivot = new THREE.Group();
  elbowPivot.position.set(0, lowerArmLen, 0);
  elbowPivot.rotation.z = 1.15; // Bends downward toward desk
  lowerArmPivot.add(elbowPivot);

  const elbowDisc = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.034, 16), mats.bgMaterial, mats.lineMaterial);
  elbowDisc.group.rotation.x = Math.PI / 2;
  elbowPivot.add(elbowDisc.group);

  // Upper Dual Arm Rods
  const upperArmLen = 0.34;
  [-0.012, 0.012].forEach(zOffset => {
    const rod = createVectorMesh(new THREE.CylinderGeometry(0.004, 0.004, upperArmLen, 10), mats.bgMaterial, mats.lineMaterial);
    rod.group.position.set(0, upperArmLen / 2, zOffset);
    elbowPivot.add(rod.group);
  });

  // Shade Pivot Joint
  const shadePivot = new THREE.Group();
  shadePivot.position.set(0, upperArmLen, 0);
  shadePivot.rotation.z = -0.70; // Directs shade downward to desk
  elbowPivot.add(shadePivot);

  // Bell / Cone Lamp Shade
  const shadeGeom = new THREE.CylinderGeometry(0.045, 0.11, 0.14, 20, 1, true);
  const shade = createVectorMesh(shadeGeom, mats.bgMaterial, mats.lineMaterial);
  shade.group.position.set(0, -0.07, 0);
  shadePivot.add(shade.group);

  // Shade Top Cap
  const shadeCap = createVectorMesh(new THREE.CylinderGeometry(0.025, 0.045, 0.03, 16), mats.bgMaterial, mats.lineMaterial);
  shadeCap.group.position.set(0, 0.01, 0);
  shadePivot.add(shadeCap.group);

  // Light Bulb inside shade
  const bulb = createVectorMesh(new THREE.SphereGeometry(0.032, 12, 12), mats.bgMaterial, mats.lineMaterial);
  bulb.group.position.set(0, -0.07, 0);
  shadePivot.add(bulb.group);

  // Light Beam Cone Mesh (Projects straight down onto the desktop)
  const beamHeight = 0.62;
  const beamGeom = new THREE.ConeGeometry(0.38, beamHeight, 18, 1, true);
  beamGeom.translate(0, -beamHeight / 2, 0); // apex at 0, base at -beamHeight
  const beamMesh = new THREE.Mesh(beamGeom, mats.lampBeamMaterial);
  beamMesh.position.set(0, -0.07, 0); // starts at bulb
  shadePivot.add(beamMesh);

  // Subtle Light Beam Radial Edge Lines
  const beamLinesGeom = new THREE.EdgesGeometry(beamGeom, 15);
  const beamLines = new THREE.LineSegments(beamLinesGeom, mats.subtleLineMaterial);
  beamMesh.add(beamLines);

  // Interactive Lamp Light Toggle
  const lampState = {
    isOn: true,
    toggle() {
      this.isOn = !this.isOn;
      beamMesh.visible = this.isOn;
    }
  };

  tagInteractive(base.mesh, group, {
    id: '05',
    code: 'DESK_LAMP',
    name: '铰接绘图台灯 / Drafting Lamp',
    hint: '点击开关台灯，点亮工作台上的聚焦光锥',
    category: '室内陈设 / Furnishing',
    onClick: () => lampState.toggle()
  }, interactiveTargets);

  // Also make the shade interactive
  shade.mesh.userData = base.mesh.userData;
  interactiveTargets.push(shade.mesh);

  root.add(group);
  return { group, beamMesh, lampState };
}

/**
 * 6. Cup (Mug, Handle, Coffee Liquid Surface, Saucer Coaster, Steam Lines)
 */
function buildCup(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_06_Cup';
  group.position.set(-0.42, 0.75, -1.95);

  // Saucer Coaster
  const saucer = createVectorMesh(new THREE.CylinderGeometry(0.065, 0.055, 0.012, 24), mats.bgMaterial, mats.lineMaterial);
  saucer.group.position.set(0, 0.006, 0);
  group.add(saucer.group);

  // Cup Rim Line on Saucer
  const saucerRing = createCircleLine(0.048, 20, mats.subtleLineMaterial, 'xz');
  saucerRing.position.set(0, 0.013, 0);
  group.add(saucerRing);

  // Mug Body
  const mugGeom = new THREE.CylinderGeometry(0.04, 0.034, 0.085, 20);
  const mug = createVectorMesh(mugGeom, mats.bgMaterial, mats.lineMaterial);
  mug.group.position.set(0, 0.054, 0);
  group.add(mug.group);

  // C-Curved Ergonomic Handle
  const handleGeom = new THREE.TorusGeometry(0.024, 0.005, 8, 16, Math.PI * 1.1);
  const handle = createVectorMesh(handleGeom, mats.bgMaterial, mats.lineMaterial);
  handle.group.rotation.y = Math.PI / 2;
  handle.group.rotation.z = -Math.PI / 1.1;
  handle.group.position.set(0.042, 0.054, 0);
  group.add(handle.group);

  // Coffee Liquid Surface
  const liquidMesh = new THREE.Mesh(new THREE.CircleGeometry(0.037, 20), mats.coffeeMaterial);
  liquidMesh.rotation.x = -Math.PI / 2;
  liquidMesh.position.set(0, 0.088, 0);
  group.add(liquidMesh);

  // Liquid Concentric Ripple Rings
  const ripple1 = createCircleLine(0.024, 16, mats.subtleLineMaterial, 'xz');
  ripple1.position.set(0, 0.089, 0);
  group.add(ripple1);

  const ripple2 = createCircleLine(0.012, 12, mats.subtleLineMaterial, 'xz');
  ripple2.position.set(0, 0.089, 0);
  group.add(ripple2);

  // Steam Group (Handled dynamically by DynamicsManager)
  const steamGroup = new THREE.Group();
  group.add(steamGroup);

  tagInteractive(mug.mesh, group, {
    id: '06',
    code: 'CUP',
    name: '咖啡杯与托盘 / Coffee Mug & Saucer',
    hint: '点击观察杯中手冲咖啡表面泛起的同心涟漪',
    category: '生活器物 / Living'
  }, interactiveTargets);

  root.add(group);
  return { group, steamGroup, ripple1, ripple2 };
}

/**
 * 7. Chair (Swivel Base, 5 Casters, Stem, Seat with Stitch Lines, Curved Backrest)
 */
function buildChair(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_07_Chair';
  group.position.set(-0.7, 0, -1.45);

  // 5-Star Swivel Base
  const baseCenter = createVectorMesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 16), mats.bgMaterial, mats.lineMaterial);
  baseCenter.group.position.set(0, 0.09, 0);
  group.add(baseCenter.group);

  // 5 Radiating Arched Legs & Caster Wheels
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const legLen = 0.28;
    const endX = Math.cos(angle) * legLen;
    const endZ = Math.sin(angle) * legLen;

    const legGeom = new THREE.BoxGeometry(0.026, 0.02, legLen);
    const leg = createVectorMesh(legGeom, mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(endX / 2, 0.08, endZ / 2);
    leg.group.rotation.y = -angle + Math.PI / 2;
    group.add(leg.group);

    // Hooded Caster Wheel
    const caster = createVectorMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), mats.bgMaterial, mats.lineMaterial);
    caster.group.rotation.z = Math.PI / 2;
    caster.group.position.set(endX, 0.025, endZ);
    group.add(caster.group);
  }

  // Pneumatic Cylinder Stem
  const stem = createVectorMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 14), mats.bgMaterial, mats.lineMaterial);
  stem.group.position.set(0, 0.24, 0);
  group.add(stem.group);

  // Pneumatic Height Lever
  const lever = createVectorMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8), mats.bgMaterial, mats.lineMaterial);
  lever.group.rotation.z = Math.PI / 2;
  lever.group.position.set(0.09, 0.36, 0.06);
  group.add(lever.group);

  // Swivel Assembly (Entire upper seat and backrest rotates)
  const swivelGroup = new THREE.Group();
  swivelGroup.position.set(0, 0.42, 0);
  group.add(swivelGroup);

  // Contoured Ergonomic Seat Cushion
  const seatGeom = new THREE.BoxGeometry(0.48, 0.065, 0.46);
  const seat = createVectorMesh(seatGeom, mats.bgMaterial, mats.lineMaterial);
  seat.group.position.set(0, 0, 0);
  swivelGroup.add(seat.group);

  // Stitch Lines on Seat Cushion
  const seatStitch = createRectOutline(0.42, 0.4, mats.subtleLineMaterial, 'xz');
  seatStitch.position.set(0, 0.034, 0);
  swivelGroup.add(seatStitch);

  // Backrest Support Spine (Curved bar behind seat)
  const spineGeom = new THREE.BoxGeometry(0.04, 0.38, 0.03);
  const spine = createVectorMesh(spineGeom, mats.bgMaterial, mats.lineMaterial);
  spine.group.position.set(0, 0.22, 0.22);
  swivelGroup.add(spine.group);

  // Ergonomic Curved Lumbar Backrest
  const backGeom = new THREE.BoxGeometry(0.44, 0.34, 0.045);
  const backrest = createVectorMesh(backGeom, mats.bgMaterial, mats.lineMaterial);
  backrest.group.position.set(0, 0.36, 0.2);
  backrest.group.rotation.x = -0.1; // Gentle ergonomic recline
  swivelGroup.add(backrest.group);

  // Lumbar Seam Crease Line
  const lumbarLine = createLine([
    new THREE.Vector3(-0.18, 0.34, 0.176),
    new THREE.Vector3(0.18, 0.34, 0.176)
  ], mats.subtleLineMaterial);
  swivelGroup.add(lumbarLine);

  // Armrests (T-bar cantilever supports)
  [-0.26, 0.26].forEach(x => {
    // Upright post
    const post = createVectorMesh(new THREE.BoxGeometry(0.02, 0.18, 0.03), mats.bgMaterial, mats.lineMaterial);
    post.group.position.set(x, 0.1, 0.02);
    swivelGroup.add(post.group);

    // Padded Arm Pad
    const pad = createVectorMesh(new THREE.BoxGeometry(0.045, 0.02, 0.24), mats.bgMaterial, mats.lineMaterial);
    pad.group.position.set(x, 0.19, 0.02);
    swivelGroup.add(pad.group);
  });

  // Chair Spin State
  const chairState = {
    spinVelocity: 0,
    spin() {
      this.spinVelocity = 14.0;
    }
  };

  tagInteractive(seat.mesh, group, {
    id: '07',
    code: 'CHAIR',
    name: '人体工学转椅 / Swivel Office Chair',
    hint: '点击旋转椅子，观察五星脚轮与座面线稿',
    category: '家具器物 / Furniture',
    onClick: () => chairState.spin()
  }, interactiveTargets);

  root.add(group);
  return { group, swivelGroup, chairState };
}

/**
 * 8. Bookshelf & Books (Multi-shelf Frame, 15+ Books, Interactive Pull-out Book)
 */
function buildBookshelf(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_08_Bookshelf';
  group.position.set(2.45, 0, -3.22);

  const shelfW = 1.25;
  const shelfH = 2.4;
  const shelfD = 0.34;
  const boardThick = 0.032;

  // Left & Right Vertical Side Panels
  [-shelfW / 2 + boardThick / 2, shelfW / 2 - boardThick / 2].forEach(x => {
    const side = createVectorMesh(new THREE.BoxGeometry(boardThick, shelfH, shelfD), mats.bgMaterial, mats.lineMaterial);
    side.group.position.set(x, shelfH / 2, 0);
    group.add(side.group);
  });

  // Top Cap & Baseboard Plinth
  const topCap = createVectorMesh(new THREE.BoxGeometry(shelfW + 0.04, boardThick, shelfD + 0.02), mats.bgMaterial, mats.lineMaterial);
  topCap.group.position.set(0, shelfH - boardThick / 2, 0);
  group.add(topCap.group);

  const plinth = createVectorMesh(new THREE.BoxGeometry(shelfW, 0.08, shelfD), mats.bgMaterial, mats.lineMaterial);
  plinth.group.position.set(0, 0.04, 0);
  group.add(plinth.group);

  // Back Panel with Vertical Beadboard Grooves
  const backPanel = createVectorMesh(new THREE.BoxGeometry(shelfW - 0.06, shelfH - 0.1, 0.015), mats.bgMaterial, mats.lineMaterial);
  backPanel.group.position.set(0, shelfH / 2, -shelfD / 2 + 0.01);
  group.add(backPanel.group);

  const grooveLines = [];
  for (let gx = -shelfW / 2 + 0.12; gx <= shelfW / 2 - 0.12; gx += 0.12) {
    grooveLines.push(new THREE.Vector3(gx, 0.08, -shelfD / 2 + 0.02), new THREE.Vector3(gx, shelfH - 0.04, -shelfD / 2 + 0.02));
  }
  group.add(createLineSegments(grooveLines, mats.subtleLineMaterial));

  // 4 Horizontal Interior Shelves
  const shelfYLevels = [0.55, 1.05, 1.55, 2.0];
  shelfYLevels.forEach(y => {
    const shelf = createVectorMesh(new THREE.BoxGeometry(shelfW - boardThick * 2, boardThick, shelfD - 0.02), mats.bgMaterial, mats.lineMaterial);
    shelf.group.position.set(0, y, 0);
    group.add(shelf.group);
  });

  // Procedural Books Array (Over 18 distinct books with varying heights, spine details, titles)
  const booksContainer = new THREE.Group();
  group.add(booksContainer);

  let pullOutBookMesh = null;
  let pullOutBookGroup = null;

  // Shelf 1 (Bottom): Heavy monographs standing upright
  let currentX = -shelfW / 2 + 0.06;
  for (let i = 0; i < 7; i++) {
    const bW = 0.045 + (i % 3) * 0.01;
    const bH = 0.32 + (i % 2) * 0.04;
    const bD = 0.24 - (i % 2) * 0.02;

    const book = createVectorMesh(new THREE.BoxGeometry(bW, bH, bD), mats.bgMaterial, mats.lineMaterial);
    book.group.position.set(currentX + bW / 2, 0.08 + bH / 2, -0.02);
    booksContainer.add(book.group);

    // Spine horizontal groove lines
    const spineZ = -0.02 + bD / 2 + 0.001;
    const spineLine = createLine([
      new THREE.Vector3(currentX + 0.008, 0.08 + bH * 0.8, spineZ),
      new THREE.Vector3(currentX + bW - 0.008, 0.08 + bH * 0.8, spineZ)
    ], mats.subtleLineMaterial);
    booksContainer.add(spineLine);

    currentX += bW + 0.004;
  }

  // Shelf 2: Standing books + Interactive Pull-Out Book + Leaning books
  currentX = -shelfW / 2 + 0.08;
  for (let i = 0; i < 6; i++) {
    const bW = 0.038 + (i % 2) * 0.012;
    const bH = 0.26 + (i % 3) * 0.03;
    const bD = 0.22;

    const bookGeom = new THREE.BoxGeometry(bW, bH, bD);
    const book = createVectorMesh(bookGeom, mats.bgMaterial, mats.lineMaterial);

    if (i === 3) {
      // THE SPECIAL INTERACTIVE PULL-OUT BOOK ("Pure Line Architecture")
      pullOutBookGroup = new THREE.Group();
      pullOutBookGroup.position.set(currentX + bW / 2, 0.55 + boardThick / 2 + bH / 2, -0.02);

      const specialBook = createVectorMesh(new THREE.BoxGeometry(bW, bH, bD), mats.bgMaterial, mats.accentLineMaterial);
      specialBook.group.position.set(0, 0, 0);
      pullOutBookGroup.add(specialBook.group);

      // Spine title embossed line
      const titleLine = createLine([
        new THREE.Vector3(0, -bH * 0.28, bD / 2 + 0.002),
        new THREE.Vector3(0, bH * 0.28, bD / 2 + 0.002)
      ], mats.accentLineMaterial);
      pullOutBookGroup.add(titleLine);

      pullOutBookMesh = specialBook.mesh;
      booksContainer.add(pullOutBookGroup);
    } else {
      book.group.position.set(currentX + bW / 2, 0.55 + boardThick / 2 + bH / 2, -0.02);
      booksContainer.add(book.group);
    }
    currentX += bW + 0.004;
  }

  // 2 Leaning Books on Shelf 2
  const lean1 = createVectorMesh(new THREE.BoxGeometry(0.035, 0.25, 0.22), mats.bgMaterial, mats.lineMaterial);
  lean1.group.position.set(currentX + 0.06, 0.55 + 0.12, -0.02);
  lean1.group.rotation.z = -0.22;
  booksContainer.add(lean1.group);

  const lean2 = createVectorMesh(new THREE.BoxGeometry(0.03, 0.24, 0.21), mats.bgMaterial, mats.lineMaterial);
  lean2.group.position.set(currentX + 0.11, 0.55 + 0.11, -0.02);
  lean2.group.rotation.z = -0.22;
  booksContainer.add(lean2.group);

  // Minimalist Metal Bookend
  const bookend = createVectorMesh(new THREE.BoxGeometry(0.015, 0.16, 0.18), mats.bgMaterial, mats.lineMaterial);
  bookend.group.position.set(currentX + 0.18, 0.55 + 0.08, -0.02);
  booksContainer.add(bookend.group);

  // Shelf 3: Stack of 3 horizontal art books
  const stackBaseY = 1.05 + boardThick / 2;
  [
    { w: 0.26, h: 0.045, d: 0.28 },
    { w: 0.24, h: 0.038, d: 0.26 },
    { w: 0.22, h: 0.035, d: 0.24 }
  ].forEach((sb, idx) => {
    const stackBook = createVectorMesh(new THREE.BoxGeometry(sb.w, sb.h, sb.d), mats.bgMaterial, mats.lineMaterial);
    const y = stackBaseY + sb.h / 2 + idx * 0.042;
    stackBook.group.position.set(-0.25, y, -0.01);
    booksContainer.add(stackBook.group);
  });

  // Pull-Out Book Animation State
  const bookState = {
    isPulled: false,
    currentZ: 0,
    targetZ: 0,
    toggle() {
      this.isPulled = !this.isPulled;
      this.targetZ = this.isPulled ? 0.22 : 0;
    }
  };

  if (pullOutBookMesh) {
    tagInteractive(pullOutBookMesh, group, {
      id: '08',
      code: 'BOOKSHELF',
      name: '精装藏书《PURE LINE》 / Architectural Book',
      hint: '点击抽阅书架上的精装建筑特刊，观察书脊与纸页线构',
      category: '藏书文献 / Books',
      onClick: () => bookState.toggle()
    }, interactiveTargets);
  }

  root.add(group);
  return { group, pullOutBookGroup, bookState };
}

/**
 * 9. Storage Cabinet / Drawers (Sideboard, Upper/Lower Drawers with Handles)
 */
function buildCabinet(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_09_Cabinet';
  group.position.set(-3.18, 0, -0.5);

  const cabW = 0.52;
  const cabL = 1.45;
  const cabH = 0.82;
  const legH = 0.22;
  const bodyH = cabH - legH;

  // Cabinet Main Outer Body Box
  const bodyGeom = new THREE.BoxGeometry(cabW, bodyH, cabL);
  const body = createVectorMesh(bodyGeom, mats.bgMaterial, mats.lineMaterial);
  body.group.position.set(0, legH + bodyH / 2, 0);
  group.add(body.group);

  // 4 Mid-Century Tapered Dowel Legs with Ferrule Caps
  const legPositions = [
    { x: -cabW / 2 + 0.08, z: -cabL / 2 + 0.08 },
    { x: cabW / 2 - 0.08, z: -cabL / 2 + 0.08 },
    { x: -cabW / 2 + 0.08, z: cabL / 2 - 0.08 },
    { x: cabW / 2 - 0.08, z: cabL / 2 - 0.08 }
  ];
  legPositions.forEach(lp => {
    const leg = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.012, legH, 12), mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(lp.x, legH / 2, lp.z);
    group.add(leg.group);

    // Brass ferrule tip line
    const ferrule = createCircleLine(0.014, 12, mats.lineMaterial, 'xz');
    ferrule.position.set(lp.x, 0.04, lp.z);
    group.add(ferrule);
  });

  // Upper Sliding Drawer 1 (Left / Front side) - Interactive pull-out
  const drawerW = cabW - 0.04;
  const drawerH = 0.24;
  const drawerL = cabL / 2 - 0.04;

  const drawerPivot = new THREE.Group();
  drawerPivot.position.set(0, legH + bodyH - drawerH / 2 - 0.03, -cabL / 4);
  group.add(drawerPivot);

  const drawerFront = createVectorMesh(new THREE.BoxGeometry(drawerW, drawerH, drawerL), mats.bgMaterial, mats.lineMaterial);
  drawerPivot.add(drawerFront.group);

  // Minimalist Recessed Horizontal Handle Bar
  const handleBar = createVectorMesh(new THREE.BoxGeometry(0.02, 0.018, 0.22), mats.bgMaterial, mats.lineMaterial);
  handleBar.group.position.set(drawerW / 2 + 0.01, 0, 0);
  drawerPivot.add(handleBar.group);

  // Lower Tambour Slatted Face Lines
  const slatZLines = [];
  for (let z = -cabL / 2 + 0.05; z <= cabL / 2 - 0.05; z += 0.04) {
    slatZLines.push(
      new THREE.Vector3(cabW / 2 + 0.001, legH + 0.04, z),
      new THREE.Vector3(cabW / 2 + 0.001, legH + bodyH * 0.55, z)
    );
  }
  group.add(createLineSegments(slatZLines, mats.subtleLineMaterial));

  // Drawer Animation State
  const drawerState = {
    isOpen: false,
    currentX: 0,
    targetX: 0,
    toggle() {
      this.isOpen = !this.isOpen;
      this.targetX = this.isOpen ? 0.28 : 0;
    }
  };

  tagInteractive(drawerFront.mesh, group, {
    id: '09',
    code: 'CABINET',
    name: '收纳边柜与抽屉 / Sideboard Credenza',
    hint: '点击拉开上层收纳抽屉，观察精密滑轨与接缝线',
    category: '家具器物 / Furniture',
    onClick: () => drawerState.toggle()
  }, interactiveTargets);

  root.add(group);
  return { group, drawerPivot, drawerState };
}

/**
 * 10. Wall Clock (Circular Rim, Hour Ticks, Minute Ticks, Hour/Min/Sec Hands)
 */
function buildWallClock(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_10_WallClock';
  group.position.set(-3.37, 2.45, -0.45);

  const clockRadius = 0.25;

  // Stepped Bezel Rim
  const rimGeom = new THREE.CylinderGeometry(clockRadius, clockRadius + 0.02, 0.032, 36);
  const rim = createVectorMesh(rimGeom, mats.bgMaterial, mats.lineMaterial);
  rim.group.rotation.z = Math.PI / 2;
  group.add(rim.group);

  // Clock Face Dial (Circular occluder)
  const faceGeom = new THREE.CircleGeometry(clockRadius - 0.008, 36);
  const faceMesh = new THREE.Mesh(faceGeom, mats.bgMaterial);
  faceMesh.rotation.y = Math.PI / 2;
  faceMesh.position.set(0.017, 0, 0);
  group.add(faceMesh);

  // Hour and Minute Ticks on Face
  const hourTicks = [];
  const minTicks = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const isHour = i % 5 === 0;
    const len = isHour ? 0.038 : 0.016;
    const rOuter = clockRadius - 0.022;
    const rInner = rOuter - len;

    const z1 = Math.sin(angle) * rOuter;
    const y1 = Math.cos(angle) * rOuter;
    const z2 = Math.sin(angle) * rInner;
    const y2 = Math.cos(angle) * rInner;

    const p1 = new THREE.Vector3(0.018, y1, z1);
    const p2 = new THREE.Vector3(0.018, y2, z2);

    if (isHour) hourTicks.push(p1, p2);
    else minTicks.push(p1, p2);
  }
  group.add(createLineSegments(hourTicks, mats.lineMaterial));
  group.add(createLineSegments(minTicks, mats.subtleLineMaterial));

  // Center Pivot Pin Cap
  const pin = createVectorMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.01, 12), mats.bgMaterial, mats.lineMaterial);
  pin.group.rotation.z = Math.PI / 2;
  pin.group.position.set(0.022, 0, 0);
  group.add(pin.group);

  // Hour Hand Pivot & Needle
  const hourHandPivot = new THREE.Group();
  hourHandPivot.position.set(0.019, 0, 0);
  const hourHandLine = createLine([
    new THREE.Vector3(0, -0.02, 0),
    new THREE.Vector3(0, 0.11, 0)
  ], mats.lineMaterial);
  hourHandPivot.add(hourHandLine);
  group.add(hourHandPivot);

  // Minute Hand Pivot & Needle
  const minHandPivot = new THREE.Group();
  minHandPivot.position.set(0.02, 0, 0);
  const minHandLine = createLine([
    new THREE.Vector3(0, -0.028, 0),
    new THREE.Vector3(0, 0.165, 0)
  ], mats.lineMaterial);
  minHandPivot.add(minHandLine);
  group.add(minHandPivot);

  // Second Hand Pivot & Slender Needle
  const secHandPivot = new THREE.Group();
  secHandPivot.position.set(0.021, 0, 0);
  const secHandLine = createLine([
    new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(0, 0.18, 0)
  ], mats.accentLineMaterial);
  secHandPivot.add(secHandLine);
  group.add(secHandPivot);

  tagInteractive(faceMesh, group, {
    id: '10',
    code: 'WALL_CLOCK',
    name: '极简机械挂钟 / Minimalist Wall Clock',
    hint: '精准指针与现实时间同步静默走动',
    category: '室内陈设 / Furnishing'
  }, interactiveTargets);

  root.add(group);
  return { group, hourHandPivot, minHandPivot, secHandPivot };
}

/**
 * 11. Sofa (2-Seater Frame, Plush Cushions with Crease Lines, Backrest, Armrests, Wooden Legs)
 */
function buildSofa(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_11_Sofa';
  group.position.set(-0.4, 0, 0.8);
  group.rotation.y = Math.PI / 2;

  const sofaW = 1.76;
  const sofaD = 0.88;
  const seatH = 0.42;

  // Solid Base Platform Plinth
  const baseGeom = new THREE.BoxGeometry(sofaW, 0.12, sofaD);
  const base = createVectorMesh(baseGeom, mats.bgMaterial, mats.lineMaterial);
  base.group.position.set(0, 0.22, 0);
  group.add(base.group);

  // 4 Tapered Wooden Legs
  const legW = sofaW / 2 - 0.12;
  const legD = sofaD / 2 - 0.12;
  [
    { x: -legW, z: -legD },
    { x: legW, z: -legD },
    { x: -legW, z: legD },
    { x: legW, z: legD }
  ].forEach(p => {
    const leg = createVectorMesh(new THREE.CylinderGeometry(0.024, 0.016, 0.16, 12), mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(p.x, 0.08, p.z);
    group.add(leg.group);
  });

  // Low-Profile Backrest with Tufting Crease Lines
  const backGeom = new THREE.BoxGeometry(sofaW, 0.46, 0.18);
  const back = createVectorMesh(backGeom, mats.bgMaterial, mats.lineMaterial);
  back.group.position.set(0, 0.51, -sofaD / 2 + 0.09);
  group.add(back.group);

  // Vertical Tufting Creases on Backrest
  const tuftLines = [];
  [-0.44, 0, 0.44].forEach(tx => {
    tuftLines.push(
      new THREE.Vector3(tx, 0.32, -sofaD / 2 + 0.181),
      new THREE.Vector3(tx, 0.7, -sofaD / 2 + 0.181)
    );
  });
  group.add(createLineSegments(tuftLines, mats.subtleLineMaterial));

  // Left & Right Armrests
  const armW = 0.18;
  const armH = 0.34;
  const armD = sofaD - 0.04;
  [-sofaW / 2 + armW / 2, sofaW / 2 - armW / 2].forEach(ax => {
    const armGeom = new THREE.BoxGeometry(armW, armH, armD);
    const arm = createVectorMesh(armGeom, mats.bgMaterial, mats.lineMaterial);
    arm.group.position.set(ax, 0.45, 0.02);
    group.add(arm.group);
  });

  // Two Thick Plush Seat Cushions
  const cushionW = (sofaW - armW * 2) / 2 - 0.015;
  const cushionD = sofaD - 0.22;
  const cushionH = 0.14;
  const cushionGroup = new THREE.Group();

  [-cushionW / 2 - 0.008, cushionW / 2 + 0.008].forEach(cx => {
    const cushionGeom = new THREE.BoxGeometry(cushionW, cushionH, cushionD);
    const cushion = createVectorMesh(cushionGeom, mats.bgMaterial, mats.lineMaterial);
    cushion.group.position.set(cx, seatH - cushionH / 2 + 0.02, 0.08);
    cushionGroup.add(cushion.group);

    // Welt Piping Edge Lines
    const piping = createRectOutline(cushionW - 0.02, cushionD - 0.02, mats.subtleLineMaterial, 'xz');
    piping.position.set(cx, seatH + 0.021, 0.08);
    cushionGroup.add(piping);
  });
  group.add(cushionGroup);

  // Sofa Bounce State
  const sofaState = {
    bounceY: 0,
    targetY: 0,
    sit() {
      this.targetY = -0.04;
      setTimeout(() => { this.targetY = 0; }, 220);
    }
  };

  tagInteractive(base.mesh, group, {
    id: '11',
    code: 'SOFA',
    name: '双人布艺沙发 / 2-Seater Modern Sofa',
    hint: '点击轻触体验座面回弹与细致缝线折痕',
    category: '家具器物 / Furniture',
    onClick: () => sofaState.sit()
  }, interactiveTargets);

  root.add(group);
  return { group, cushionGroup, sofaState };
}

/**
 * 12. Pillows (Geometric Patterned Throw Cushions on Sofa)
 */
function buildPillows(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_12_Pillows';
  group.position.set(-0.4, 0, 0.8);
  group.rotation.y = Math.PI / 2; // Same orientation as sofa

  // Pillow 1 (Left Corner, Tilted)
  const p1Group = new THREE.Group();
  p1Group.position.set(-0.54, 0.52, 0.06);
  p1Group.rotation.z = 0.28;
  p1Group.rotation.y = 0.22;
  p1Group.rotation.x = -0.15;

  const p1Geom = new THREE.BoxGeometry(0.32, 0.32, 0.12);
  const p1 = createVectorMesh(p1Geom, mats.bgMaterial, mats.lineMaterial);
  p1Group.add(p1.group);

  // Chevron / Diamond Pattern Lines on Pillow 1
  const chevronLines = [
    new THREE.Vector3(0, 0.12, 0.061), new THREE.Vector3(-0.12, 0, 0.061),
    new THREE.Vector3(-0.12, 0, 0.061), new THREE.Vector3(0, -0.12, 0.061),
    new THREE.Vector3(0, -0.12, 0.061), new THREE.Vector3(0.12, 0, 0.061),
    new THREE.Vector3(0.12, 0, 0.061), new THREE.Vector3(0, 0.12, 0.061),
    new THREE.Vector3(-0.12, 0, 0.061), new THREE.Vector3(0.12, 0, 0.061),
    new THREE.Vector3(0, -0.12, 0.061), new THREE.Vector3(0, 0.12, 0.061)
  ];
  p1Group.add(createLineSegments(chevronLines, mats.subtleLineMaterial));
  group.add(p1Group);

  // Pillow 2 (Right Corner, Tilted)
  const p2Group = new THREE.Group();
  p2Group.position.set(0.54, 0.52, 0.06);
  p2Group.rotation.z = -0.25;
  p2Group.rotation.y = -0.2;
  p2Group.rotation.x = -0.15;

  const p2Geom = new THREE.BoxGeometry(0.3, 0.3, 0.11);
  const p2 = createVectorMesh(p2Geom, mats.bgMaterial, mats.lineMaterial);
  p2Group.add(p2.group);

  // Concentric Diamond Lines on Pillow 2
  const diamondLines = [
    new THREE.Vector3(0, 0.09, 0.056), new THREE.Vector3(-0.09, 0, 0.056),
    new THREE.Vector3(-0.09, 0, 0.056), new THREE.Vector3(0, -0.09, 0.056),
    new THREE.Vector3(0, -0.09, 0.056), new THREE.Vector3(0.09, 0, 0.056),
    new THREE.Vector3(0.09, 0, 0.056), new THREE.Vector3(0, 0.09, 0.056)
  ];
  p2Group.add(createLineSegments(diamondLines, mats.subtleLineMaterial));
  group.add(p2Group);

  tagInteractive(p1.mesh, group, {
    id: '12',
    code: 'PILLOWS',
    name: '几何纹理抱枕 / Geometric Pillows',
    hint: '点击拍打抱枕，欣赏表面织造的包豪斯菱格纹理',
    category: '室内陈设 / Furnishing'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 13. Coffee Table (Minimalist Low Table, Wireframe Legs, Magazine & Tray on Top)
 */
function buildCoffeeTable(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_13_CoffeeTable';
  group.position.set(0.55, 0, 0.8);
  group.rotation.y = Math.PI / 2;

  const tableW = 1.05;
  const tableD = 0.54;
  const tableH = 0.38;

  // Solid Table Top
  const topGeom = new THREE.BoxGeometry(tableW, 0.032, tableD);
  const tabletop = createVectorMesh(topGeom, mats.bgMaterial, mats.lineMaterial);
  tabletop.group.position.set(0, tableH - 0.016, 0);
  group.add(tabletop.group);

  // Wireframe Hairpin Legs (4 Corners)
  const legOffsetX = tableW / 2 - 0.08;
  const legOffsetZ = tableD / 2 - 0.08;
  [
    { x: -legOffsetX, z: -legOffsetZ },
    { x: legOffsetX, z: -legOffsetZ },
    { x: -legOffsetX, z: legOffsetZ },
    { x: legOffsetX, z: legOffsetZ }
  ].forEach(p => {
    // Looped hairpin wireframe rod
    const legPts = [
      new THREE.Vector3(p.x, tableH - 0.032, p.z - 0.02),
      new THREE.Vector3(p.x * 0.95, 0.01, p.z * 0.95),
      new THREE.Vector3(p.x, tableH - 0.032, p.z + 0.02)
    ];
    group.add(createLine(legPts, mats.lineMaterial));
  });

  // Tray with Raised Rim on Table
  const tray = createVectorMesh(new THREE.BoxGeometry(0.34, 0.018, 0.24), mats.bgMaterial, mats.lineMaterial);
  tray.group.position.set(-0.2, tableH + 0.009, 0.02);
  group.add(tray.group);

  // Glass Carafe / Decanter on Tray
  const carafeGeom = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 16);
  const carafe = createVectorMesh(carafeGeom, mats.bgMaterial, mats.lineMaterial);
  carafe.group.position.set(-0.26, tableH + 0.088, 0.02);
  group.add(carafe.group);

  // Decanter Neck & Rim
  const neck = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.024, 0.04, 12), mats.bgMaterial, mats.lineMaterial);
  neck.group.position.set(-0.26, tableH + 0.178, 0.02);
  group.add(neck.group);

  // Open Architecture Magazines on Table
  const mag1 = createVectorMesh(new THREE.BoxGeometry(0.26, 0.01, 0.19), mats.bgMaterial, mats.lineMaterial);
  mag1.group.position.set(0.22, tableH + 0.005, -0.04);
  mag1.group.rotation.y = 0.14;
  group.add(mag1.group);

  const mag2 = createVectorMesh(new THREE.BoxGeometry(0.24, 0.01, 0.18), mats.bgMaterial, mats.lineMaterial);
  mag2.group.position.set(0.25, tableH + 0.015, 0.04);
  mag2.group.rotation.y = -0.22;
  group.add(mag2.group);

  // Magazine cover page layout lines
  const pageLine = createLine([
    new THREE.Vector3(0.18, tableH + 0.021, 0.02),
    new THREE.Vector3(0.31, tableH + 0.021, 0.02)
  ], mats.subtleLineMaterial);
  mag2.group.add(pageLine);

  tagInteractive(tabletop.mesh, group, {
    id: '13',
    code: 'COFFEE_TABLE',
    name: '极简发夹腿茶几 / Wireframe Coffee Table',
    hint: '纤细钢丝腿几面，陈列玻璃水器与现代设计刊物',
    category: '家具器物 / Furniture'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 14. Rug (Large Floor Area Rug with Intricate Geometric Vector Pattern & Edge Fringes)
 */
function buildRug(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_14_Rug';
  group.position.set(0.1, 0.002, 0.8);

  const rugW = 2.4;
  const rugD = 2.2;

  // Thin occluding floor rug mesh
  const rugGeom = new THREE.BoxGeometry(rugW, 0.004, rugD);
  const rug = createVectorMesh(rugGeom, mats.bgMaterial, mats.lineMaterial);
  group.add(rug.group);

  // Outer Border Double Perimeter Line
  const outerBorder = createRectOutline(rugW - 0.14, rugD - 0.14, mats.lineMaterial, 'xz');
  outerBorder.position.set(0, 0.003, 0);
  group.add(outerBorder);

  const innerBorder = createRectOutline(rugW - 0.26, rugD - 0.26, mats.subtleLineMaterial, 'xz');
  innerBorder.position.set(0, 0.003, 0);
  group.add(innerBorder);

  // Intricate Central Geometric Bauhaus Motif (Concentric Diamonds & Diagonal Grid)
  const patternLines = [];
  // Central concentric diamonds
  [0.75, 0.5, 0.25].forEach(r => {
    patternLines.push(
      new THREE.Vector3(0, 0.003, -r), new THREE.Vector3(r * 1.3, 0.003, 0),
      new THREE.Vector3(r * 1.3, 0.003, 0), new THREE.Vector3(0, 0.003, r),
      new THREE.Vector3(0, 0.003, r), new THREE.Vector3(-r * 1.3, 0.003, 0),
      new THREE.Vector3(-r * 1.3, 0.003, 0), new THREE.Vector3(0, 0.003, -r)
    );
  });

  // Corner diagonal fretwork lines
  [-rugW / 2 + 0.35, rugW / 2 - 0.35].forEach(cx => {
    [-rugD / 2 + 0.35, rugD / 2 - 0.35].forEach(cz => {
      patternLines.push(
        new THREE.Vector3(cx - 0.2, 0.003, cz), new THREE.Vector3(cx + 0.2, 0.003, cz),
        new THREE.Vector3(cx, 0.003, cz - 0.2), new THREE.Vector3(cx, 0.003, cz + 0.2)
      );
    });
  });
  group.add(createLineSegments(patternLines, mats.subtleLineMaterial));

  // Edge Fringes (40+ individual tassel lines on left and right borders)
  const fringeLines = [];
  const fringeLen = 0.055;
  const fringeCount = 36;
  for (let i = 0; i <= fringeCount; i++) {
    const z = -rugD / 2 + (i / fringeCount) * rugD;
    // Left fringe
    fringeLines.push(new THREE.Vector3(-rugW / 2, 0.002, z), new THREE.Vector3(-rugW / 2 - fringeLen, 0.002, z));
    // Right fringe
    fringeLines.push(new THREE.Vector3(rugW / 2, 0.002, z), new THREE.Vector3(rugW / 2 + fringeLen, 0.002, z));
  }
  group.add(createLineSegments(fringeLines, mats.lineMaterial));

  tagInteractive(rug.mesh, group, {
    id: '14',
    code: 'RUG',
    name: '几何编织羊毛地毯 / Geometric Area Rug',
    hint: '包豪斯几何图腾密织羊毛地毯，两侧带细致手工流苏',
    category: '室内陈设 / Furnishing'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 15. Record Player / Turntable (Wood Plinth, Metal Platter, Vinyl with Grooves, Tonearm, Knobs)
 */
function buildRecordPlayer(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_15_RecordPlayer';
  group.position.set(-3.18, 0.82, -0.45);

  const plinthW = 0.38;
  const plinthL = 0.46;
  const plinthH = 0.06;

  // Solid Wood Plinth
  const plinth = createVectorMesh(new THREE.BoxGeometry(plinthW, plinthH, plinthL), mats.bgMaterial, mats.lineMaterial);
  plinth.group.position.set(0, plinthH / 2, 0);
  group.add(plinth.group);

  // Anti-Vibration Rubber Feet
  [
    { x: -plinthW / 2 + 0.04, z: -plinthL / 2 + 0.04 },
    { x: plinthW / 2 - 0.04, z: -plinthL / 2 + 0.04 },
    { x: -plinthW / 2 + 0.04, z: plinthL / 2 - 0.04 },
    { x: plinthW / 2 - 0.04, z: plinthL / 2 - 0.04 }
  ].forEach(p => {
    const foot = createVectorMesh(new THREE.CylinderGeometry(0.016, 0.014, 0.012, 12), mats.bgMaterial, mats.lineMaterial);
    foot.group.position.set(p.x, -0.006, p.z);
    group.add(foot.group);
  });

  // Circular Turntable Platter (Rotates when playing)
  const turntablePlatter = new THREE.Group();
  turntablePlatter.position.set(0, plinthH + 0.012, -0.04);
  group.add(turntablePlatter);

  const platterMesh = createVectorMesh(new THREE.CylinderGeometry(0.145, 0.145, 0.016, 32), mats.bgMaterial, mats.lineMaterial);
  turntablePlatter.add(platterMesh.group);

  // Vinyl Record with Multiple Concentric Micro-Grooves
  const vinylDisc = createVectorMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.004, 32), mats.bgMaterial, mats.lineMaterial);
  vinylDisc.group.position.set(0, 0.01, 0);
  turntablePlatter.add(vinylDisc.group);

  // Micro-Groove Circles on Vinyl Surface
  [0.13, 0.118, 0.106, 0.094, 0.082, 0.07].forEach(r => {
    const groove = createCircleLine(r, 32, mats.subtleLineMaterial, 'xz');
    groove.position.set(0, 0.013, 0);
    turntablePlatter.add(groove);
  });

  // Center Record Label with Spindle Pin
  const labelCircle = createCircleLine(0.048, 24, mats.accentLineMaterial, 'xz');
  labelCircle.position.set(0, 0.013, 0);
  turntablePlatter.add(labelCircle);

  const spindle = createVectorMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 10), mats.bgMaterial, mats.lineMaterial);
  spindle.group.position.set(0, 0.015, 0);
  turntablePlatter.add(spindle.group);

  // S-Shaped Tonearm Assembly with Pivot Base
  const tonearmPivot = new THREE.Group();
  tonearmPivot.position.set(plinthW / 2 - 0.065, plinthH + 0.02, 0.14);
  group.add(tonearmPivot);

  // Gimbal Tower Base
  const gimbal = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 14), mats.bgMaterial, mats.lineMaterial);
  tonearmPivot.add(gimbal.group);

  // Tonearm Bar (S-curved spline polyline)
  const armPivotHead = new THREE.Group();
  armPivotHead.position.set(0, 0.02, 0);
  tonearmPivot.add(armPivotHead);

  // Counterweight
  const counterweight = createVectorMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.026, 12), mats.bgMaterial, mats.lineMaterial);
  counterweight.group.rotation.x = Math.PI / 2;
  counterweight.group.position.set(0, 0, 0.03);
  armPivotHead.add(counterweight.group);

  // S-Curve Arm Tube
  const armTubePts = [
    new THREE.Vector3(0, 0, 0.02),
    new THREE.Vector3(0, 0, -0.06),
    new THREE.Vector3(-0.02, 0, -0.12),
    new THREE.Vector3(-0.01, 0, -0.18),
    new THREE.Vector3(-0.025, -0.015, -0.21)
  ];
  armPivotHead.add(createLine(armTubePts, mats.lineMaterial));

  // Headshell & Stylus Needle
  const headshell = createVectorMesh(new THREE.BoxGeometry(0.014, 0.012, 0.028), mats.bgMaterial, mats.lineMaterial);
  headshell.group.position.set(-0.025, -0.015, -0.22);
  armPivotHead.add(headshell.group);

  // Turntable Knobs & Pitch Slider
  const knob1 = createVectorMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), mats.bgMaterial, mats.lineMaterial);
  knob1.group.position.set(-plinthW / 2 + 0.06, plinthH + 0.005, 0.16);
  group.add(knob1.group);

  const knob2 = createVectorMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 10), mats.bgMaterial, mats.lineMaterial);
  knob2.group.position.set(-plinthW / 2 + 0.1, plinthH + 0.005, 0.16);
  group.add(knob2.group);

  // Playback Animation State
  const turntableState = {
    isPlaying: false,
    rpmSpeed: 0,
    targetAngle: 0, // 0 = parked rest, 0.42 = active on vinyl
    currentAngle: 0,
    toggle() {
      this.isPlaying = !this.isPlaying;
      this.targetAngle = this.isPlaying ? 0.42 : 0;
    }
  };

  tagInteractive(plinth.mesh, group, {
    id: '15',
    code: 'RECORD_PLAYER',
    name: '复古黑胶唱机 / Turntable Record Player',
    hint: '点击落针播放黑胶唱片，观察唱盘微缝与唱臂旋转',
    category: '生活器物 / Living',
    onClick: () => turntableState.toggle()
  }, interactiveTargets);

  // Also make the platter interactive
  platterMesh.mesh.userData = plinth.mesh.userData;
  interactiveTargets.push(platterMesh.mesh);

  root.add(group);
  return { group, turntablePlatter, armPivotHead, turntableState };
}

/**
 * 16. Wall Art / Painting (Framed Wall Prints, Hanging Cord, Switchable Artwork Designs)
 */
function buildWallArt(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_16_WallArt';
  group.position.set(1.11, 2.15, -3.37);

  const artW = 0.82;
  const artH = 1.15;

  // Outer Gallery Wood Frame
  const frameGeom = new THREE.BoxGeometry(artW, artH, 0.038);
  const frame = createVectorMesh(frameGeom, mats.bgMaterial, mats.lineMaterial);
  group.add(frame.group);

  // Mat Board (Passe-partout)
  const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(artW - 0.12, artH - 0.12), mats.bgMaterial);
  matMesh.position.set(0, 0, 0.02);
  group.add(matMesh);

  // Inner Picture Window Border
  const innerMatLine = createRectOutline(artW - 0.24, artH - 0.24, mats.lineMaterial, 'xy');
  innerMatLine.position.set(0, 0, 0.021);
  group.add(innerMatLine);

  // Hanging Wire Cord & Wall Nail Hook above frame
  const wirePts = [
    new THREE.Vector3(-artW * 0.35, artH / 2, 0.015),
    new THREE.Vector3(0, artH / 2 + 0.18, 0.015),
    new THREE.Vector3(artW * 0.35, artH / 2, 0.015)
  ];
  group.add(createLine(wirePts, mats.lineMaterial));

  const nail = createVectorMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10), mats.bgMaterial, mats.lineMaterial);
  nail.group.rotation.x = Math.PI / 2;
  nail.group.position.set(0, artH / 2 + 0.18, 0.015);
  group.add(nail.group);

  // Switchable Artwork Container (Contains 3 distinct vector art designs)
  const artworkGroup = new THREE.Group();
  artworkGroup.position.set(0, 0, 0.022);
  group.add(artworkGroup);

  // Art 1: "Bauhaus Modernism" - Intersecting Circles & Geometric Equilibrium
  const art1 = new THREE.Group();
  art1.add(createCircleLine(0.24, 32, mats.accentLineMaterial, 'xy'));
  art1.add(createCircleLine(0.14, 24, mats.lineMaterial, 'xy'));
  art1.add(createRectOutline(0.36, 0.52, mats.lineMaterial, 'xy'));
  art1.add(createLine([new THREE.Vector3(-0.3, -0.35, 0), new THREE.Vector3(0.3, 0.35, 0)], mats.subtleLineMaterial));
  art1.add(createLine([new THREE.Vector3(-0.25, 0.1, 0), new THREE.Vector3(0.25, 0.1, 0)], mats.lineMaterial));
  artworkGroup.add(art1);

  // Art 2: "Topographic Wave" - Flowing Contour Elevation Lines
  const art2 = new THREE.Group();
  art2.visible = false;
  for (let w = -5; w <= 5; w++) {
    const wavePts = [];
    const baseY = w * 0.07;
    for (let x = -0.32; x <= 0.32; x += 0.04) {
      const y = baseY + Math.sin(x * 6 + w * 0.4) * 0.04;
      wavePts.push(new THREE.Vector3(x, y, 0));
    }
    art2.add(createLine(wavePts, w === 0 ? mats.accentLineMaterial : mats.subtleLineMaterial));
  }
  artworkGroup.add(art2);

  // Art 3: "Axonometric Blueprint" - Architectural Isometric Wireframe Projection
  const art3 = new THREE.Group();
  art3.visible = false;
  const isoBoxGeom = new THREE.BoxGeometry(0.26, 0.38, 0.26);
  const isoLines = new THREE.LineSegments(new THREE.EdgesGeometry(isoBoxGeom), mats.accentLineMaterial);
  isoLines.rotation.x = Math.PI / 6;
  isoLines.rotation.y = Math.PI / 4;
  art3.add(isoLines);
  art3.add(createCircleLine(0.32, 32, mats.subtleLineMaterial, 'xy'));
  artworkGroup.add(art3);

  const artworks = [art1, art2, art3];
  let currentArtIdx = 0;

  function cycleArtwork() {
    artworks[currentArtIdx].visible = false;
    currentArtIdx = (currentArtIdx + 1) % artworks.length;
    artworks[currentArtIdx].visible = true;
  }

  tagInteractive(frame.mesh, group, {
    id: '16',
    code: 'WALL_ART',
    name: '画廊艺术挂画 / Framed Gallery Art',
    hint: '点击画框切换展出的三种现代主义矢量线稿艺术画作',
    category: '艺术陈列 / Art',
    onClick: cycleArtwork
  }, interactiveTargets);

  root.add(group);
  return { group, artworkGroup, cycleArtwork };
}

/**
 * 17. Globe (Circular Meridian Ring, Tilted Axis, Pedestal Base, Continent Contours)
 */
function buildGlobe(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_17_Globe';
  group.position.set(-3.18, 0.82, 0.16);

  const globeRadius = 0.13;
  const totalBaseH = 0.14;

  // Turned Wooden Round Pedestal Base
  const base1 = createVectorMesh(new THREE.CylinderGeometry(0.08, 0.09, 0.024, 20), mats.bgMaterial, mats.lineMaterial);
  base1.group.position.set(0, 0.012, 0);
  group.add(base1.group);

  const stem = createVectorMesh(new THREE.CylinderGeometry(0.016, 0.024, 0.12, 14), mats.bgMaterial, mats.lineMaterial);
  stem.group.position.set(0, 0.07, 0);
  group.add(stem.group);

  // Meridian C-Arc Ring (Tilted at 23.5° Earth axis)
  const meridianPivot = new THREE.Group();
  meridianPivot.position.set(0, totalBaseH + globeRadius, 0);
  group.add(meridianPivot);

  // C-Shaped Semi-Meridian Arch
  const meridianGeom = new THREE.TorusGeometry(globeRadius + 0.02, 0.008, 8, 32, Math.PI * 1.15);
  const meridianRing = createVectorMesh(meridianGeom, mats.bgMaterial, mats.lineMaterial);
  meridianRing.group.rotation.z = -Math.PI / 2.3;
  meridianPivot.add(meridianRing.group);

  // 23.5° Tilted Axis Spindle
  const earthAxisTilt = (23.5 * Math.PI) / 180;
  const sphereAxisPivot = new THREE.Group();
  sphereAxisPivot.rotation.z = earthAxisTilt;
  meridianPivot.add(sphereAxisPivot);

  // Globe Occluding Sphere
  const globeSphere = createVectorMesh(new THREE.SphereGeometry(globeRadius, 24, 24), mats.bgMaterial, mats.lineMaterial);
  sphereAxisPivot.add(globeSphere.group);

  // Procedural Continental Contours & Longitude / Latitude Rings
  const worldLinesGroup = new THREE.Group();
  sphereAxisPivot.add(worldLinesGroup);

  // Equator, Tropics, and Polar Circles
  worldLinesGroup.add(createCircleLine(globeRadius + 0.001, 32, mats.accentLineMaterial, 'xz'));
  [0.055, -0.055].forEach(y => {
    const r = Math.sqrt(globeRadius * globeRadius - y * y);
    const tropic = createCircleLine(r + 0.001, 24, mats.subtleLineMaterial, 'xz');
    tropic.position.set(0, y, 0);
    worldLinesGroup.add(tropic);
  });

  // Longitude Meridians
  for (let m = 0; m < 4; m++) {
    const meridian = createCircleLine(globeRadius + 0.001, 32, mats.subtleLineMaterial, 'xy');
    meridian.rotation.y = (m / 4) * Math.PI;
    worldLinesGroup.add(meridian);
  }

  // Stylized Vector Continental Outlines (Americas, Eurasia, Africa)
  const continentLines = [
    // Eurasia / Africa outline
    new THREE.Vector3(0.06, 0.08, 0.09), new THREE.Vector3(0.09, 0.04, 0.07),
    new THREE.Vector3(0.09, 0.04, 0.07), new THREE.Vector3(0.08, -0.06, 0.07),
    new THREE.Vector3(0.08, -0.06, 0.07), new THREE.Vector3(0.03, -0.09, 0.08),
    new THREE.Vector3(0.03, -0.09, 0.08), new THREE.Vector3(0.02, 0.02, 0.12),
    new THREE.Vector3(0.02, 0.02, 0.12), new THREE.Vector3(0.06, 0.08, 0.09),
    // Americas outline
    new THREE.Vector3(-0.08, 0.09, 0.06), new THREE.Vector3(-0.06, 0.03, 0.1),
    new THREE.Vector3(-0.06, 0.03, 0.1), new THREE.Vector3(-0.08, -0.06, 0.08),
    new THREE.Vector3(-0.08, -0.06, 0.08), new THREE.Vector3(-0.05, -0.09, 0.07),
    new THREE.Vector3(-0.05, -0.09, 0.07), new THREE.Vector3(-0.1, 0.01, 0.06),
    new THREE.Vector3(-0.1, 0.01, 0.06), new THREE.Vector3(-0.08, 0.09, 0.06)
  ];
  worldLinesGroup.add(createLineSegments(continentLines, mats.lineMaterial));

  // Globe Spin State
  const globeState = {
    spinVelocity: 0,
    spin() {
      this.spinVelocity = 12.0;
    }
  };

  tagInteractive(globeSphere.mesh, group, {
    id: '17',
    code: 'GLOBE',
    name: '复古桌面地球仪 / Desktop Globe',
    hint: '点击拨动地球仪，观察沿 23.5° 地轴旋转的经纬线网',
    category: '藏书文献 / Books',
    onClick: () => globeState.spin()
  }, interactiveTargets);

  root.add(group);
  return { group, worldLinesGroup, sphereAxisPivot, globeState };
}

/**
 * 18. Ceiling Fan (Ceiling Canopy, Downrod, Motor Housing, 3 Aerodynamic Blades, Pull Chain)
 */
function buildCeilingFan(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_18_CeilingFan';
  group.position.set(0, 3.48, 0);

  // Ceiling Mounting Canopy
  const canopy = createVectorMesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 20), mats.bgMaterial, mats.lineMaterial);
  canopy.group.position.set(0, -0.03, 0);
  group.add(canopy.group);

  // Downrod Suspension Tube
  const rodLen = 0.38;
  const downrod = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen, 12), mats.bgMaterial, mats.lineMaterial);
  downrod.group.position.set(0, -0.06 - rodLen / 2, 0);
  group.add(downrod.group);

  // Rotating Assembly (Motor Housing + Blades)
  const fanRotor = new THREE.Group();
  fanRotor.position.set(0, -0.06 - rodLen, 0);
  group.add(fanRotor);

  // Cylindrical Motor Housing with Cooling Vents
  const motorGeom = new THREE.CylinderGeometry(0.18, 0.16, 0.12, 24);
  const motor = createVectorMesh(motorGeom, mats.bgMaterial, mats.lineMaterial);
  fanRotor.add(motor.group);

  // Vent Slot Lines around motor
  const ventLines = [];
  for (let v = 0; v < 16; v++) {
    const angle = (v / 16) * Math.PI * 2;
    const r = 0.181;
    ventLines.push(
      new THREE.Vector3(Math.cos(angle) * r, -0.03, Math.sin(angle) * r),
      new THREE.Vector3(Math.cos(angle) * r, 0.03, Math.sin(angle) * r)
    );
  }
  fanRotor.add(createLineSegments(ventLines, mats.subtleLineMaterial));

  // 3 Aerodynamic Wooden Blades (120° apart)
  const bladeCount = 3;
  const bladeLen = 0.58;
  const bladeW = 0.13;
  for (let b = 0; b < bladeCount; b++) {
    const bAngle = (b / bladeCount) * Math.PI * 2;
    const bladeArm = new THREE.Group();
    bladeArm.rotation.y = bAngle;

    // Metal Mounting Iron Bracket with Rivet Lines
    const bracket = createVectorMesh(new THREE.BoxGeometry(0.08, 0.014, 0.05), mats.bgMaterial, mats.lineMaterial);
    bracket.group.position.set(0.18, 0, 0);
    bladeArm.add(bracket.group);

    // Paddle Blade with Aerodynamic Pitch Tilt
    const bladeGeom = new THREE.BoxGeometry(bladeLen, 0.012, bladeW);
    const blade = createVectorMesh(bladeGeom, mats.bgMaterial, mats.lineMaterial);
    blade.group.position.set(0.18 + bladeLen / 2, 0, 0);
    blade.group.rotation.x = 0.18; // Pitch angle
    bladeArm.add(blade.group);

    fanRotor.add(bladeArm);
  }

  // Dangling Center Pull Chain with Wooden Fob Bead
  const chainPts = [
    new THREE.Vector3(0, -0.06 - rodLen - 0.06, 0),
    new THREE.Vector3(0, -0.06 - rodLen - 0.42, 0)
  ];
  group.add(createLine(chainPts, mats.lineMaterial));

  const fob = createVectorMesh(new THREE.CylinderGeometry(0.01, 0.007, 0.045, 10), mats.bgMaterial, mats.lineMaterial);
  fob.group.position.set(0, -0.06 - rodLen - 0.44, 0);
  group.add(fob.group);

  // Fan Speed State
  const fanState = {
    speedMode: 1, // 0: Off, 1: Low, 2: High
    speeds: [0, 2.5, 6.0],
    toggle() {
      this.speedMode = (this.speedMode + 1) % this.speeds.length;
    }
  };

  tagInteractive(fob.mesh, group, {
    id: '18',
    code: 'CEILING_FAN',
    name: '三叶吊扇 / Aerodynamic Ceiling Fan',
    hint: '点击拉动悬垂珠链，切换吊扇转速或停止送风',
    category: '室内陈设 / Furnishing',
    onClick: () => fanState.toggle()
  }, interactiveTargets);

  // Also make the motor housing interactive
  motor.mesh.userData = fob.mesh.userData;
  interactiveTargets.push(motor.mesh);

  root.add(group);
  return { group, fanRotor, fanState };
}

/**
 * 19. Wind Chime (Top Wooden Hanger, 5 Tubular Chimes of Graduated Lengths, Clapper, Wind Sail)
 */
function buildWindChime(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_19_WindChime';
  group.position.set(0.53, 3.12, -3.20);

  // Top Suspension String from Ceiling
  group.add(createLine([
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(0, 0, 0)
  ], mats.lineMaterial));

  // Top Round Wooden Hanger Disc
  const hanger = createVectorMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.014, 20), mats.bgMaterial, mats.lineMaterial);
  group.add(hanger.group);

  // Harmonic Pendulum Assembly (Swings naturally in breeze)
  const chimePivot = new THREE.Group();
  group.add(chimePivot);

  // 5 Tubular Chimes of Graduated Lengths
  const tubeCount = 5;
  const tubeRadius = 0.045;
  const tubeLengths = [0.24, 0.29, 0.34, 0.40, 0.46];

  for (let i = 0; i < tubeCount; i++) {
    const angle = (i / tubeCount) * Math.PI * 2;
    const tx = Math.cos(angle) * tubeRadius;
    const tz = Math.sin(angle) * tubeRadius;
    const len = tubeLengths[i];

    // Suspension Cord
    chimePivot.add(createLine([
      new THREE.Vector3(tx, -0.007, tz),
      new THREE.Vector3(tx, -0.08, tz)
    ], mats.subtleLineMaterial));

    // Metallic Hollow Tube
    const tubeGeom = new THREE.CylinderGeometry(0.008, 0.008, len, 12, 1, true);
    const tube = createVectorMesh(tubeGeom, mats.bgMaterial, mats.lineMaterial);
    tube.group.position.set(tx, -0.08 - len / 2, tz);
    chimePivot.add(tube.group);
  }

  // Central Cord
  chimePivot.add(createLine([
    new THREE.Vector3(0, -0.007, 0),
    new THREE.Vector3(0, -0.62, 0)
  ], mats.lineMaterial));

  // Central Wooden Clapper / Striker Disc (hangs in center of tubes)
  const clapper = createVectorMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 16), mats.bgMaterial, mats.lineMaterial);
  clapper.group.position.set(0, -0.26, 0);
  chimePivot.add(clapper.group);

  // Wind Sail / Catcher Pendant at the Bottom
  const sail = createVectorMesh(new THREE.BoxGeometry(0.045, 0.085, 0.006), mats.bgMaterial, mats.lineMaterial);
  sail.group.position.set(0, -0.66, 0);
  chimePivot.add(sail.group);

  // Chime Gentle Sway State
  const chimeState = {
    swayImpulse: 0,
    chime() {
      this.swayImpulse = 1.6;
    }
  };

  tagInteractive(sail.mesh, group, {
    id: '19',
    code: 'WIND_CHIME',
    name: '五音金属风铃 / Harmonic Wind Chime',
    hint: '点击轻拂风铃，聆听微风中空灵悠扬的金属余韵',
    category: '生活器物 / Living',
    onClick: () => chimeState.chime()
  }, interactiveTargets);

  root.add(group);
  return { group, chimePivot, chimeState };
}

/**
 * 20. Light Switch (Dual Rocker Wall Switch Plate, Toggle Paddles, Screws)
 */
function buildLightSwitch(root, mats, interactiveTargets, callbacks) {
  const group = new THREE.Group();
  group.name = 'Item_20_LightSwitch';
  group.position.set(-3.37, 1.35, 0.85);

  const plateW = 0.085;
  const plateH = 0.13;
  const plateD = 0.012;

  // Beveled Wall Switch Faceplate
  const plateGeom = new THREE.BoxGeometry(plateD, plateH, plateW);
  const plate = createVectorMesh(plateGeom, mats.bgMaterial, mats.lineMaterial);
  group.add(plate.group);

  // Slotted Mounting Screws (Top and Bottom)
  [0.05, -0.05].forEach(sy => {
    const screwCircle = createCircleLine(0.004, 10, mats.lineMaterial, 'zy');
    screwCircle.position.set(plateD / 2 + 0.001, sy, 0);
    group.add(screwCircle);

    // Slot Line
    const slot = createLine([
      new THREE.Vector3(plateD / 2 + 0.002, sy - 0.003, 0),
      new THREE.Vector3(plateD / 2 + 0.002, sy + 0.003, 0)
    ], mats.lineMaterial);
    group.add(slot);
  });

  // Dual Rocker Paddles:
  // Rocker 1 (Left / Front): Toggles Desk Lamp Spotlight
  // Rocker 2 (Right / Back): Toggles Day / Night Room Mode
  const rockerW = 0.024;
  const rockerH = 0.048;

  const rocker1Pivot = new THREE.Group();
  rocker1Pivot.position.set(plateD / 2 + 0.004, 0, -0.018);
  const rocker1 = createVectorMesh(new THREE.BoxGeometry(0.008, rockerH, rockerW), mats.bgMaterial, mats.lineMaterial);
  rocker1Pivot.add(rocker1.group);
  rocker1Pivot.rotation.z = -0.15; // default ON
  group.add(rocker1Pivot);

  const rocker2Pivot = new THREE.Group();
  rocker2Pivot.position.set(plateD / 2 + 0.004, 0, 0.018);
  const rocker2 = createVectorMesh(new THREE.BoxGeometry(0.008, rockerH, rockerW), mats.bgMaterial, mats.lineMaterial);
  rocker2Pivot.add(rocker2.group);
  rocker2Pivot.rotation.z = -0.15; // default Day
  group.add(rocker2Pivot);

  const switchState = {
    lampActive: true,
    nightActive: false,
    toggleSwitch() {
      this.nightActive = !this.nightActive;
      rocker2Pivot.rotation.z = this.nightActive ? 0.15 : -0.15;
      if (callbacks && callbacks.onToggleTheme) {
        callbacks.onToggleTheme(this.nightActive);
      }
    }
  };

  tagInteractive(plate.mesh, group, {
    id: '20',
    code: 'LIGHT_SWITCH',
    name: '双联墙面开关 / Dual Rocker Switch',
    hint: '点击按动开关，切换昼夜采光模式与室内灯效',
    category: '建筑构件 / Architectural',
    onClick: () => switchState.toggleSwitch()
  }, interactiveTargets);

  // Also make rockers clickable
  rocker1.mesh.userData = plate.mesh.userData;
  rocker2.mesh.userData = plate.mesh.userData;
  interactiveTargets.push(rocker1.mesh, rocker2.mesh);

  root.add(group);
  return { group, rocker1Pivot, rocker2Pivot, switchState };
}

// =========================================================================
// CATALOG DATA FOR MODAL UI (All 20+ Items Bilingual Info)
// =========================================================================
const ROOM_CATALOG = [
  { id: '01', code: 'DOOR', name: '平开木门 / Wooden Door', hint: '点击推拉开关木门，感受线稿空间的虚实开合', category: '建筑构件 / Architectural' },
  { id: '02', code: 'WINDOW', name: '建筑景观窗 / Architectural Window', hint: '点击远眺窗外群山、日月与飞鸟的矢量全景', category: '建筑构件 / Architectural' },
  { id: '03', code: 'BLINDS', name: '百叶窗帘 / Venetian Blinds', hint: '点击拉绳调节百叶片倾角，控制室外采光入界', category: '室内陈设 / Furnishing' },
  { id: '04', code: 'DESK', name: '实木工作台 / Solid Wood Desk', hint: '极简北欧实木桌，配有皮质桌垫与精密绘图工具', category: '家具器物 / Furniture' },
  { id: '05', code: 'DESK_LAMP', name: '铰接绘图台灯 / Drafting Lamp', hint: '点击开关台灯，点亮工作台上的聚焦光锥', category: '室内陈设 / Furnishing' },
  { id: '06', code: 'CUP', name: '咖啡杯与托盘 / Coffee Mug & Saucer', hint: '点击观察杯中手冲咖啡表面泛起的同心涟漪', category: '生活器物 / Living' },
  { id: '07', code: 'CHAIR', name: '人体工学转椅 / Swivel Office Chair', hint: '点击旋转椅子，观察五星脚轮与座面线稿', category: '家具器物 / Furniture' },
  { id: '08', code: 'BOOKSHELF', name: '建筑书架与藏书 / Bookshelf & Books', hint: '点击抽阅书架上的精装建筑特刊，观察书脊与纸页线构', category: '藏书文献 / Books' },
  { id: '09', code: 'CABINET', name: '收纳边柜与抽屉 / Sideboard Credenza', hint: '点击拉开上层收纳抽屉，观察精密滑轨与接缝线', category: '家具器物 / Furniture' },
  { id: '10', code: 'WALL_CLOCK', name: '极简机械挂钟 / Minimalist Wall Clock', hint: '精准指针与现实时间同步静默走动', category: '室内陈设 / Furnishing' },
  { id: '11', code: 'SOFA', name: '双人布艺沙发 / 2-Seater Modern Sofa', hint: '点击轻触体验座面回弹与细致缝线折痕', category: '家具器物 / Furniture' },
  { id: '12', code: 'PILLOWS', name: '几何纹理抱枕 / Geometric Pillows', hint: '点击拍打抱枕，欣赏表面织造的包豪斯菱格纹理', category: '室内陈设 / Furnishing' },
  { id: '13', code: 'COFFEE_TABLE', name: '极简发夹腿茶几 / Wireframe Coffee Table', hint: '纤细钢丝腿几面，陈列玻璃水器与现代设计刊物', category: '家具器物 / Furniture' },
  { id: '14', code: 'RUG', name: '几何编织羊毛地毯 / Geometric Area Rug', hint: '包豪斯几何图腾密织羊毛地毯，两侧带细致手工流苏', category: '室内陈设 / Furnishing' },
  { id: '15', code: 'RECORD_PLAYER', name: '复古黑胶唱机 / Turntable Record Player', hint: '点击落针播放黑胶唱片，观察唱盘微缝与唱臂旋转', category: '生活器物 / Living' },
  { id: '16', code: 'WALL_ART', name: '画廊艺术挂画 / Framed Gallery Art', hint: '点击画框切换展出的三种现代主义矢量线稿艺术画作', category: '艺术陈列 / Art' },
  { id: '17', code: 'GLOBE', name: '复古桌面地球仪 / Desktop Globe', hint: '点击拨动地球仪，观察沿 23.5° 地轴旋转的经纬线网', category: '藏书文献 / Books' },
  { id: '18', code: 'CEILING_FAN', name: '三叶吊扇 / Aerodynamic Ceiling Fan', hint: '点击拉动悬垂珠链，切换吊扇转速或停止送风', category: '室内陈设 / Furnishing' },
  { id: '19', code: 'WIND_CHIME', name: '五音金属风铃 / Harmonic Wind Chime', hint: '点击轻拂风铃，聆听微风中空灵悠扬的金属余韵', category: '生活器物 / Living' },
  { id: '20', code: 'LIGHT_SWITCH', name: '双联墙面开关 / Dual Rocker Switch', hint: '点击按动开关，切换昼夜采光模式与室内灯效', category: '建筑构件 / Architectural' }
];

// =========================================================================
// MAIN EXPORT FUNCTION: buildRoom(scene, callbacks)
// =========================================================================
/**
 * Builds the complete 3D vector line art room and all 20 required room items.
 *
 * @param {THREE.Scene} scene - The main Three.js scene
 * @param {Object} [callbacks] - Optional event hooks (e.g. onToggleTheme)
 * @returns {Object} Complete room instance with interactive targets, materials, and update hooks
 */
function buildRoom(scene, callbacks = {}) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PureLineRoom_Root';
  scene.add(rootGroup);

  // Initialize line art material system
  const materials = createMaterials();

  // Raycastable interactive meshes list
  const interactiveTargets = [];

  // Theme change callback relay
  const relayCallbacks = {
    onToggleTheme: (isNight) => {
      materials.updateTheme(isNight);
      if (callbacks.onToggleTheme) {
        callbacks.onToggleTheme(isNight);
      }
    }
  };

  // Build Room Shell and all 20 items
  const architecture = buildArchitecture(rootGroup, materials);
  const door = buildDoor(rootGroup, materials, interactiveTargets);
  const windowObj = buildWindow(rootGroup, materials, interactiveTargets);
  const blinds = buildBlinds(rootGroup, materials, interactiveTargets);
  const desk = buildDesk(rootGroup, materials, interactiveTargets);
  const deskLamp = buildDeskLamp(rootGroup, materials, interactiveTargets);
  const cup = buildCup(rootGroup, materials, interactiveTargets);
  const chair = buildChair(rootGroup, materials, interactiveTargets);
  const bookshelf = buildBookshelf(rootGroup, materials, interactiveTargets);
  const cabinet = buildCabinet(rootGroup, materials, interactiveTargets);
  const wallClock = buildWallClock(rootGroup, materials, interactiveTargets);
  const sofa = buildSofa(rootGroup, materials, interactiveTargets);
  const pillows = buildPillows(rootGroup, materials, interactiveTargets);
  const coffeeTable = buildCoffeeTable(rootGroup, materials, interactiveTargets);
  const rug = buildRug(rootGroup, materials, interactiveTargets);
  const recordPlayer = buildRecordPlayer(rootGroup, materials, interactiveTargets);
  const wallArt = buildWallArt(rootGroup, materials, interactiveTargets);
  const globe = buildGlobe(rootGroup, materials, interactiveTargets);
  const ceilingFan = buildCeilingFan(rootGroup, materials, interactiveTargets);
  const windChime = buildWindChime(rootGroup, materials, interactiveTargets);
  const lightSwitch = buildLightSwitch(rootGroup, materials, interactiveTargets, relayCallbacks);

  const items = {
    architecture,
    door,
    window: windowObj,
    blinds,
    desk,
    deskLamp,
    cup,
    chair,
    bookshelf,
    cabinet,
    wallClock,
    sofa,
    pillows,
    coffeeTable,
    rug,
    recordPlayer,
    wallArt,
    globe,
    ceilingFan,
    windChime,
    lightSwitch
  };

  /**
   * Main per-frame animation and dynamic physics update
   */
  function update(delta, elapsed) {
    // 1. Door smooth swing
    door.doorState.currentAngle = THREE.MathUtils.lerp(
      door.doorState.currentAngle,
      door.doorState.targetAngle,
      delta * 6
    );
    door.hingePivot.rotation.y = door.doorState.currentAngle;

    // 2. Blinds slat tilt
    blinds.blindsState.tiltAngle = THREE.MathUtils.lerp(
      blinds.blindsState.tiltAngle,
      blinds.blindsState.targetAngle,
      delta * 7
    );
    blinds.slatGroups.forEach(sg => {
      sg.pivot.rotation.x = blinds.blindsState.tiltAngle;
    });

    // 3. Chair spin with friction damping
    if (chair.chairState.spinVelocity !== 0) {
      chair.swivelGroup.rotation.y += chair.chairState.spinVelocity * delta;
      chair.chairState.spinVelocity *= Math.pow(0.2, delta); // exponential damping
      if (Math.abs(chair.chairState.spinVelocity) < 0.01) {
        chair.chairState.spinVelocity = 0;
      }
    }

    // 4. Bookshelf special pull-out book animation
    if (bookshelf.pullOutBookGroup) {
      bookshelf.bookState.currentZ = THREE.MathUtils.lerp(
        bookshelf.bookState.currentZ,
        bookshelf.bookState.targetZ,
        delta * 6
      );
      bookshelf.pullOutBookGroup.position.z = -0.02 + bookshelf.bookState.currentZ;
    }

    // 5. Cabinet sliding drawer animation
    cabinet.drawerState.currentX = THREE.MathUtils.lerp(
      cabinet.drawerState.currentX,
      cabinet.drawerState.targetX,
      delta * 6
    );
    cabinet.drawerPivot.position.x = cabinet.drawerState.currentX;

    // 6. Wall Clock continuous sweeping hands synchronized with system time
    const now = new Date();
    const secFrac = now.getSeconds() + now.getMilliseconds() / 1000;
    const minFrac = now.getMinutes() + secFrac / 60;
    const hourFrac = (now.getHours() % 12) + minFrac / 60;

    wallClock.secHandPivot.rotation.x = -(secFrac / 60) * Math.PI * 2;
    wallClock.minHandPivot.rotation.x = -(minFrac / 60) * Math.PI * 2;
    wallClock.hourHandPivot.rotation.x = -(hourFrac / 12) * Math.PI * 2;

    // 7. Sofa cushion bounce
    sofa.sofaState.bounceY = THREE.MathUtils.lerp(
      sofa.sofaState.bounceY,
      sofa.sofaState.targetY,
      delta * 12
    );
    sofa.cushionGroup.position.y = sofa.sofaState.bounceY;

    // 8. Turntable vinyl spinning and tonearm movement
    recordPlayer.turntableState.currentAngle = THREE.MathUtils.lerp(
      recordPlayer.turntableState.currentAngle,
      recordPlayer.turntableState.targetAngle,
      delta * 4
    );
    recordPlayer.armPivotHead.rotation.y = recordPlayer.turntableState.currentAngle;

    if (recordPlayer.turntableState.isPlaying) {
      recordPlayer.turntablePlatter.rotation.y += delta * 3.48; // 33 RPM approx
    }

    // 9. Globe spin inertia
    if (globe.globeState.spinVelocity !== 0) {
      globe.worldLinesGroup.rotation.y += globe.globeState.spinVelocity * delta;
      globe.globeState.spinVelocity *= Math.pow(0.35, delta);
      if (Math.abs(globe.globeState.spinVelocity) < 0.01) {
        globe.globeState.spinVelocity = 0;
      }
    }

    // 10. Ceiling fan spinning
    const fanSpeed = ceilingFan.fanState.speeds[ceilingFan.fanState.speedMode];
    if (fanSpeed > 0) {
      ceilingFan.fanRotor.rotation.y += fanSpeed * delta;
    }

    // 11. Wind chime harmonic sway
    if (windChime.chimeState.swayImpulse > 0) {
      windChime.chimeState.swayImpulse *= Math.pow(0.4, delta);
      if (windChime.chimeState.swayImpulse < 0.01) {
        windChime.chimeState.swayImpulse = 0;
      }
    }
    const naturalSway = Math.sin(elapsed * 1.8) * 0.024;
    const impulseSway = Math.sin(elapsed * 9.0) * windChime.chimeState.swayImpulse * 0.08;
    windChime.chimePivot.rotation.z = naturalSway + impulseSway;
    windChime.chimePivot.rotation.x = Math.cos(elapsed * 1.4) * 0.018;

    // 12. Coffee steam wafting
    cup.steamGroup.position.y = 0.1 + Math.sin(elapsed * 2.5) * 0.006;
    cup.steamGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.12;
  }

  /**
   * Set theme (Day or Night)
   *
   * @param {boolean} isNight
   */
  function setTheme(isNight) {
    materials.updateTheme(isNight);
    lightSwitch.switchState.nightActive = isNight;
    lightSwitch.rocker2Pivot.rotation.z = isNight ? 0.15 : -0.15;
    scene.background = new THREE.Color(isNight ? 0x13161c : 0xf6f7f9);
  }

  /**
   * Handle user click interaction with raycasted hit mesh
   *
   * @param {THREE.Object3D} intersectedObject
   * @returns {Object|null} The userData of interacted item
   */
  function handleInteraction(intersectedObject) {
    if (!intersectedObject) return null;
    const data = intersectedObject.userData;
    if (data && data.interactive) {
      if (typeof data.onClick === 'function') {
        data.onClick();
      }
      return data;
    }
    return null;
  }

  /**
   * Get metadata info for hovered object
   */
  function getHoverInfo(intersectedObject) {
    if (!intersectedObject || !intersectedObject.userData) return null;
    return intersectedObject.userData.interactive ? intersectedObject.userData : null;
  }

  return {
    rootGroup,
    materials,
    items,
    interactiveTargets,
    catalog: ROOM_CATALOG,
    update,
    setTheme,
    handleInteraction,
    getHoverInfo
  };
}

/**
 * Convenience OOP Wrapper Class
 */
class Room {
  constructor(scene, callbacks) {
    const room = buildRoom(scene, callbacks);
    Object.assign(this, room);
  }
}

/* --- End js/roomGeometry.js --- */

/* --- Begin js/main.js --- */
// Pure Line Room - Main Application Bootstrap & Lifecycle
// [Stripped import]
// [Stripped import]
// [Stripped import]
// [Stripped import]
// [Stripped import]
class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.isNight = false;
    this.clock = new THREE.Clock();

    // 1. Setup Three.js WebGL Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6f7f9);

    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.sortObjects = true;
    this.container.appendChild(this.renderer.domElement);

    // 2. Setup Camera Controller
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    // 3. Setup Procedural Vector Room Geometry
    this.room = buildRoom(this.scene, {
      onToggleTheme: (night) => this.setTheme(night)
    });

    // 4. Setup Continuous Environment Dynamics (Particles, Steam, Clock Hand Sync, Sway)
    this.dynamics = new DynamicsManager(this.scene, audioManager, {
      isDay: !this.isNight,
      clockHourHand: this.room.items.wallClock?.hourHandPivot,
      clockMinuteHand: this.room.items.wallClock?.minHandPivot,
      clockSecondHand: this.room.items.wallClock?.secHandPivot,
      clockAxis: 'x',
      coffeeCup: this.room.items.cup?.group,
      turntablePlatter: this.room.items.recordPlayer?.turntablePlatter,
      turntableArm: this.room.items.recordPlayer?.armPivotHead,
      fanBlades: this.room.items.ceilingFan?.fanRotor,
      windChime: this.room.items.windChime?.chimePivot
    });

    // 5. Setup Raycasting & Interaction System
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);
    this.hoveredItem = null;
    this.highlightBox = this.createHighlightIndicator();

    // 6. Setup UI Elements & Listeners
    this.initUI();
    this.initInteractionEvents();
    this.populateCatalogModal();

    // 7. Window Resize
    window.addEventListener('resize', () => this.onResize());

    // 8. Start Ambient Audio on first user interaction
    audioManager.startAmbient();

    // 9. Begin Render Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  createHighlightIndicator() {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geom);
    const mat = new THREE.LineBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.0,
      depthTest: false
    });
    const lines = new THREE.LineSegments(edges, mat);
    lines.renderOrder = 999;
    lines.visible = false;
    this.scene.add(lines);
    return lines;
  }

  initInteractionEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointermove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.checkHover();
    });

    dom.addEventListener('pointerleave', () => {
      this.clearHover();
    });

    dom.addEventListener('click', (e) => {
      // Ignore click if user was dragging camera
      if (this.cameraController.hasDragged()) return;
      this.handleClick();
    });
  }

  checkHover() {
    if (!this.room || !this.room.interactiveTargets) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.room.interactiveTargets, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const data = hitObj.userData;
      if (data && data.interactive) {
        if (this.hoveredItem !== data) {
          this.setHover(data, hitObj);
        }
        return;
      }
    }

    this.clearHover();
  }

  setHover(item, hitMesh) {
    this.hoveredItem = item;
    document.body.classList.add('pointer-active');

    // Update Minimalist Architectural Inspector
    const inspector = document.getElementById('inspector');
    const inspId = document.getElementById('insp-id');
    const inspName = document.getElementById('insp-name');
    const inspHint = document.getElementById('insp-hint');
    const inspState = document.getElementById('insp-state');

    if (inspector) {
      inspId.textContent = `[ ${item.id} ] ${item.code || 'ITEM'}`;
      inspName.textContent = item.name || '交互物件';
      inspHint.textContent = item.hint || '点击交互';
      inspState.textContent = 'INTERACTIVE';
      inspector.classList.add('active');
    }

    // Position subtle 3D highlight bounding box
    if (this.highlightBox && hitMesh) {
      hitMesh.geometry.computeBoundingBox();
      const bbox = hitMesh.geometry.boundingBox;
      if (bbox) {
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        this.highlightBox.scale.set(size.x * 1.05 + 0.02, size.y * 1.05 + 0.02, size.z * 1.05 + 0.02);
        const worldPos = hitMesh.localToWorld(center.clone());
        this.highlightBox.position.copy(worldPos);
        this.highlightBox.quaternion.copy(hitMesh.getWorldQuaternion(new THREE.Quaternion()));
        this.highlightBox.material.opacity = 0.85;
        this.highlightBox.material.color.setHex(this.isNight ? 0x38bdf8 : 0x2563eb);
        this.highlightBox.visible = true;
      }
    }
  }

  clearHover() {
    if (this.hoveredItem) {
      this.hoveredItem = null;
      document.body.classList.remove('pointer-active');
    }
    const inspector = document.getElementById('inspector');
    if (inspector) {
      inspector.classList.remove('active');
    }
    if (this.highlightBox) {
      this.highlightBox.visible = false;
    }
  }

  handleClick() {
    if (!this.hoveredItem) return;

    const item = this.hoveredItem;

    // Trigger internal room animation hook
    if (typeof item.onClick === 'function') {
      item.onClick();
    }

    // Play synthesized procedural audio effect
    this.playItemAudio(item);

    // Update inspector
    const inspState = document.getElementById('insp-state');
    if (inspState) {
      inspState.textContent = 'ACTIVATED';
      setTimeout(() => {
        if (this.hoveredItem === item) inspState.textContent = 'INTERACTIVE';
      }, 700);
    }
  }

  playItemAudio(item) {
    const code = item.code;
    switch (code) {
      case 'DOOR':
        if (this.room.items.door.doorState.isOpen) {
          audioManager.playDoorCreak(1.0);
        } else {
          audioManager.playDoorLatch();
        }
        break;
      case 'LIGHT_SWITCH':
        audioManager.playSwitchSnap(!this.isNight);
        break;
      case 'DESK_LAMP':
        audioManager.playLampClick();
        break;
      case 'CABINET':
        if (this.room.items.cabinet.drawerState.isOpen) {
          audioManager.playDrawerSlide(0.65);
        } else {
          audioManager.playDrawerBump();
        }
        break;
      case 'RECORD_PLAYER':
        if (this.room.items.recordPlayer.turntableState.isPlaying) {
          audioManager.startTurntable(0.8);
        } else {
          audioManager.stopTurntable();
        }
        break;
      case 'WIND_CHIME':
        audioManager.playWindChime({ count: 2, intensity: 0.9 });
        break;
      case 'CEILING_FAN':
        audioManager.playLampClick();
        const fanMode = this.room.items.ceilingFan.fanState.speedMode;
        audioManager.setFanSpeed(fanMode);
        break;
      case 'CUP':
        audioManager.playDrawerBump(0.4);
        break;
      case 'CHAIR':
        audioManager.playDrawerSlide(0.5);
        break;
      case 'BOOKSHELF':
        audioManager.playDrawerSlide(0.4);
        break;
      case 'SOFA':
      case 'PILLOWS':
        audioManager.playDrawerBump(0.5);
        break;
      case 'BLINDS':
        audioManager.playSwitchSnap(true, 0.4);
        break;
      case 'WALL_ART':
      case 'GLOBE':
      case 'WINDOW':
      case 'COFFEE_TABLE':
      case 'DESK':
      case 'RUG':
        audioManager.playSwitchSnap(false, 0.35);
        break;
      case 'WALL_CLOCK':
        audioManager.playClockTick();
        break;
      default:
        audioManager.playSwitchSnap(true, 0.4);
        break;
    }
  }

  setTheme(isNight) {
    this.isNight = !!isNight;
    document.body.classList.toggle('night-mode', this.isNight);

    // Update Room Geometry materials
    this.room.setTheme(this.isNight);

    // Update Dynamics (particles color, audio ambience)
    this.dynamics.setDayNight(!this.isNight);

    // Update UI Labels
    const modeLabel = document.getElementById('env-mode-label');
    const themeBtnText = document.getElementById('theme-btn-text');
    if (modeLabel) {
      modeLabel.textContent = this.isNight ? '夜间模式 / NIGHT' : '昼间模式 / DAY';
    }
    if (themeBtnText) {
      themeBtnText.textContent = this.isNight ? '夜间' : '昼间';
    }
  }

  toggleTheme() {
    this.setTheme(!this.isNight);
    audioManager.playSwitchSnap(this.isNight);
  }

  initUI() {
    // 1. Clock Display Sync
    this.updateClockDisplay();
    setInterval(() => this.updateClockDisplay(), 1000);

    // 2. Camera Preset Buttons
    const btnOverview = document.getElementById('btn-cam-overview');
    const btnDesk = document.getElementById('btn-cam-desk');
    const btnLounge = document.getElementById('btn-cam-lounge');

    const setPresetActive = (activeBtn) => {
      [btnOverview, btnDesk, btnLounge].forEach((b) => b && b.classList.remove('active'));
      if (activeBtn) activeBtn.classList.add('active');
    };

    if (btnOverview) {
      btnOverview.addEventListener('click', () => {
        setPresetActive(btnOverview);
        this.cameraController.moveToPreset(0.75, Math.PI / 4.2, 8.5, new THREE.Vector3(0, 1.6, 0), 1.2);
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    if (btnDesk) {
      btnDesk.addEventListener('click', () => {
        setPresetActive(btnDesk);
        this.cameraController.moveToPreset(0.35, Math.PI / 3.4, 3.8, new THREE.Vector3(-0.7, 1.0, -2.15), 1.2);
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    if (btnLounge) {
      btnLounge.addEventListener('click', () => {
        setPresetActive(btnLounge);
        this.cameraController.moveToPreset(0.85, Math.PI / 3.4, 4.2, new THREE.Vector3(0.1, 0.7, 0.8), 1.2);
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    // 3. Theme Toggle Button
    const btnTheme = document.getElementById('btn-toggle-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => this.toggleTheme());
    }

    // 4. Audio Mute Toggle Button
    const btnAudio = document.getElementById('btn-toggle-audio');
    const audioBtnText = document.getElementById('audio-btn-text');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isMuted = audioManager.toggleMute();
        btnAudio.classList.toggle('active', !isMuted);
        if (audioBtnText) {
          audioBtnText.textContent = isMuted ? '声音静音' : '声音开启';
        }
      });
    }

    // 5. Audio Initial Prompt Banner
    const audioPrompt = document.getElementById('audio-prompt');
    if (audioPrompt) {
      const dismissPrompt = () => {
        audioPrompt.classList.add('dismissed');
        window.removeEventListener('pointerdown', dismissPrompt);
      };
      audioPrompt.addEventListener('click', dismissPrompt);
      window.addEventListener('pointerdown', dismissPrompt, { once: true });
    }

    // 6. Interactive Guide Modal
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const modal = document.getElementById('guide-modal');

    if (btnOpenGuide && modal) {
      btnOpenGuide.addEventListener('click', () => {
        modal.classList.add('open');
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    if (btnCloseGuide && modal) {
      btnCloseGuide.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }
  }

  updateClockDisplay() {
    const clockText = document.getElementById('clock-text');
    if (clockText) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      clockText.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
  }

  populateCatalogModal() {
    const listContainer = document.getElementById('guide-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    ROOM_CATALOG.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'guide-item';
      card.innerHTML = `
        <div class="guide-name">
          <span class="guide-num">[ ${item.id} ]</span>
          <span>${item.name}</span>
        </div>
        <div class="guide-desc">${item.hint}</div>
      `;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        document.getElementById('guide-modal').classList.remove('open');
        this.focusItemByCode(item.code);
      });
      listContainer.appendChild(card);
    });
  }

  focusItemByCode(code) {
    audioManager.playSwitchSnap(true, 0.3);
    switch (code) {
      case 'DOOR':
      case 'LIGHT_SWITCH':
        this.cameraController.moveToPreset(1.85, Math.PI / 3.4, 4.2, new THREE.Vector3(-3.2, 1.4, 0.6), 1.2);
        break;
      case 'DESK':
      case 'DESK_LAMP':
      case 'CUP':
      case 'CHAIR':
        this.cameraController.moveToPreset(0.35, Math.PI / 3.4, 3.4, new THREE.Vector3(-0.7, 0.95, -2.15), 1.2);
        break;
      case 'WINDOW':
      case 'BLINDS':
      case 'WIND_CHIME':
        this.cameraController.moveToPreset(0.05, Math.PI / 3.2, 3.8, new THREE.Vector3(-0.7, 2.0, -3.2), 1.2);
        break;
      case 'SOFA':
      case 'PILLOWS':
      case 'COFFEE_TABLE':
      case 'RUG':
        this.cameraController.moveToPreset(0.85, Math.PI / 3.4, 4.0, new THREE.Vector3(0.1, 0.7, 0.8), 1.2);
        break;
      case 'BOOKSHELF':
        this.cameraController.moveToPreset(0.35, Math.PI / 3.5, 4.2, new THREE.Vector3(2.45, 1.5, -3.2), 1.2);
        break;
      case 'WALL_ART':
        this.cameraController.moveToPreset(0.25, Math.PI / 3.4, 3.6, new THREE.Vector3(1.11, 2.15, -3.37), 1.2);
        break;
      case 'CABINET':
      case 'RECORD_PLAYER':
      case 'GLOBE':
      case 'WALL_CLOCK':
        this.cameraController.moveToPreset(1.85, Math.PI / 3.5, 3.8, new THREE.Vector3(-3.0, 1.2, -0.45), 1.2);
        break;
      case 'CEILING_FAN':
        this.cameraController.moveToPreset(0.65, Math.PI / 2.6, 5.2, new THREE.Vector3(0, 2.8, 0), 1.2);
        break;
      default:
        this.cameraController.moveToPreset(0.75, Math.PI / 4.2, 8.5, new THREE.Vector3(0, 1.6, 0), 1.2);
        break;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    // 1. Update Smooth Camera Inertia Damping
    this.cameraController.update(delta);

    // 2. Update Room Item Animations
    if (this.room && this.room.update) {
      this.room.update(delta, elapsed);
    }

    // 3. Update Continuous Dynamics Physics (Particles, Real-Time Clock Hands, Vinyl, Fan, Chime)
    if (this.dynamics && this.dynamics.update) {
      this.dynamics.update(delta, elapsed);
    }

    // 4. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});

/* --- End js/main.js --- */

})();
