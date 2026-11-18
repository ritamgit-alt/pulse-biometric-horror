/**
 * hud.js — Heads-Up Display & Real-Time PPG Waveform Engine
 *
 * Displays live biometric telemetry, stress meters, and a real-time
 * photoplethysmogram (PPG) cardiac wave sweeping across the bio-cam.
 */

class HUD {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.bpmEl = document.getElementById('hud-bpm');
    this.breathEl = document.getElementById('hud-breath');
    this.fearFill = document.getElementById('fear-fill');
    this.sourceEl = document.getElementById('hud-source');
    this.camEl = document.getElementById('biometric-cam');

    // PPG Waveform canvas
    this.waveCanvas = document.getElementById('pulse-wave-canvas');
    this.waveCtx = this.waveCanvas ? this.waveCanvas.getContext('2d') : null;
    this.waveData = new Array(220).fill(20);
    this.waveX = 0;
    this.bpm = 72;

    this.visible = true;
    this.camVisible = true;

    if (this.waveCanvas) {
      this._startWaveAnimation();
    }
  }

  toggle() {
    this.visible = !this.visible;
    if (this.hudEl) this.hudEl.classList.toggle('hidden', !this.visible);
  }

  toggleCam() {
    this.camVisible = !this.camVisible;
    if (this.camEl) this.camEl.classList.toggle('hidden', !this.camVisible);
  }

  show() {
    this.visible = true;
    if (this.hudEl) this.hudEl.classList.remove('hidden');
    if (this.camEl) this.camEl.classList.remove('hidden');
  }

  update(data) {
    if (data.pulseRate) {
      this.bpm = data.pulseRate;
      if (this.bpmEl) this.bpmEl.textContent = Math.round(data.pulseRate);
    }

    if (this.breathEl && data.breathingRate) {
      this.breathEl.textContent = Math.round(data.breathingRate);
    }

    if (this.fearFill && data.stress !== undefined) {
      this.fearFill.style.width = `${Math.round(data.stress * 100)}%`;
    }

    if (this.sourceEl && data.isSimulated !== undefined) {
      this.sourceEl.textContent = data.isSimulated ? 'SIM' : 'SMARTSPECTRA';
      this.sourceEl.style.color = data.isSimulated ? '#ffaa33' : '#00ff88';
    }
  }

  _startWaveAnimation() {
    let phase = 0;

    const renderWave = () => {
      if (!this.waveCtx || !this.waveCanvas) return;

      const w = this.waveCanvas.width;
      const h = this.waveCanvas.height;
      const mid = h / 2;

      // Speed tied to BPM
      const speed = (this.bpm / 60) * 0.18;
      phase += speed;

      // Generate realistic rPPG pulse beat wave
      // Systolic peak + dicrotic notch
      const cycle = phase % (Math.PI * 2);
      let val = 0;
      if (cycle < 0.8) {
        val = -Math.sin((cycle / 0.8) * Math.PI) * (h * 0.38); // Sharp systolic contraction
      } else if (cycle < 1.3) {
        val = Math.sin(((cycle - 0.8) / 0.5) * Math.PI) * (h * 0.12); // Dicrotic notch bounce
      } else {
        val = Math.sin(cycle) * 2; // Resting baseline
      }

      this.waveData[this.waveX] = mid + val + (Math.random() - 0.5) * 1.5;
      this.waveX = (this.waveX + 1) % w;

      // Clear with dark trail
      this.waveCtx.fillStyle = 'rgba(0, 15, 8, 0.25)';
      this.waveCtx.fillRect(0, 0, w, h);

      // Draw sweeping green ECG line
      this.waveCtx.strokeStyle = '#00ff88';
      this.waveCtx.lineWidth = 1.8;
      this.waveCtx.shadowColor = '#00ff88';
      this.waveCtx.shadowBlur = 6;

      this.waveCtx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = this.waveData[x];
        if (x === 0) this.waveCtx.moveTo(x, y);
        else this.waveCtx.lineTo(x, y);
      }
      this.waveCtx.stroke();
      this.waveCtx.shadowBlur = 0;

      // Sweep head dot
      this.waveCtx.fillStyle = '#ffffff';
      this.waveCtx.beginPath();
      this.waveCtx.arc(this.waveX, this.waveData[this.waveX], 2.5, 0, Math.PI * 2);
      this.waveCtx.fill();

      requestAnimationFrame(renderWave);
    };

    renderWave();
  }
}

window.HUD = HUD;
