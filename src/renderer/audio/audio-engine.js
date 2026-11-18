/**
 * audio-engine.js — Procedural Horror Audio
 *
 * Generates all horror audio procedurally using Web Audio API.
 * No external audio files needed — everything is synthesized in real-time
 * and reacts to the user's biometrics.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isRunning = false;

    // Audio nodes
    this.droneOsc = null;
    this.droneLfo = null;
    this.droneGain = null;
    this.subBassOsc = null;
    this.subBassGain = null;
    this.noiseNode = null;
    this.noiseGain = null;
    this.heartbeatGain = null;

    // State
    this.currentDroneFreq = 55;
    this.targetDroneFreq = 55;
    this.heartbeatBpm = 72;
    this._heartbeatInterval = null;
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;
    this.masterGain.connect(this.ctx.destination);

    // Create persistent drone
    this._createDrone();
    this._createSubBass();
    this._createNoise();
    this._createHeartbeatChannel();

    this.isRunning = true;
    console.log('[Audio] Engine initialized');
  }

  /**
   * Update audio based on fear engine state
   */
  update(fearLevel, biometrics) {
    if (!this.ctx || !this.isRunning) return;

    // Drone pitch rises with fear
    this.targetDroneFreq = 45 + fearLevel * 60;
    this.droneOsc.frequency.linearRampToValueAtTime(
      this.targetDroneFreq,
      this.ctx.currentTime + 2
    );

    // Drone volume
    this.droneGain.gain.linearRampToValueAtTime(
      0.06 + fearLevel * 0.12,
      this.ctx.currentTime + 1
    );

    // Sub bass rumble increases with tension
    this.subBassGain.gain.linearRampToValueAtTime(
      0.03 + fearLevel * 0.08,
      this.ctx.currentTime + 1
    );

    // Background noise/static
    this.noiseGain.gain.linearRampToValueAtTime(
      0.005 + fearLevel * 0.02,
      this.ctx.currentTime + 0.5
    );

    // Update heartbeat rhythm
    if (biometrics.pulseRate && biometrics.pulseRate !== this.heartbeatBpm) {
      this.heartbeatBpm = biometrics.pulseRate;
      this._updateHeartbeatTiming();
    }
  }

  /**
   * Trigger sound effects for scare events
   */
  triggerScare(type, intensity) {
    if (!this.ctx || !this.isRunning) return;

    switch (type) {
      case 'flicker':
        this._playClick(intensity);
        break;
      case 'shadow_move':
        this._playWhoosh(intensity);
        break;
      case 'static_burst':
        this._playStaticBurst(intensity);
        break;
      case 'face_flash':
        this._playStinger(intensity);
        break;
      case 'screen_shake':
        this._playRumble(intensity);
        break;
      case 'whisper':
        this._playWhisper(intensity);
        break;
      case 'darkness':
        this._playDeepDrone(intensity);
        break;
      case 'eyes_in_dark':
        this._playHighTone(intensity);
        break;
      case 'door_creak':
        this._playCreak(intensity);
        break;
    }
  }

  stop() {
    this.isRunning = false;
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    if (this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      setTimeout(() => this.ctx.close(), 1500);
    }
  }

  // ---- Persistent Audio Sources ----

  _createDrone() {
    // Low ominous drone
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = 55;

    // LFO for wobble
    this.droneLfo = this.ctx.createOscillator();
    this.droneLfo.type = 'sine';
    this.droneLfo.frequency.value = 0.3;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 5;
    this.droneLfo.connect(lfoGain);
    lfoGain.connect(this.droneOsc.frequency);
    this.droneLfo.start();

    // Filter to make it dark
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 2;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.06;

    this.droneOsc.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOsc.start();
  }

  _createSubBass() {
    this.subBassOsc = this.ctx.createOscillator();
    this.subBassOsc.type = 'sine';
    this.subBassOsc.frequency.value = 30;

    this.subBassGain = this.ctx.createGain();
    this.subBassGain.gain.value = 0.03;

    this.subBassOsc.connect(this.subBassGain);
    this.subBassGain.connect(this.masterGain);
    this.subBassOsc.start();
  }

  _createNoise() {
    // White noise buffer for atmosphere
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
    noiseFilter.frequency.value = 500;
    noiseFilter.Q.value = 0.5;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.005;

    this.noiseNode.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);
    this.noiseNode.start();
  }

  _createHeartbeatChannel() {
    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0.3;
    this.heartbeatGain.connect(this.masterGain);

    this._updateHeartbeatTiming();
  }

  _updateHeartbeatTiming() {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);

    const interval = 60000 / this.heartbeatBpm;

    this._heartbeatInterval = setInterval(() => {
      if (!this.isRunning) return;
      this._playHeartbeatPulse();
    }, interval);
  }

  // ---- One-Shot Sound Effects ----

  _playHeartbeatPulse() {
    // "lub-dub" heartbeat using two quick sine pulses
    const now = this.ctx.currentTime;

    // Lub
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 60;
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.heartbeatGain);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Dub (slightly delayed and higher)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 50;
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(this.heartbeatGain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.3);
  }

  _playClick(intensity) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1000 + Math.random() * 2000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  _playWhoosh(intensity) {
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(100, now + 1);
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.15, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 1);
  }

  _playStaticBurst(intensity) {
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 0.5);
  }

  _playStinger(intensity) {
    // Sharp dissonant chord
    const now = this.ctx.currentTime;
    const freqs = [220, 233, 466, 740]; // Dissonant cluster

    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(intensity * 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.8);
    });
  }

  _playRumble(intensity) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 25;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  _playWhisper(intensity) {
    // Filtered noise that sounds like whispering
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Modulated noise for speech-like quality
      const env = Math.sin((i / this.ctx.sampleRate) * Math.PI * 3);
      data[i] = (Math.random() * 2 - 1) * env * 0.5;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

    // Pan to one side for unease
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.random() > 0.5 ? -0.8 : 0.8;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    source.start(now);
    source.stop(now + 2);
  }

  _playDeepDrone(intensity) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 35;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.15, now + 1);
    gain.gain.linearRampToValueAtTime(0, now + 4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 4);
  }

  _playHighTone(intensity) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 4000 + Math.random() * 2000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2);
  }

  _playCreak(intensity) {
    // Pitch-swept sine for a creaking door effect
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.8);
    osc.frequency.exponentialRampToValueAtTime(600, now + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.5);
  }
}

window.AudioEngine = AudioEngine;
