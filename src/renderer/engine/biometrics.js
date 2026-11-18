/**
 * biometrics.js — SmartSpectra SDK Bridge
 *
 * Connects to the Presage SmartSpectra SDK via the Electron IPC preload,
 * captures real-time vitals, and exposes a clean API for the Fear Engine.
 * If no API key is present or the camera stream doesn't yield packets,
 * it seamlessly engages an adaptive biometric simulator so the experience
 * is always fully playable and testable.
 */

class BiometricsManager {
  constructor() {
    // Current readings
    this.pulseRate = 72;        // BPM default
    this.breathingRate = 14;    // breaths/min default
    this.hrv = 45;              // ms (RMSSD or SDNN)
    this.signalQuality = 'searching';
    this.isSimulating = false;
    this.hasReceivedSdkData = false;

    // Baseline (captured during calibration)
    this.baseline = {
      pulseRate: 72,
      breathingRate: 14,
      hrv: 45,
    };

    // History for trend detection
    this.pulseHistory = [];
    this.breathingHistory = [];
    this.hrvHistory = [];
    this.maxHistory = 60; // last 60 readings

    // Session stats for end-screen report
    this.sessionStats = {
      peakPulse: 72,
      lowestPulse: 72,
      peakBreathing: 14,
      scareCount: 0,
      startTime: null,
      readings: [],
    };

    // SDK instance
    this.sdk = null;
    this.stream = null;
    this.isRunning = false;

    // Callbacks
    this._onMetrics = null;
    this._onQuality = null;
    this._simInterval = null;
  }

  /**
   * Initialize the SDK and start the webcam stream.
   * @param {HTMLVideoElement} videoElement - Video element for camera preview
   * @param {Object} options - { apiKey }
   */
  async init(videoElement, options = {}) {
    const apiKey = (options.apiKey || '').trim();

    try {
      // 1. Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      if (videoElement) {
        videoElement.srcObject = this.stream;
        await videoElement.play().catch((e) => console.log('Video play caught:', e));
      }
    } catch (err) {
      console.warn('[Biometrics] Camera access denied or not found:', err.message);
    }

    // 2. Initialize SmartSpectra SDK if apiKey exists
    let sdkConfigured = false;
    if (apiKey && window.smartspectra) {
      try {
        console.log('[Biometrics] Configuring SmartSpectra SDK with API key...');
        this.sdk = window.smartspectra;

        const res = await this.sdk.configure({ apiKey });
        if (res && res.success) {
          sdkConfigured = true;

          this.sdk.on('metrics', (data) => {
            this.hasReceivedSdkData = true;
            this.isSimulating = false;
            this._processMetrics(data);
          });

          this.sdk.on('quality', (status) => {
            this.signalQuality = status.quality || status.hint || 'adjusting';
            if (this._onQuality) this._onQuality(this.signalQuality);
          });

          if (this.stream) {
            this.sdk.useMediaStream(this.stream);
          }
          console.log('[Biometrics] SmartSpectra SDK configured successfully');
        }
      } catch (err) {
        console.warn('[Biometrics] SDK configure error:', err.message);
      }
    }

    // 3. Fallback watchdog: if no SDK or no key, start adaptive simulation
    if (!sdkConfigured) {
      console.log('[Biometrics] No active SDK session — starting realistic simulation fallback.');
      this._startSimulation();
    } else {
      // Even if configured, give it 5 seconds to yield a metric. If silent, engage simulator.
      setTimeout(() => {
        if (!this.hasReceivedSdkData && this.isRunning) {
          console.log('[Biometrics] Watchdog: No SDK packets within 5s, engaging simulation fallback.');
          this._startSimulation();
        }
      }, 5000);
    }

    return true;
  }

  /**
   * Start measuring vitals
   */
  async start() {
    this.isRunning = true;
    this.sessionStats.startTime = Date.now();

    if (this.sdk) {
      try {
        await this.sdk.start();
      } catch (e) {
        console.warn('[Biometrics] SDK start failed:', e.message);
        this._startSimulation();
      }
    }
  }

  /**
   * Stop measuring
   */
  async stop() {
    this.isRunning = false;

    if (this.sdk) {
      try {
        await this.sdk.stop();
      } catch (e) {}
    }

    if (this._simInterval) {
      clearInterval(this._simInterval);
      this._simInterval = null;
    }

    // Stop camera
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
  }

  /**
   * Capture current readings as baseline (after calibration period)
   */
  captureBaseline() {
    if (this.pulseHistory.length < 3) {
      this.baseline = { pulseRate: 72, breathingRate: 14, hrv: 45 };
    } else {
      this.baseline = {
        pulseRate: Math.round(this._average(this.pulseHistory)) || 72,
        breathingRate: Math.round(this._average(this.breathingHistory)) || 14,
        hrv: Math.round(this._average(this.hrvHistory)) || 45,
      };
    }
    this.sessionStats.peakPulse = Math.max(this.sessionStats.peakPulse, this.baseline.pulseRate);
    this.sessionStats.lowestPulse = Math.min(this.sessionStats.lowestPulse, this.baseline.pulseRate);
    console.log('[Biometrics] Baseline captured:', this.baseline);
  }

  /**
   * Get current deviation from baseline (0 = calm, 1+ = stressed)
   */
  getStressLevel() {
    if (!this.baseline.pulseRate) return 0;

    const pulseDelta = (this.pulseRate - this.baseline.pulseRate) / this.baseline.pulseRate;
    const breathDelta =
      (this.breathingRate - this.baseline.breathingRate) /
      Math.max(this.baseline.breathingRate, 1);
    const hrvDelta =
      (this.baseline.hrv - this.hrv) / Math.max(this.baseline.hrv, 1);

    const stress = pulseDelta * 0.5 + breathDelta * 0.3 + hrvDelta * 0.2;
    return Math.max(0, Math.min(1, stress * 2.5));
  }

  /**
   * Detect if there's a sudden pulse spike (scare response)
   */
  detectSpike() {
    if (this.pulseHistory.length < 5) return false;
    const recent = this.pulseHistory.slice(-3);
    const prior = this.pulseHistory.slice(-8, -3);
    const recentAvg = this._average(recent);
    const priorAvg = this._average(prior);

    return recentAvg - priorAvg > 7;
  }

  /**
   * Trigger a simulated fright response in simulation mode
   */
  simulateScare(amount = 1.0) {
    if (this.isSimulating) {
      this._simScareFactor = Math.min(1.0, (this._simScareFactor || 0) + amount);
    }
  }

  /**
   * Register callbacks
   */
  onMetrics(cb) { this._onMetrics = cb; }
  onQuality(cb) { this._onQuality = cb; }

  // ---- Internal Methods ----

  _processMetrics(data) {
    const pulse = Math.round(data.pulseRate || data.cardio?.pulseRate || 0);
    const breathing = Math.round(data.breathingRate || data.respiratory?.breathingRate || 0);
    const hrv = Math.round(data.hrv || data.cardio?.hrv || 45);

    if (pulse > 30 && pulse < 220) {
      this.pulseRate = pulse;
      this._pushHistory(this.pulseHistory, pulse);

      this.sessionStats.peakPulse = Math.max(this.sessionStats.peakPulse, pulse);
      this.sessionStats.lowestPulse = Math.min(this.sessionStats.lowestPulse, pulse);
    }

    if (breathing > 5 && breathing < 60) {
      this.breathingRate = breathing;
      this._pushHistory(this.breathingHistory, breathing);
      this.sessionStats.peakBreathing = Math.max(this.sessionStats.peakBreathing, breathing);
    }

    if (hrv > 0) {
      this.hrv = hrv;
      this._pushHistory(this.hrvHistory, hrv);
    }

    this.sessionStats.readings.push({
      time: Date.now(),
      pulse: this.pulseRate,
      breathing: this.breathingRate,
      hrv: this.hrv,
      stress: this.getStressLevel(),
    });

    if (this._onMetrics) {
      this._onMetrics({
        pulseRate: this.pulseRate,
        breathingRate: this.breathingRate,
        hrv: this.hrv,
        stress: this.getStressLevel(),
        spike: this.detectSpike(),
        isSimulated: this.isSimulating,
      });
    }
  }

  _pushHistory(arr, val) {
    arr.push(val);
    if (arr.length > this.maxHistory) arr.shift();
  }

  _average(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Simulation mode — for development without the SDK or key.
   * Generates realistic resting and fear-reactive biometric data.
   */
  _startSimulation() {
    if (this._simInterval) return;
    this.isSimulating = true;
    this._simScareFactor = 0;

    let basePulse = 70 + Math.random() * 6;
    let baseBreathing = 14 + Math.random() * 2;
    let baseHrv = 48 + Math.random() * 8;

    this.signalQuality = 'good';
    if (this._onQuality) this._onQuality('good');

    this._simInterval = setInterval(() => {
      // Natural respiratory sinus arrhythmia + heart rate drift
      const naturalVariance = Math.sin(Date.now() / 3000) * 3;
      const scareBoost = this._simScareFactor * 32;

      // Decay scare factor back to calm over time
      this._simScareFactor = Math.max(0, this._simScareFactor - 0.08);

      const pulse = Math.round(basePulse + naturalVariance + scareBoost);
      const breathing = Math.round(baseBreathing + naturalVariance * 0.3 + this._simScareFactor * 8);
      const hrv = Math.round(Math.max(15, baseHrv - this._simScareFactor * 25));

      this._processMetrics({
        pulseRate: pulse,
        breathingRate: breathing,
        hrv: hrv,
      });
    }, 800);
  }
}

window.BiometricsManager = BiometricsManager;
