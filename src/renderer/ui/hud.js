/**
 * hud.js — Heads-Up Display for debug metrics
 */

class HUD {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.bpmEl = document.getElementById('hud-bpm');
    this.breathEl = document.getElementById('hud-breath');
    this.fearFill = document.getElementById('fear-fill');
    this.sourceEl = document.getElementById('hud-source');
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
    if (this.hudEl) {
      this.hudEl.classList.toggle('hidden', !this.visible);
    }
  }

  show() {
    this.visible = true;
    if (this.hudEl) this.hudEl.classList.remove('hidden');
  }

  update(data) {
    if (!this.visible) return;

    if (this.bpmEl && data.pulseRate) {
      this.bpmEl.textContent = Math.round(data.pulseRate);
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
}

window.HUD = HUD;
