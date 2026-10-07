// ============================================================================
// ACHROMA-INSPIRED SYNTHESIZED AUDIO ENGINE (audio.js)
// 100% Bulletproof: try/catch protected, linear gain envelopes,
// Convolver impulse reverb, and generative adaptive ambient drone.
// ============================================================================

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.sfx = null;
        this.mus = null;
        this.rev = null;
        this.noiseBuf = null;
        this.last = {};
        this.isMuted = false;
        this.initialized = false;
        this.mode = 'calm';
        this.rootFreq = 55;
        this.droneOsc1 = null;
        this.droneOsc2 = null;
        this.droneFilter = null;
        this.droneGain = null;
    }

    init() {
        if (this.initialized) {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return;
        }
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const c = this.ctx = new AudioCtx();

            const comp = c.createDynamicsCompressor();
            comp.threshold.value = -16;
            comp.knee.value = 12;
            comp.ratio.value = 5;
            comp.attack.value = 0.003;
            comp.release.value = 0.2;

            this.master = c.createGain();
            this.master.gain.value = 0.8;
            this.master.connect(comp);
            comp.connect(c.destination);

            this.sfx = c.createGain();
            this.sfx.gain.value = 0.85;
            this.sfx.connect(this.master);

            this.mus = c.createGain();
            this.mus.gain.value = 0.35;
            this.mus.connect(this.master);

            // Reverb impulse buffer (2.0s smooth decay)
            const irLen = Math.floor(c.sampleRate * 2.0);
            const ir = c.createBuffer(2, irLen, c.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = ir.getChannelData(ch);
                for (let i = 0; i < irLen; i++) {
                    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.0);
                }
            }
            this.rev = c.createConvolver();
            this.rev.buffer = ir;
            const revGain = c.createGain();
            revGain.gain.value = 0.35;
            this.rev.connect(revGain);
            revGain.connect(this.master);

            // Pink noise buffer
            const nl = Math.floor(c.sampleRate * 2.0);
            this.noiseBuf = c.createBuffer(1, nl, c.sampleRate);
            const nd = this.noiseBuf.getChannelData(0);
            let lastOut = 0.0;
            for (let i = 0; i < nl; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + 0.02 * white) / 1.02;
                nd[i] = lastOut * 3.5;
            }

            this.initialized = true;
            this.startDrone();
        } catch (e) {
            console.warn('Audio init warning:', e);
        }
    }

    ensureContext() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.master && this.ctx) {
            try {
                this.master.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
            } catch (e) {}
        }
        return this.isMuted;
    }

    tone(o) {
        if (!this.ctx || this.isMuted) return;
        try {
            const c = this.ctx;
            const t = Math.max(c.currentTime + 0.002, c.currentTime + (o.delay || 0));
            const osc = c.createOscillator();
            const g = c.createGain();

            osc.type = o.type || 'sine';
            const f0 = Math.max(20, o.f0 || 220);
            osc.frequency.setValueAtTime(f0, t);

            const dur = Math.max(0.02, o.dur || 0.1);
            if (o.f1) {
                const f1 = Math.max(20, o.f1);
                osc.frequency.linearRampToValueAtTime(f1, t + (o.glide || dur));
            }

            const a = Math.max(0.002, o.atk || 0.003);
            const v = Math.max(0.001, o.vol || 0.2);

            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(v, t + a);
            g.gain.linearRampToValueAtTime(0.0001, t + a + dur);

            let node = osc;
            if (o.lp) {
                const f = c.createBiquadFilter();
                f.type = 'lowpass';
                f.frequency.setValueAtTime(Math.max(50, o.lp), t);
                f.Q.value = o.q || 0.7;
                node.connect(f);
                node = f;
            }

            node.connect(g);
            g.connect(o.dest || this.sfx);

            if (o.rev && this.rev) {
                const s = c.createGain();
                s.gain.setValueAtTime(Math.min(1, o.rev), t);
                g.connect(s);
                s.connect(this.rev);
            }

            osc.start(t);
            osc.stop(t + a + dur + 0.05);
        } catch (e) {
            // Failsafe: never crash the game loop on audio glitch
        }
    }

    noise(o) {
        if (!this.ctx || this.isMuted || !this.noiseBuf) return;
        try {
            const c = this.ctx;
            const t = Math.max(c.currentTime + 0.002, c.currentTime + (o.delay || 0));
            const src = c.createBufferSource();
            src.buffer = this.noiseBuf;
            src.playbackRate.value = o.rate || 1;

            const f = c.createBiquadFilter();
            f.type = o.ft || 'lowpass';
            f.Q.value = o.q || 1;
            f.frequency.setValueAtTime(Math.max(40, o.f0 || 2000), t);

            const dur = Math.max(0.02, o.dur || 0.1);
            if (o.f1) {
                f.frequency.linearRampToValueAtTime(Math.max(40, o.f1), t + dur);
            }

            const g = c.createGain();
            const a = Math.max(0.002, o.atk || 0.002);
            const v = Math.max(0.001, o.vol || 0.2);

            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(v, t + a);
            g.gain.linearRampToValueAtTime(0.0001, t + a + dur);

            src.connect(f);
            f.connect(g);
            g.connect(o.dest || this.sfx);

            if (o.rev && this.rev) {
                const s = c.createGain();
                s.gain.setValueAtTime(Math.min(1, o.rev), t);
                g.connect(s);
                s.connect(this.rev);
            }

            src.start(t, Math.random() * 1.0);
            src.stop(t + a + dur + 0.05);
        } catch (e) {
            // Failsafe
        }
    }

    play(name, pitch = 1, vol = 1) {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        try {
            const now = this.ctx.currentTime;
            const gap = {
                hit: 0.035, shoot: 0.03, smg: 0.025, pellet: 0.05, kill: 0.03,
                ink: 0.02, dash: 0.08, step: 0.1, zap: 0.04, slash: 0.05
            }[name] || 0.015;

            if (this.last[name] && now - this.last[name] < gap) return;
            this.last[name] = now;

            const r = 1 + (Math.random() - 0.5) * 0.08;
            const p = Math.max(0.2, pitch * r);
            const v = Math.max(0.1, vol);

            switch (name) {
                case 'shoot':
                    this.tone({ f0: 190 * p, f1: 55, dur: 0.07, vol: 0.22 * v });
                    this.noise({ ft: 'bandpass', f0: 2600 * p, f1: 700, dur: 0.05, vol: 0.12 * v, q: 1.2 });
                    break;
                case 'smg':
                    this.tone({ f0: 240 * p, f1: 80, dur: 0.045, vol: 0.15 * v });
                    this.noise({ ft: 'bandpass', f0: 3200, f1: 1200, dur: 0.03, vol: 0.09 * v });
                    break;
                case 'pellet':
                    this.tone({ f0: 130 * p, f1: 38, dur: 0.16, vol: 0.42 * v });
                    this.noise({ f0: 3500, f1: 300, dur: 0.2, vol: 0.35 * v });
                    break;
                case 'rail':
                    this.tone({ f0: 95, f1: 30, dur: 0.32, vol: 0.55 * v });
                    this.noise({ ft: 'highpass', f0: 5000, f1: 1500, dur: 0.25, vol: 0.16 * v });
                    this.tone({ f0: 1320 * p, dur: 0.45, vol: 0.06 * v, rev: 0.6, type: 'triangle' });
                    break;
                case 'slash':
                    this.noise({ ft: 'bandpass', f0: 500 * p, f1: 3400 * p, dur: 0.12, vol: 0.35 * v, q: 2 });
                    this.tone({ f0: 140 * p, f1: 70, dur: 0.06, vol: 0.14 * v });
                    break;
                case 'rocket':
                    this.noise({ ft: 'bandpass', f0: 300, f1: 1800, dur: 0.22, vol: 0.24 * v, q: 1 });
                    this.tone({ f0: 110, f1: 60, dur: 0.12, vol: 0.28 * v });
                    break;
                case 'chakram':
                    this.noise({ ft: 'bandpass', f0: 900, f1: 1800, dur: 0.14, vol: 0.16 * v, q: 4 });
                    break;
                case 'zap':
                    this.noise({ ft: 'bandpass', f0: 4200, f1: 1600, dur: 0.08, vol: 0.14 * v, q: 4 });
                    this.tone({ f0: 2600 * p, f1: 1200, dur: 0.06, vol: 0.04 * v, type: 'triangle' });
                    break;
                case 'hit':
                    this.tone({ f0: 230 * p, f1: 80, dur: 0.06, vol: 0.2 * v });
                    this.noise({ ft: 'highpass', f0: 3000, dur: 0.02, vol: 0.1 * v });
                    break;
                case 'crit':
                    this.tone({ f0: 160, f1: 50, dur: 0.12, vol: 0.38 * v });
                    this.tone({ f0: 2093 * p, dur: 0.3, vol: 0.06 * v, rev: 0.6, type: 'triangle' });
                    this.noise({ ft: 'highpass', f0: 4000, dur: 0.04, vol: 0.14 * v });
                    break;
                case 'kill':
                    this.noise({ ft: 'highpass', f0: 6000, dur: 0.012, vol: 0.28 * v });
                    this.tone({ f0: 240 * p, f1: 52, dur: 0.085, vol: 0.45 * v, glide: 0.07 });
                    this.noise({ ft: 'bandpass', f0: 3200, f1: 1100, dur: 0.05, vol: 0.1 * v, q: 2 });
                    this.tone({ f0: 1568 * p, dur: 0.11, vol: 0.075 * v, type: 'triangle' });
                    break;
                case 'explode':
                    this.noise({ f0: 1400, f1: 70, dur: 0.6, vol: 0.55 * v });
                    this.tone({ f0: 85 * p, f1: 24, dur: 0.5, vol: 0.65 * v });
                    break;
                case 'dash':
                    this.noise({ ft: 'bandpass', f0: 350, f1: 2000, dur: 0.16, vol: 0.22, q: 1.5 });
                    break;
                case 'hurt':
                    this.tone({ f0: 330, f1: 70, dur: 0.3, vol: 0.45, type: 'triangle', lp: 900 });
                    this.noise({ f0: 900, f1: 100, dur: 0.22, vol: 0.35 });
                    break;
                case 'armor':
                    this.tone({ f0: 900, f1: 300, dur: 0.12, vol: 0.15, type: 'triangle' });
                    this.noise({ ft: 'highpass', f0: 2500, dur: 0.08, vol: 0.16 });
                    break;
                case 'ink':
                    this.tone({ f0: 1400 * p, dur: 0.06, vol: 0.045 * v, type: 'triangle', rev: 0.2 });
                    break;
                case 'pickup':
                    [784, 988, 1175].forEach((f, i) => {
                        this.tone({ f0: f * p, dur: 0.16, vol: 0.08 * v, rev: 0.4, delay: i * 0.045, type: 'triangle' });
                    });
                    break;
                case 'card':
                    [523, 659, 784, 1047].forEach((f, i) => {
                        this.tone({ f0: f, dur: 0.5, vol: 0.07 * v, rev: 0.6, delay: i * 0.06, type: 'triangle' });
                    });
                    break;
                case 'select':
                    [784, 1175, 1568].forEach((f, i) => {
                        this.tone({ f0: f * p, dur: 0.4, vol: 0.08 * v, rev: 0.7, delay: i * 0.05, type: 'triangle' });
                    });
                    this.tone({ f0: 98, f1: 49, dur: 0.35, vol: 0.4 * v });
                    break;
                case 'ui':
                    this.tone({ f0: 880 * p, dur: 0.04, vol: 0.06 * v, type: 'triangle' });
                    break;
                case 'deflect':
                    this.tone({ f0: 2100 * p, dur: 0.14, vol: 0.07 * v, type: 'triangle' });
                    this.noise({ ft: 'highpass', f0: 3000, dur: 0.04, vol: 0.1 * v });
                    break;
                case 'reload':
                    this.tone({ f0: 420 * p, dur: 0.06, vol: 0.06, type: 'triangle' });
                    this.tone({ f0: 640 * p, dur: 0.08, vol: 0.07, delay: 0.07, type: 'triangle' });
                    break;
                case 'phase':
                    this.tone({ f0: 60, f1: 28, dur: 1.0, vol: 0.6 * v, type: 'sawtooth', lp: 250 });
                    this.noise({ f0: 500, f1: 40, dur: 0.8, vol: 0.35 * v });
                    break;
                case 'telegraph':
                    this.tone({ f0: 75, f1: 180, dur: 0.5, vol: 0.22 * v, type: 'sawtooth', lp: 450 });
                    break;
                default:
                    this.tone({ f0: 440 * p, dur: 0.05, vol: 0.1 * v });
                    break;
            }
        } catch (e) {
            // Failsafe
        }
    }

    startDrone() {
        if (!this.ctx || this.droneOsc1) return;
        try {
            const c = this.ctx;
            const t = c.currentTime;

            this.droneFilter = c.createBiquadFilter();
            this.droneFilter.type = 'lowpass';
            this.droneFilter.frequency.setValueAtTime(140, t);

            this.droneGain = c.createGain();
            this.droneGain.gain.setValueAtTime(0.18, t);

            this.droneOsc1 = c.createOscillator();
            this.droneOsc1.type = 'sawtooth';
            this.droneOsc1.frequency.setValueAtTime(this.rootFreq, t);

            this.droneOsc2 = c.createOscillator();
            this.droneOsc2.type = 'sine';
            this.droneOsc2.frequency.setValueAtTime(this.rootFreq * 1.5, t);

            this.droneOsc1.connect(this.droneFilter);
            this.droneOsc2.connect(this.droneFilter);
            this.droneFilter.connect(this.droneGain);
            this.droneGain.connect(this.mus);

            this.droneOsc1.start();
            this.droneOsc2.start();
        } catch (e) {}
    }

    setMode(mode) {
        this.mode = mode;
        if (!this.ctx || !this.droneFilter || !this.droneGain) return;
        try {
            const t = this.ctx.currentTime;
            if (mode === 'combat') {
                this.droneFilter.frequency.linearRampToValueAtTime(280, t + 0.3);
                this.droneGain.gain.linearRampToValueAtTime(0.28, t + 0.3);
            } else {
                this.droneFilter.frequency.linearRampToValueAtTime(130, t + 0.6);
                this.droneGain.gain.linearRampToValueAtTime(0.16, t + 0.6);
            }
        } catch (e) {}
    }

    setRoot(freq) {
        this.rootFreq = freq;
        if (!this.ctx || !this.droneOsc1 || !this.droneOsc2) return;
        try {
            const t = this.ctx.currentTime;
            this.droneOsc1.frequency.linearRampToValueAtTime(freq, t + 0.4);
            this.droneOsc2.frequency.linearRampToValueAtTime(freq * 1.5, t + 0.4);
        } catch (e) {}
    }
}

window.AU = new SoundEngine();
window.audioEngine = window.AU;
