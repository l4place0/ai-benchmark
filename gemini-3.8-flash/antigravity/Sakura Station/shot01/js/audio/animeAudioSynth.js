// Web Audio API Synthesizer for Authentic Anime Soundscape
export class AnimeAudioSynth {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.crossingChimeInterval = null;
    this.windNode = null;
    this.windGain = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.init();
    this.isMuted = !this.isMuted;

    if (!this.isMuted) {
      this.startWindAmbient();
      this.startCrossingChimes();
      this.playStationJingle();
    } else {
      this.stopWindAmbient();
      this.stopCrossingChimes();
    }

    return !this.isMuted;
  }

  // 1. Japanese Railway Crossing Warning Chime (叮-咚-叮-咚 Fumikiri Chime)
  startCrossingChimes() {
    if (this.crossingChimeInterval) return;

    let high = true;
    this.crossingChimeInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      // High chime ~780Hz, Low chime ~690Hz
      const freq = high ? 784 : 698;
      high = !high;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.36);
    }, 450);
  }

  stopCrossingChimes() {
    if (this.crossingChimeInterval) {
      clearInterval(this.crossingChimeInterval);
      this.crossingChimeInterval = null;
    }
  }

  // 2. Spring Breeze / Ambient Wind (Filtered Noise Generator)
  startWindAmbient() {
    if (!this.ctx || this.windNode) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.windNode = this.ctx.createBufferSource();
    this.windNode.buffer = noiseBuffer;
    this.windNode.loop = true;

    // Bandpass filter for gentle wind whoosh
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

    this.windNode.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);

    this.windNode.start();
  }

  stopWindAmbient() {
    if (this.windNode) {
      try {
        this.windNode.stop();
        this.windNode.disconnect();
      } catch (e) {}
      this.windNode = null;
    }
  }

  // 3. Melodic Japanese Station Departure Jingle (発車メロディ)
  playStationJingle() {
    if (!this.ctx || this.isMuted) return;

    // Classic 4-note melodic chime: E5 -> G#5 -> B5 -> E6
    const notes = [659.25, 830.61, 987.77, 1318.51];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.28);

      gain.gain.setValueAtTime(0.12, now + idx * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.28 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.28);
      osc.stop(now + idx * 0.28 + 0.85);
    });
  }

  // 4. Commuter Train Air Horn (AW-2 Train Horn)
  playTrainHorn() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Dual chord frequencies: ~330Hz and ~392Hz
    [330, 392].forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.25);
    });
  }
}
