/**
 * audio-engine.js — Visceral Procedural Horror Audio
 *
 * Synthesizes high-impact horror audio, visceral sub-bass heartbeat impacts,
 * demonic monster charges, rapid heavy footsteps, and binaural whisper unease.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isRunning = false;

    // Persistent audio nodes
    this.droneOsc = null;
    this.droneLfo = null;
    this.droneGain = null;
    this.subBassOsc = null;
    this.subBassGain = null;
    this.noiseNode = null;
    this.noiseGain = null;
    this.heartbeatGain = null;

    // State
    this.currentDroneFreq = 50;
    this.targetDroneFreq = 50;
    this.heartbeatBpm = 72;
    this._heartbeatInterval = null;
    this.isChasing = false;
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // High-impact master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    // Build audio architecture
    this._createDrone();
    this._createSubBass();
    this._createNoise();
    this._createHeartbeatChannel();

    this.isRunning = true;
    console.log('[Audio] Visceral Horror Audio Engine active.');
  }

  update(fearLevel, biometrics) {
    if (!this.ctx || !this.isRunning) return;

    // Drone pitch rises with physiological tension
    this.targetDroneFreq = 40 + fearLevel * 80;
    this.droneOsc.frequency.linearRampToValueAtTime(
      this.targetDroneFreq,
      this.ctx.currentTime + 1.2
    );

    // Ambient rumble increases
    this.droneGain.gain.linearRampToValueAtTime(
      0.12 + fearLevel * 0.22,
      this.ctx.currentTime + 0.8
    );

    this.subBassGain.gain.linearRampToValueAtTime(
      0.08 + fearLevel * 0.18,
      this.ctx.currentTime + 0.8
    );

    // Radio static hiss increases as entity closes in
    this.noiseGain.gain.linearRampToValueAtTime(
      0.01 + fearLevel * 0.05,
      this.ctx.currentTime + 0.4
    );

    // Heartbeat BPM tracking
    if (biometrics.pulseRate && biometrics.pulseRate !== this.heartbeatBpm) {
      this.heartbeatBpm = biometrics.pulseRate;
      this._updateHeartbeatTiming();
    }
  }

  // ---- Monster Chase Roar & Footsteps ----

  playMonsterCharge(intensity = 1.0) {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;

    // 1. Demonic Screech / Roar (Dissonant cluster with FM distortion)
    const freqs = [185, 233, 311, 466, 622, 880];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * 1.5, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + 1.2);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(intensity * 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      // Distortion filter
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3500, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.4);
    });

    // 2. Violent Sub-Drop Earthquake Impact
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.8);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(intensity * 0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 1.2);

    // 3. Rapid Pounding Footsteps sprinting toward player
    for (let step = 0; step < 7; step++) {
      const stepTime = now + step * 0.14;
      const stepOsc = this.ctx.createOscillator();
      stepOsc.type = 'triangle';
      stepOsc.frequency.setValueAtTime(110 - step * 6, stepTime);
      stepOsc.frequency.exponentialRampToValueAtTime(35, stepTime + 0.08);

      const stepGain = this.ctx.createGain();
      // Louder and closer with each step!
      stepGain.gain.setValueAtTime((0.15 + step * 0.06) * intensity, stepTime);
      stepGain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.1);

      stepOsc.connect(stepGain);
      stepGain.connect(this.masterGain);
      stepOsc.start(stepTime);
      stepOsc.stop(stepTime + 0.1);
    }
  }

  playReliefBreath() {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;

    // Warm, soothing exhale chord that releases tension
    [220, 277.18, 329.63, 440].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 2.5);
    });
  }

  // ---- Persistent Background Synthesis ----

  _createDrone() {
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = 50;

    this.droneLfo = this.ctx.createOscillator();
    this.droneLfo.type = 'sine';
    this.droneLfo.frequency.value = 0.25;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 8;
    this.droneLfo.connect(lfoGain);
    lfoGain.connect(this.droneOsc.frequency);
    this.droneLfo.start();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 3;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.14;

    this.droneOsc.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOsc.start();
  }

  _createSubBass() {
    this.subBassOsc = this.ctx.createOscillator();
    this.subBassOsc.type = 'sine';
    this.subBassOsc.frequency.value = 32;

    this.subBassGain = this.ctx.createGain();
    this.subBassGain.gain.value = 0.08;

    this.subBassOsc.connect(this.subBassGain);
    this.subBassGain.connect(this.masterGain);
    this.subBassOsc.start();
  }

  _createNoise() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 650;
    noiseFilter.Q.value = 0.8;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.012;

    this.noiseNode.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);
    this.noiseNode.start();
  }

  _createHeartbeatChannel() {
    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0.6;
    this.heartbeatGain.connect(this.masterGain);

    this._updateHeartbeatTiming();
  }

  _updateHeartbeatTiming() {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    const interval = 60000 / Math.max(45, this.heartbeatBpm);

    this._heartbeatInterval = setInterval(() => {
      if (!this.isRunning) return;
      this._playHeartbeatPulse();
    }, interval);
  }

  _playHeartbeatPulse() {
    // Visceral sub-bass chest thump (42Hz)
    const now = this.ctx.currentTime;

    // Lub (deep visceral impact)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.55, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain1);
    gain1.connect(this.heartbeatGain);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Dub (echoing afterthump)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(55, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(32, now + 0.32);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, now + 0.14);
    gain2.gain.linearRampToValueAtTime(0.42, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(this.heartbeatGain);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.35);
  }

  // ---- Scare Event Triggers ----

  triggerScare(type, intensity = 0.8) {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;

    switch (type) {
      case 'monster_charge':
        this.playMonsterCharge(intensity);
        break;

      case 'face_flash': {
        // High screech + sub boom
        this.playMonsterCharge(1.1);
        break;
      }

      case 'flicker': {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 1800 + Math.random() * 800;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(intensity * 0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }

      case 'static_burst': {
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(intensity * 0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        source.connect(gain);
        gain.connect(this.masterGain);
        source.start(now);
        source.stop(now + 0.35);
        break;
      }

      case 'whisper': {
        const bufferSize = this.ctx.sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const env = Math.sin((i / this.ctx.sampleRate) * Math.PI * 4);
          data[i] = (Math.random() * 2 - 1) * env * 0.4;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(intensity * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.random() > 0.5 ? -0.85 : 0.85;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
        source.start(now);
        source.stop(now + 1.5);
        break;
      }

      case 'screen_shake': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(32, now);
        osc.frequency.linearRampToValueAtTime(20, now + 1.2);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(intensity * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 1.2);
        break;
      }
    }
  }

  stop() {
    this.isRunning = false;
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    if (this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
      setTimeout(() => this.ctx.close(), 1000);
    }
  }
}

window.AudioEngine = AudioEngine;
