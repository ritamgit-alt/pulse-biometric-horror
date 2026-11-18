/**
 * app.js — Main Application Controller for PULSE
 *
 * Orchestrates the consent → calibration → horror → end screen flow,
 * running a continuous high-reliability game loop tied to biometrics.
 */

(function () {
  'use strict';

  // ---- Core Modules ----
  let biometrics;
  let fearEngine;
  let renderer;
  let audio;
  let sceneManager;
  let hud;

  // ---- State ----
  let gameLoop = null;
  let calibrationTimer = null;
  const CALIBRATION_DURATION = 12000; // 12 seconds to establish baseline

  let latestBiometrics = {
    pulseRate: 72,
    breathingRate: 14,
    hrv: 45,
    stress: 0,
    spike: false,
  };

  // ---- Screen Management ----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
  }

  // ========== PHASE 1: CONSENT ==========
  function initConsent() {
    const consentCheck = document.getElementById('consent-check');
    const beginBtn = document.getElementById('begin-btn');

    consentCheck.addEventListener('change', () => {
      beginBtn.disabled = !consentCheck.checked;
    });

    beginBtn.addEventListener('click', async () => {
      await startCalibration();
    });
  }

  // ========== PHASE 2: CALIBRATION ==========
  async function startCalibration() {
    showScreen('calibration-screen');

    // Initialize all modules
    biometrics = new BiometricsManager();
    fearEngine = new FearEngine();
    renderer = new HorrorRenderer(document.getElementById('horror-canvas'));
    audio = new AudioEngine();
    sceneManager = new SceneManager();
    hud = new HUD();

    // Initialize biometrics with the calibration video preview
    const videoEl = document.getElementById('webcam-preview');
    const envApiKey = window.smartspectra?.getApiKeyFromEnv?.() || '';
    await biometrics.init(videoEl, {
      apiKey: envApiKey || window.__SMARTSPECTRA_API_KEY || '',
    });

    await biometrics.start();

    // Update quality indicator
    biometrics.onQuality((quality) => {
      const indicator = document.getElementById('signal-quality');
      const text = document.getElementById('quality-text');
      if (quality === 'good' || quality === 'excellent') {
        indicator.classList.add('good');
        text.textContent = 'Signal locked (face detected)';
      } else {
        indicator.classList.remove('good');
        text.textContent = quality || 'Searching for face...';
      }
    });

    // Update calibration metrics display
    biometrics.onMetrics((data) => {
      latestBiometrics = data;
      const status = document.getElementById('calibration-status');
      if (status && data.pulseRate > 0) {
        status.textContent = `Pulse: ${Math.round(data.pulseRate)} BPM | Breathing: ${Math.round(data.breathingRate)}/min | Mode: ${data.isSimulated ? 'Simulation' : 'SmartSpectra Live'}`;
      }
    });

    // Progress bar animation
    const bar = document.getElementById('calibration-bar');
    const startTime = Date.now();

    calibrationTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / CALIBRATION_DURATION) * 100);
      bar.style.width = `${progress}%`;

      if (elapsed >= CALIBRATION_DURATION) {
        clearInterval(calibrationTimer);
        biometrics.captureBaseline();
        startHorror();
      }
    }, 100);
  }

  // ========== PHASE 3: HORROR EXPERIENCE ==========
  async function startHorror() {
    showScreen('horror-screen');

    // Switch camera feed to hidden element
    const hiddenVideo = document.getElementById('webcam-hidden');
    if (biometrics.stream && hiddenVideo) {
      hiddenVideo.srcObject = biometrics.stream;
      await hiddenVideo.play().catch(() => {});
    }

    // Initialize audio & start renderer
    await audio.init();
    renderer.start();
    fearEngine.start();

    // Storytelling narrative display
    fearEngine.on('narrative', (text) => {
      sceneManager.showNarrative(text, 5000);
    });

    // Show initial narrative sequence
    sceneManager.showNarrative("You shouldn't have come here.", 4000);
    setTimeout(() => {
      sceneManager.showNarrative("Aim your light with your mouse. Keep your heart calm.", 4500);
    }, 4500);

    // Show HUD by default so players can see their vitals live
    hud.show();

    // Listen for biometric updates
    biometrics.onMetrics((data) => {
      latestBiometrics = data;
      hud.update(data);

      if (data.spike) {
        sceneManager.showNarrative("IT HEARS YOUR PULSE RACING... BREATHE.", 3500);
      }
    });

    // Continuous 10Hz game loop (independent of camera frame rate)
    gameLoop = setInterval(() => {
      const events = fearEngine.update(latestBiometrics);

      // Pass events to visuals
      renderer.processEvents(events);

      // Pass events to audio
      for (const event of events) {
        if (event.type === 'atmosphere') {
          audio.update(fearEngine.fearLevel, latestBiometrics);
        } else if (event.type === 'experience_end') {
          endExperience();
        } else if (
          event.type !== 'heartbeat_tick' &&
          event.type !== 'spike_detected' &&
          event.type !== 'atmosphere'
        ) {
          audio.triggerScare(event.type, event.intensity || 0.6);
        }
      }
    }, 100);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        hud.toggle();
      }
      if (e.key === 'Escape') {
        endExperience();
      }
      // Spacebar to trigger a test fright spike
      if (e.code === 'Space') {
        biometrics.simulateScare(0.8);
      }
    });
  }

  // ========== PHASE 4: END SCREEN ==========
  function endExperience() {
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }

    if (renderer) renderer.stop();
    if (audio) audio.stop();

    const stats = biometrics.sessionStats;
    const fearSummary = fearEngine.getSummary();
    const restingPulse = Math.round(biometrics.baseline.pulseRate) || 72;
    const peakPulse = Math.max(restingPulse, Math.round(stats.peakPulse || 0));
    const spike = Math.max(0, peakPulse - restingPulse);

    const reportEl = document.getElementById('fear-report');
    if (reportEl) {
      const duration = Math.round((Date.now() - (stats.startTime || Date.now())) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      reportEl.innerHTML = `
        <h3>YOUR FEAR PROFILE</h3>
        <div class="fear-stat">
          <span class="fear-stat-label">Duration Survived</span>
          <span class="fear-stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Resting Pulse</span>
          <span class="fear-stat-value">${restingPulse} BPM</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Peak Pulse</span>
          <span class="fear-stat-value">${peakPulse} BPM</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Peak Pulse Spike</span>
          <span class="fear-stat-value">+${spike} BPM</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Fear Responsiveness</span>
          <span class="fear-stat-value">${fearSummary.fearResponsiveness}</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Phases Survived</span>
          <span class="fear-stat-value">${fearSummary.phasesReached} / ${fearSummary.totalPhases}</span>
        </div>
      `;
    }

    if (biometrics) biometrics.stop();
    showScreen('end-screen');

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.onclick = () => {
        window.location.reload();
      };
    }
  }

  // ========== INIT ==========
  window.addEventListener('DOMContentLoaded', () => {
    initConsent();
    console.log('[PULSE] System ready.');
  });
})();
