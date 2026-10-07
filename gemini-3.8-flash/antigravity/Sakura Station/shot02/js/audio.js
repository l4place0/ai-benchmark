/**
 * audio.js - Synthesized Web Audio API Anime Soundscape
 * Procedural spring breeze, authentic Japanese crossing chime ("カンカンカン"),
 * gentle train idling hum, and sparrow chirps without external audio dependencies.
 */

export class AnimeAudio {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this.timerBell = null;
    this.timerBird = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  toggle() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.play();
      return true;
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // 1. Spring Breeze (Filtered pink noise with slow LFO)
    this.startWind();

    // 2. Distant Train Idle Drone (Warm low rumble)
    this.startTrainHum();

    // 3. Railroad Crossing Chime Loop (Authentic Japanese 700Hz/750Hz dual gong)
    this.startCrossingChime();

    // 4. Sparrow Chirps (Periodic natural birdsong)
    this.startBirdChirps();
  }

  stop() {
    this.isPlaying = false;
    if (this.windNode) {
      try { this.windNode.stop(); } catch (e) {}
    }
    if (this.trainHumNode) {
      try { this.trainHumNode.stop(); } catch (e) {}
    }
    if (this.timerBell) clearInterval(this.timerBell);
    if (this.timerBird) clearInterval(this.timerBird);
  }

  startWind() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Pink noise generation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Low-pass filter for soft breeze tone
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    // Slow wind gust LFO
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain);

    whiteNoise.start();
    this.windNode = whiteNoise;
  }

  startTrainHum() {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(58, this.ctx.currentTime); // Low 58Hz rumble

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.06, this.ctx.currentTime);

    osc.connect(humGain);
    humGain.connect(this.masterGain);
    osc.start();
    this.trainHumNode = osc;
  }

  startCrossingChime() {
    let step = 0;
    // Crossing chime repeats every 420ms (approx 140 BPM Japanese Fumikiri)
    this.timerBell = setInterval(() => {
      if (!this.isPlaying) return;
      const freq = (step % 2 === 0) ? 700 : 750;
      this.playBellTone(freq);
      step++;
    }, 420);
  }

  playBellTone(freq) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Sharp attack, gentle bell decay
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  startBirdChirps() {
    this.timerBird = setInterval(() => {
      if (!this.isPlaying || Math.random() > 0.6) return;
      this.playChirp();
    }, 3200);
  }

  playChirp() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 2600 + Math.random() * 400;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 600, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq - 200, now + 0.16);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}
