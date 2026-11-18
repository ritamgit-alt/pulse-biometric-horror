/**
 * biometrics.js — SmartSpectra SDK Bridge
 *
 * Connects to the Presage SmartSpectra SDK via the Electron IPC preload,
 * captures real-time vitals, and exposes a clean API for the Fear Engine.
 */

class BiometricsManager {
  constructor() {
    // Current readings
    this.pulseRate = 0;         // BPM
    this.breathingRate = 0;     // breaths/min
    this.hrv = 0;               // ms (RMSSD or SDNN)
    this.signalQuality = 'searching';

    // Baseline (captured during calibration)
    this.baseline = {
      pulseRate: 0,
      breathingRate: 0,
      hrv: 0,
    };

    // History for trend detection
    this.pulseHistory = [];
    this.breathingHistory = [];
    this.hrvHistory = [];
    this.maxHistory = 60; // last 60 readings

    // Session stats for end-screen report
    this.sessionStats = {
      peakPulse: 0,
      lowestPulse: 999,
      peakBreathing: 0,
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
  }

  /**
   * Initialize the SDK and start the webcam stream.
   * @param {HTMLVideoElement} videoElement - Video element for camera preview
   * @param {Object} options - { apiKey }
   */
  async init(videoElement, options = {}) {
    try {
      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      videoElement.srcObject = this.stream;
      await videoElement.play();

      // Initialize SmartSpectra SDK via the preload bridge
      // The SDK is exposed via window.smartspectra from the preload script
      if (window.smartspectra) {
        this.sdk = window.smartspectra;

        // Configure the SDK
        await this.sdk.configure({
          apiKey: options.apiKey || '',
        });

        // Listen for metric updates
        this.sdk.on('metrics', (data) => {
          this._processMetrics(data);
        });

        // Listen for signal quality updates
        this.sdk.on('quality', (status) => {
          this.signalQuality = status.quality || status.message || 'unknown';
          if (this._onQuality) this._onQuality(this.signalQuality);
        });

        // Hand over the media stream
        this.sdk.useMediaStream(this.stream);

        console.log('[Biometrics] SDK initialized successfully');
      } else {
        console.warn('[Biometrics] SmartSpectra SDK not found on window, using simulation mode');
        this._startSimulation();
      }

      return true;
    } catch (err) {
      console.error('[Biometrics] Init failed:', err);
      // Fall back to simulation for development/testing
      this._startSimulation();
      return true;
    }
  }

  /**
   * Start measuring vitals
   */
  async start() {
    this.isRunning = true;
    this.sessionStats.startTime = Date.now();

    if (this.sdk) {
      await this.sdk.start();
    }
  }

  /**
   * Stop measuring
   */
  async stop() {
    this.isRunning = false;

    if (this.sdk) {
      await this.sdk.stop();
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
    if (this.pulseHistory.length < 5) {
      // Not enough data, use reasonable defaults
      this.baseline = { pulseRate: 72, breathingRate: 15, hrv: 50 };
    } else {
      this.baseline = {
        pulseRate: this._average(this.pulseHistory),
        breathingRate: this._average(this.breathingHistory),
        hrv: this._average(this.hrvHistory),
      };
    }
    console.log('[Biometrics] Baseline captured:', this.baseline);
  }

  /**
   * Get current deviation from baseline (0 = calm, 1+ = stressed)
   */
  getStressLevel() {
    if (!this.baseline.pulseRate) return 0;

    const pulseDelta =
      (this.pulseRate - this.baseline.pulseRate) / this.baseline.pulseRate;
    const breathDelta =
      (this.breathingRate - this.baseline.breathingRate) /
      Math.max(this.baseline.breathingRate, 1);
    const hrvDelta =
      (this.baseline.hrv - this.hrv) / Math.max(this.baseline.hrv, 1); // HRV drops under stress

    // Weighted combination — pulse is the strongest fear indicator
    const stress = pulseDelta * 0.5 + breathDelta * 0.3 + hrvDelta * 0.2;
    return Math.max(0, Math.min(1, stress * 3)); // Normalize to 0-1
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

    return recentAvg - priorAvg > 8; // 8+ BPM jump = scare detected
  }

  /**
   * Register callbacks
   */
  onMetrics(cb) { this._onMetrics = cb; }
  onQuality(cb) { this._onQuality = cb; }

  // ---- Internal Methods ----

  _processMetrics(data) {
    // Extract metrics from SDK data
    const pulse = data.pulseRate || data.cardio?.pulseRate || 0;
    const breathing = data.breathingRate || data.respiratory?.breathingRate || 0;
    const hrv = data.hrv || data.cardio?.hrv || data.heartRateVariability || 0;

    if (pulse > 0) {
      this.pulseRate = pulse;
      this._pushHistory(this.pulseHistory, pulse);

      // Update session stats
      this.sessionStats.peakPulse = Math.max(this.sessionStats.peakPulse, pulse);
      this.sessionStats.lowestPulse = Math.min(this.sessionStats.lowestPulse, pulse);
    }

    if (breathing > 0) {
      this.breathingRate = breathing;
      this._pushHistory(this.breathingHistory, breathing);
    }

    if (hrv > 0) {
      this.hrv = hrv;
      this._pushHistory(this.hrvHistory, hrv);
    }

    // Store reading for session report
    this.sessionStats.readings.push({
      time: Date.now(),
      pulse,
      breathing,
      hrv,
      stress: this.getStressLevel(),
    });

    if (this._onMetrics) {
      this._onMetrics({
        pulseRate: this.pulseRate,
        breathingRate: this.breathingRate,
        hrv: this.hrv,
        stress: this.getStressLevel(),
        spike: this.detectSpike(),
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
   * Simulation mode — for development without the SDK
   * Generates realistic-looking vital signs that respond to a simulated "scare"
   */
  _startSimulation() {
    console.log('[Biometrics] Running in SIMULATION mode');
    let basePulse = 68 + Math.random() * 10;
    let baseBreathing = 14 + Math.random() * 4;
    let baseHrv = 40 + Math.random() * 20;
    let scareTimer = 0;

    this._simInterval = setInterval(() => {
      if (!this.isRunning) return;

      // Simulate occasional scares
      scareTimer += 1;
      let scareFactor = 0;
      if (scareTimer > 30 && Math.random() < 0.05) {
        scareFactor = 0.3 + Math.random() * 0.5;
        scareTimer = 0;
      }

      const pulse =
        basePulse +
        scareFactor * 25 +
        (Math.random() - 0.5) * 3;
      const breathing =
        baseBreathing +
        scareFactor * 8 +
        (Math.random() - 0.5) * 2;
      const hrv =
        baseHrv -
        scareFactor * 15 +
        (Math.random() - 0.5) * 5;

      basePulse += (68 - basePulse) * 0.05; // Drift back to resting

      this.signalQuality = 'good';
      if (this._onQuality) this._onQuality('good');

      this._processMetrics({
        pulseRate: Math.max(50, pulse),
        breathingRate: Math.max(8, breathing),
        hrv: Math.max(10, hrv),
      });
    }, 1000);
  }
}

// Export as global
window.BiometricsManager = BiometricsManager;
