/**
 * app.js — Main Application Controller for PULSE
 *
 * Orchestrates the consent → calibration → horror → end screen flow,
 * connecting the BiometricsManager, FearEngine, HorrorRenderer,
 * AudioEngine, SceneManager, and HUD.
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
  const CALIBRATION_DURATION = 15000; // 15 seconds to establish baseline

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

    // Start capturing data
    await biometrics.start();

    // Update quality indicator
    biometrics.onQuality((quality) => {
      const indicator = document.getElementById('signal-quality');
      const text = document.getElementById('quality-text');
      if (quality === 'good' || quality === 'excellent') {
        indicator.classList.add('good');
        text.textContent = 'Signal locked';
      } else {
        indicator.classList.remove('good');
        text.textContent = quality || 'Adjusting...';
      }
    });

    // Update calibration metrics display
    biometrics.onMetrics((data) => {
      const status = document.getElementById('calibration-status');
      if (data.pulseRate > 0) {
        status.textContent = `Pulse: ${Math.round(data.pulseRate)} BPM | Breathing: ${Math.round(data.breathingRate)}/min`;
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

    // Switch camera feed to hidden video element
    const hiddenVideo = document.getElementById('webcam-hidden');
    if (biometrics.stream) {
      hiddenVideo.srcObject = biometrics.stream;
      await hiddenVideo.play();
    }

    // Initialize audio (needs user gesture — we have it from calibration click)
    await audio.init();

    // Start the renderer
    renderer.start();

    // Start the fear engine
    fearEngine.start();

    // Wire up fear engine events
    fearEngine.on('narrative', (text) => {
      sceneManager.showNarrative(text, 4000);
    });

    fearEngine.on('phase_change', (phase) => {
      console.log('[App] Phase change:', phase);
    });

    // Show HUD (optional — press H to toggle)
    hud.show();

    // Wire up biometrics to game loop
    biometrics.onMetrics((data) => {
      // Update HUD
      hud.update(data);

      // Feed into fear engine
      const events = fearEngine.update(data);

      // Process visual events
      renderer.processEvents(events);

      // Process audio events
      for (const event of events) {
        if (event.type === 'atmosphere') {
          audio.update(fearEngine.fearLevel, data);
        } else if (event.type === 'experience_end') {
          endExperience();
        } else if (
          event.type !== 'heartbeat_tick' &&
          event.type !== 'spike_detected' &&
          event.type !== 'atmosphere'
        ) {
          // It's a scare event
          audio.triggerScare(event.type, event.intensity || 0.5);
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        hud.toggle();
      }
      if (e.key === 'Escape') {
        endExperience();
      }
      if (e.key === 'F11') {
        // Handled in main process
      }
    });
  }

  // ========== PHASE 4: END SCREEN ==========
  function endExperience() {
    // Stop everything
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }

    renderer.stop();
    audio.stop();

    // Generate fear report
    const stats = biometrics.sessionStats;
    const fearSummary = fearEngine.getSummary();

    const reportEl = document.getElementById('fear-report');
    if (reportEl) {
      const duration = Math.round((Date.now() - stats.startTime) / 1000);
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
          <span class="fear-stat-value">${Math.round(biometrics.baseline.pulseRate)} BPM</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Peak Pulse</span>
          <span class="fear-stat-value">${Math.round(stats.peakPulse)} BPM</span>
        </div>
        <div class="fear-stat">
          <span class="fear-stat-label">Peak Pulse Spike</span>
          <span class="fear-stat-value">+${Math.round(stats.peakPulse - biometrics.baseline.pulseRate)} BPM</span>
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

    // Stop biometrics
    biometrics.stop();

    showScreen('end-screen');

    // Restart button
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
    console.log('[PULSE] Ready. Enter the dark.');
  });
})();
