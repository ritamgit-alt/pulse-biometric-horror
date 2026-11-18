/**
 * horror-renderer.js — Visual Rendering Engine
 *
 * Renders the horror scene on canvas and controls all visual effects
 * including shadows, entities, particles, screen distortion, and more.
 */

class HorrorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.animFrame = null;
    this.isRunning = false;

    // Visual state
    this.ambientLight = 0.03; // Very dark baseline
    this.flickerAmount = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.colorShift = 0; // 0=blueish, 1=reddish
    this.entityOpacity = 0;
    this.entityX = 0.5;
    this.entityY = 0.5;
    this.entityScale = 0;

    // Particle system for dust/fog
    this.particles = [];
    this.maxParticles = 80;

    // Eyes in the dark
    this.eyes = [];

    // Active effects queue
    this.activeEffects = [];

    // Corridor depth layers for parallax illusion
    this.corridorLayers = [];

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  /**
   * Start the render loop
   */
  start() {
    this.isRunning = true;
    this._initParticles();
    this._initCorridor();
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }

  /**
   * Process events from the Fear Engine
   */
  processEvents(events) {
    for (const event of events) {
      switch (event.type) {
        case 'atmosphere':
          this._updateAtmosphere(event.data);
          break;

        case 'flicker':
          this._triggerFlicker(event.intensity);
          break;

        case 'shadow_move':
          this._triggerShadow(event.intensity);
          break;

        case 'static_burst':
          this._triggerStatic(event.intensity);
          break;

        case 'face_flash':
          this._triggerFaceFlash(event.intensity);
          break;

        case 'screen_shake':
          this._triggerShake(event.intensity);
          break;

        case 'darkness':
          this._triggerDarkness(event.intensity);
          break;

        case 'eyes_in_dark':
          this._triggerEyes(event.intensity);
          break;

        case 'text_glitch':
          this._triggerTextGlitch();
          break;

        case 'breathing_fog':
          // Handled in atmosphere
          break;

        case 'heartbeat_tick':
          this._pulseHeartbeat(event.data);
          break;

        case 'spike_detected':
          this._onSpike();
          break;
      }
    }
  }

  // ---- Render Loop ----

  _loop() {
    if (!this.isRunning) return;

    this.ctx.save();

    // Apply screen shake
    this.ctx.translate(this.shakeX, this.shakeY);
    this.shakeX *= 0.9;
    this.shakeY *= 0.9;

    // Clear to near-black
    const r = Math.floor(2 + this.colorShift * 10);
    const g = Math.floor(2);
    const b = Math.floor(5 - this.colorShift * 3);
    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    this.ctx.fillRect(-10, -10, this.width + 20, this.height + 20);

    // Draw scene layers
    this._drawCorridor();
    this._drawParticles();
    this._drawEyes();
    this._drawEntity();
    this._drawFlicker();
    this._processActiveEffects();

    this.ctx.restore();

    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  // ---- Scene Elements ----

  _initCorridor() {
    // Create a vanishing-point corridor illusion
    this.corridorLayers = [];
    for (let i = 0; i < 8; i++) {
      this.corridorLayers.push({
        depth: i / 8,
        offset: 0,
        wallAlpha: 0.03 + i * 0.01,
      });
    }
  }

  _drawCorridor() {
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (const layer of this.corridorLayers) {
      const scale = 1 - layer.depth * 0.8;
      const w = this.width * scale;
      const h = this.height * scale;
      const x = cx - w / 2;
      const y = cy - h / 2;

      // Dark walls
      this.ctx.strokeStyle = `rgba(${40 + this.colorShift * 30}, 10, 15, ${layer.wallAlpha})`;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, w, h);

      // Faint light at the end of the corridor
      if (layer.depth > 0.6) {
        const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
        gradient.addColorStop(0, `rgba(60, 20, 20, ${this.ambientLight * 2})`);
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(cx - 100, cy - 100, 200, 200);
      }
    }
  }

  _initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this._createParticle());
    }
  }

  _createParticle() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.1 - Math.random() * 0.3,
      size: 1 + Math.random() * 2,
      alpha: 0.02 + Math.random() * 0.06,
      life: Math.random(),
    };
  }

  _drawParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.001;

      if (p.life <= 0 || p.y < -10 || p.x < -10 || p.x > this.width + 10) {
        Object.assign(p, this._createParticle());
        p.y = this.height + 10;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${100 + this.colorShift * 100}, 60, 60, ${p.alpha})`;
      this.ctx.fill();
    }
  }

  _drawEyes() {
    for (let i = this.eyes.length - 1; i >= 0; i--) {
      const eye = this.eyes[i];
      eye.alpha -= 0.003;

      if (eye.alpha <= 0) {
        this.eyes.splice(i, 1);
        continue;
      }

      // Two red dots
      const eyeSpacing = 12 * eye.scale;
      this.ctx.fillStyle = `rgba(200, 30, 30, ${eye.alpha})`;

      this.ctx.beginPath();
      this.ctx.arc(eye.x - eyeSpacing, eye.y, 3 * eye.scale, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(eye.x + eyeSpacing, eye.y, 3 * eye.scale, 0, Math.PI * 2);
      this.ctx.fill();

      // Faint glow
      const glow = this.ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, 40 * eye.scale);
      glow.addColorStop(0, `rgba(150, 0, 0, ${eye.alpha * 0.1})`);
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.fillRect(eye.x - 50, eye.y - 50, 100, 100);
    }
  }

  _drawEntity() {
    if (this.entityOpacity <= 0) return;

    const cx = this.width * this.entityX;
    const cy = this.height * this.entityY;
    const size = 150 * this.entityScale;

    // Dark silhouette with red glow
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${this.entityOpacity})`);
    gradient.addColorStop(0.5, `rgba(20, 0, 0, ${this.entityOpacity * 0.5})`);
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(cx - size, cy - size, size * 2, size * 2);

    // Fade entity
    this.entityOpacity *= 0.995;
  }

  _drawFlicker() {
    if (this.flickerAmount > 0) {
      this.ctx.fillStyle = `rgba(255, 240, 220, ${this.flickerAmount})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.flickerAmount *= 0.85;
    }
  }

  _processActiveEffects() {
    const now = Date.now();
    this.activeEffects = this.activeEffects.filter((e) => {
      if (now > e.endTime) return false;
      e.render(this.ctx, this.width, this.height, (now - e.startTime) / (e.endTime - e.startTime));
      return true;
    });
  }

  // ---- Effect Triggers ----

  _updateAtmosphere(data) {
    this.colorShift = this.colorShift * 0.95 + data.colorShift * 0.05;
    this.ambientLight = 0.02 + data.vignetteIntensity * 0.03;

    // Update CSS overlays
    const vignette = document.getElementById('vignette-overlay');
    if (vignette) vignette.style.opacity = 0.6 + data.vignetteIntensity * 0.35;

    const fog = document.getElementById('fog-overlay');
    if (fog) fog.style.opacity = data.fogDensity * 0.6;

    // Screen shake from biometrics
    this.shakeX += (Math.random() - 0.5) * data.shakeAmount;
    this.shakeY += (Math.random() - 0.5) * data.shakeAmount;
  }

  _triggerFlicker(intensity) {
    // Rapid light flicker
    let count = 0;
    const flicker = setInterval(() => {
      this.flickerAmount = intensity * 0.15 * (Math.random() > 0.5 ? 1 : 0);
      count++;
      if (count > 6 + Math.random() * 8) {
        clearInterval(flicker);
        this.flickerAmount = 0;
      }
    }, 50 + Math.random() * 100);
  }

  _triggerShadow(intensity) {
    // Dark shadow slides across the scene
    const startX = Math.random() > 0.5 ? -0.2 : 1.2;
    const endX = startX < 0 ? 0.6 : 0.4;

    this.entityOpacity = intensity * 0.6;
    this.entityScale = 0.8 + intensity * 0.5;
    this.entityX = startX;
    this.entityY = 0.3 + Math.random() * 0.4;

    const duration = 2000 + Math.random() * 2000;
    const start = Date.now();

    const animate = () => {
      const t = (Date.now() - start) / duration;
      if (t > 1) return;
      this.entityX = startX + (endX - startX) * t;
      requestAnimationFrame(animate);
    };
    animate();
  }

  _triggerStatic(intensity) {
    const overlay = document.getElementById('static-overlay');
    if (overlay) {
      overlay.style.opacity = intensity * 0.3;
      setTimeout(() => { overlay.style.opacity = 0; }, 300 + Math.random() * 500);
    }
  }

  _triggerFaceFlash(intensity) {
    // Brief white flash then lingering dark face impression
    const flash = document.getElementById('flash-overlay');
    if (flash) {
      flash.style.opacity = intensity * 0.8;
      setTimeout(() => { flash.style.opacity = 0; }, 60);
    }

    // Show entity as a "face"
    this.entityOpacity = intensity * 0.9;
    this.entityScale = 1.5;
    this.entityX = 0.5 + (Math.random() - 0.5) * 0.2;
    this.entityY = 0.5 + (Math.random() - 0.5) * 0.2;
  }

  _triggerShake(intensity) {
    this.shakeX = (Math.random() - 0.5) * intensity * 20;
    this.shakeY = (Math.random() - 0.5) * intensity * 20;
  }

  _triggerDarkness(intensity) {
    // Vignette closes in, nearly total darkness
    const vignette = document.getElementById('vignette-overlay');
    if (vignette) {
      vignette.style.background =
        'radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.98) 60%)';
      setTimeout(() => {
        vignette.style.background =
          'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.9) 100%)';
      }, 3000 + intensity * 3000);
    }
  }

  _triggerEyes(intensity) {
    // Pairs of red eyes appear in the dark corners
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      this.eyes.push({
        x: Math.random() * this.width,
        y: 50 + Math.random() * (this.height - 100),
        alpha: intensity * 0.6,
        scale: 0.5 + Math.random() * 1,
      });
    }
  }

  _triggerTextGlitch() {
    const narrative = document.getElementById('narrative-text');
    if (narrative) {
      const original = narrative.textContent;
      const glitchChars = '█▓▒░╠╬╣╚╝¥§Ω';
      let count = 0;
      const glitch = setInterval(() => {
        narrative.textContent = original
          .split('')
          .map((c) =>
            Math.random() < 0.3 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : c
          )
          .join('');
        count++;
        if (count > 8) {
          clearInterval(glitch);
          narrative.textContent = original;
        }
      }, 80);
    }
  }

  _pulseHeartbeat(data) {
    // Pulse the border with the user's actual heartbeat
    const border = document.getElementById('heartbeat-border');
    if (!border) return;

    // Calculate timing from BPM
    const interval = data.interval || 800;

    if (!this._heartbeatTimer) {
      this._heartbeatTimer = setInterval(() => {
        border.classList.add('beat');
        setTimeout(() => border.classList.remove('beat'), 150);
      }, interval);
    }
  }

  _onSpike() {
    // User had a fear spike — the game notices
    this._triggerFlicker(0.6);
    this.shakeX = (Math.random() - 0.5) * 10;
    this.shakeY = (Math.random() - 0.5) * 10;
  }
}

window.HorrorRenderer = HorrorRenderer;
