/**
 * horror-renderer.js — Atmospheric 2.5D Canvas Horror Renderer
 *
 * Renders an immersive, terrifying perspective corridor with dynamic flashlight,
 * volumetric fog, drifting particles, shadows, glowing eyes, and screen-distorting
 * biometric scare events.
 */

class HorrorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.animFrame = null;
    this.isRunning = false;

    // Camera & Flashlight
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
    this.camX = 0;
    this.camY = 0;
    this.flashlightFlicker = 1.0;
    this.time = 0;

    // Environmental state
    this.ambientLight = 0.12;
    this.colorShift = 0; // 0 = cool grey/blue, 1 = intense crimson
    this.shakeX = 0;
    this.shakeY = 0;
    this.fogDensity = 0.4;
    this.heartbeatScale = 0;

    // Entity & Jumpscare
    this.entityActive = false;
    this.entityDepth = 0.9; // 0 = close, 1 = distant end of hall
    this.entityAlpha = 0;
    this.entityType = 'shadow';
    this.jumpscareAlpha = 0;

    // Atmospheric objects
    this.particles = [];
    this.maxParticles = 120;
    this.eyes = [];
    this.whisperRuns = [];

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  _resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  start() {
    this.isRunning = true;
    this._initParticles();
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }

  processEvents(events) {
    if (!events) return;
    for (const event of events) {
      switch (event.type) {
        case 'atmosphere':
          this._updateAtmosphere(event.data);
          break;
        case 'flicker':
          this._triggerFlicker(event.intensity || 0.6);
          break;
        case 'shadow_move':
          this._triggerShadow(event.intensity || 0.7);
          break;
        case 'static_burst':
          this._triggerStatic(event.intensity || 0.5);
          break;
        case 'face_flash':
          this._triggerFaceFlash(event.intensity || 0.9);
          break;
        case 'screen_shake':
          this._triggerShake(event.intensity || 0.6);
          break;
        case 'darkness':
          this._triggerDarkness(event.intensity || 0.8);
          break;
        case 'eyes_in_dark':
          this._triggerEyes(event.intensity || 0.7);
          break;
        case 'heartbeat_tick':
          this._pulseHeartbeat(event.data);
          break;
        case 'spike_detected':
          this._triggerShake(1.2);
          this._triggerFlicker(1.0);
          break;
      }
    }
  }

  // ---- Main Render Loop ----

  _loop() {
    if (!this.isRunning) return;
    this.time += 0.016;

    // Smooth flashlight camera tracking with slight breathing bob
    const targetCamX = (this.mouseX - this.width / 2) * 0.15;
    const targetCamY = (this.mouseY - this.height / 2) * 0.15 + Math.sin(this.time * 2) * 3;
    this.camX += (targetCamX - this.camX) * 0.08;
    this.camY += (targetCamY - this.camY) * 0.08;

    this.ctx.save();

    // Screen shake
    this.ctx.translate(this.shakeX, this.shakeY);
    this.shakeX *= 0.88;
    this.shakeY *= 0.88;

    // 1. Dark Void Base
    const r = Math.floor(6 + this.colorShift * 18);
    const g = Math.floor(4);
    const b = Math.floor(8 - this.colorShift * 4);
    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    this.ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    // 2. Render 3D Perspective Hallway
    this._drawHallway();

    // 3. Entity & Shadows
    this._drawEntity();

    // 4. Floating Atmospheric Dust & Fog
    this._drawParticles();
    this._drawEyes();

    // 5. Flashlight Cone Lighting Overlay
    this._drawFlashlightLighting();

    // 6. Dynamic Biometric Heartbeat Pulse Border
    this._drawHeartbeatPulse();

    // 7. Jumpscare Flash Overlay
    if (this.jumpscareAlpha > 0) {
      this._drawJumpscare();
      this.jumpscareAlpha *= 0.92;
    }

    this.ctx.restore();

    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  // ---- Scene Rendering ----

  _drawHallway() {
    const cx = this.width / 2 + this.camX;
    const cy = this.height / 2 + this.camY;

    // Vanishing point at the end of the hall
    const depthSteps = 10;
    const endW = this.width * 0.12;
    const endH = this.height * 0.18;
    const endX = cx - endW / 2;
    const endY = cy - endH / 2;

    // Draw End Wall (The dark doorway at the end)
    this.ctx.fillStyle = `rgb(${10 + this.colorShift * 15}, 6, 8)`;
    this.ctx.fillRect(endX, endY, endW, endH);

    // Doorway frame at the end
    this.ctx.strokeStyle = `rgba(${120 + this.colorShift * 80}, 30, 35, 0.4)`;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(endX, endY, endW, endH);

    // Draw Perspective Lines: Ceiling, Floor, Wall edges
    const corners = [
      [0, 0, endX, endY], // top-left
      [this.width, 0, endX + endW, endY], // top-right
      [this.width, this.height, endX + endW, endY + endH], // bottom-right
      [0, this.height, endX, endY + endH], // bottom-left
    ];

    this.ctx.strokeStyle = `rgba(${70 + this.colorShift * 60}, 40, 45, 0.35)`;
    this.ctx.lineWidth = 2;
    for (const [x1, y1, x2, y2] of corners) {
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    // Floorboards & Wall Ribs along the depth
    for (let i = 1; i <= depthSteps; i++) {
      const t = i / depthSteps;
      const w = this.width + (endW - this.width) * t;
      const h = this.height + (endH - this.height) * t;
      const x = cx - w / 2;
      const y = cy - h / 2;

      const alpha = (1 - t * 0.7) * 0.3;
      this.ctx.strokeStyle = `rgba(${80 + this.colorShift * 70}, 45, 50, ${alpha})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(x, y, w, h);

      // Floor plank lines
      const floorY = y + h;
      this.ctx.beginPath();
      this.ctx.moveTo(x + w * 0.35, floorY);
      this.ctx.lineTo(cx - endW * 0.15, endY + endH);
      this.ctx.moveTo(x + w * 0.65, floorY);
      this.ctx.lineTo(cx + endW * 0.15, endY + endH);
      this.ctx.stroke();

      // Side doors along the hallway
      if (i % 2 === 0 && t < 0.8) {
        // Left door
        const doorTop = y + h * 0.2;
        const doorBottom = y + h;
        this.ctx.fillStyle = `rgba(0, 0, 0, 0.4)`;
        this.ctx.fillRect(x - 15, doorTop, 15, doorBottom - doorTop);
        this.ctx.strokeStyle = `rgba(${90 + this.colorShift * 50}, 30, 30, 0.3)`;
        this.ctx.strokeRect(x - 15, doorTop, 15, doorBottom - doorTop);
      }
    }

    // Distant ominous glow down the hallway
    const glow = this.ctx.createRadialGradient(cx, cy, 5, cx, cy, endW * 1.5);
    glow.addColorStop(0, `rgba(${160 + this.colorShift * 80}, 20, 20, ${0.15 + this.colorShift * 0.25})`);
    glow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(cx - endW * 1.5, cy - endH * 1.5, endW * 3, endH * 3);
  }

  _drawFlashlightLighting() {
    const fx = this.mouseX;
    const fy = this.mouseY;
    const radius = Math.max(this.width, this.height) * 0.55;

    // Flashlight flicker modifier
    const flicker = Math.min(1.0, this.flashlightFlicker + (Math.random() - 0.5) * 0.05);

    // Vignette / Shadow mask with cutout for flashlight
    const lightGrad = this.ctx.createRadialGradient(fx, fy, 40, fx, fy, radius);
    lightGrad.addColorStop(0, `rgba(255, 235, 200, ${0.08 * flicker})`);
    lightGrad.addColorStop(0.3, `rgba(200, 180, 160, ${0.04 * flicker})`);
    lightGrad.addColorStop(0.7, `rgba(0, 0, 0, ${0.65})`);
    lightGrad.addColorStop(1.0, `rgba(0, 0, 0, ${0.94})`);

    this.ctx.fillStyle = lightGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  _initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.15 - Math.random() * 0.35,
        size: 1 + Math.random() * 2.5,
        alpha: 0.1 + Math.random() * 0.3,
      });
    }
  }

  _drawParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -10 || p.x < -10 || p.x > this.width + 10) {
        p.x = Math.random() * this.width;
        p.y = this.height + 10;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${160 + this.colorShift * 80}, ${140 - this.colorShift * 60}, 140, ${p.alpha})`;
      this.ctx.fill();
    }
  }

  _drawEntity() {
    if (this.entityAlpha <= 0.01) return;

    const cx = this.width / 2 + this.camX;
    const cy = this.height / 2 + this.camY;

    // Scale and position based on depth
    const scale = (1 - this.entityDepth * 0.7);
    const w = 120 * scale;
    const h = 260 * scale;
    const x = cx - w / 2;
    const y = cy + (this.height * 0.05) - h / 2;

    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1.0, this.entityAlpha);

    // Dark shadowy humanoid silhouette
    this.ctx.fillStyle = '#050203';
    this.ctx.beginPath();
    // Head
    this.ctx.arc(cx, y + h * 0.15, w * 0.22, 0, Math.PI * 2);
    this.ctx.fill();

    // Shoulders and torso
    this.ctx.beginPath();
    this.ctx.moveTo(cx - w * 0.4, y + h * 0.35);
    this.ctx.lineTo(cx + w * 0.4, y + h * 0.35);
    this.ctx.lineTo(cx + w * 0.25, y + h);
    this.ctx.lineTo(cx - w * 0.25, y + h);
    this.ctx.closePath();
    this.ctx.fill();

    // Red glowing eye slit
    this.ctx.fillStyle = `rgba(255, 30, 30, ${this.entityAlpha * 0.9})`;
    this.ctx.beginPath();
    this.ctx.arc(cx - w * 0.08, y + h * 0.15, 3 * scale, 0, Math.PI * 2);
    this.ctx.arc(cx + w * 0.08, y + h * 0.15, 3 * scale, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // Fade slowly over time
    this.entityAlpha *= 0.985;
  }

  _drawEyes() {
    for (let i = this.eyes.length - 1; i >= 0; i--) {
      const eye = this.eyes[i];
      eye.alpha -= 0.005;

      if (eye.alpha <= 0) {
        this.eyes.splice(i, 1);
        continue;
      }

      const spacing = 16 * eye.scale;
      this.ctx.fillStyle = `rgba(255, 40, 40, ${eye.alpha})`;

      this.ctx.beginPath();
      this.ctx.ellipse(eye.x - spacing, eye.y, 4 * eye.scale, 2.5 * eye.scale, 0, 0, Math.PI * 2);
      this.ctx.ellipse(eye.x + spacing, eye.y, 4 * eye.scale, 2.5 * eye.scale, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Eye glow
      const glow = this.ctx.createRadialGradient(eye.x, eye.y, 2, eye.x, eye.y, 40 * eye.scale);
      glow.addColorStop(0, `rgba(255, 0, 0, ${eye.alpha * 0.2})`);
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.fillRect(eye.x - 50, eye.y - 50, 100, 100);
    }
  }

  _drawHeartbeatPulse() {
    if (this.heartbeatScale <= 0.01) return;

    // Red pulsating vignette border
    const pulseGrad = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.width * 0.35,
      this.width / 2, this.height / 2, this.width * 0.65
    );
    pulseGrad.addColorStop(0, 'transparent');
    pulseGrad.addColorStop(1, `rgba(220, 15, 15, ${this.heartbeatScale * 0.45})`);

    this.ctx.fillStyle = pulseGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.heartbeatScale *= 0.88; // Quick decay like a heartbeat
  }

  _drawJumpscare() {
    // White/red screen flashes with distorted demonic face impression
    this.ctx.fillStyle = `rgba(240, 20, 20, ${this.jumpscareAlpha * 0.4})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;

    this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.jumpscareAlpha * 0.8})`;
    this.ctx.lineWidth = 4;
    // Screaming open mouth
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy + 50, 60, 110, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    // Huge hollow eyes
    this.ctx.beginPath();
    this.ctx.arc(cx - 70, cy - 60, 35, 0, Math.PI * 2);
    this.ctx.arc(cx + 70, cy - 60, 35, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  // ---- Triggers ----

  _updateAtmosphere(data) {
    if (!data) return;
    this.colorShift = this.colorShift * 0.9 + (data.colorShift || 0) * 0.1;
  }

  _pulseHeartbeat(data) {
    this.heartbeatScale = 1.0;
  }

  _triggerFlicker(intensity) {
    let flips = 0;
    const interval = setInterval(() => {
      this.flashlightFlicker = Math.random() > 0.5 ? 0.05 : 1.0;
      flips++;
      if (flips > 8) {
        clearInterval(interval);
        this.flashlightFlicker = 1.0;
      }
    }, 60);
  }

  _triggerShadow(intensity) {
    this.entityActive = true;
    this.entityDepth = 0.8 - Math.random() * 0.3;
    this.entityAlpha = Math.min(1.0, intensity);
  }

  _triggerStatic(intensity) {
    const overlay = document.getElementById('static-overlay');
    if (overlay) {
      overlay.style.opacity = intensity * 0.4;
      setTimeout(() => { overlay.style.opacity = 0; }, 250);
    }
  }

  _triggerFaceFlash(intensity) {
    this.jumpscareAlpha = intensity;
    this._triggerShake(1.4);
    const flash = document.getElementById('flash-overlay');
    if (flash) {
      flash.style.opacity = 0.9;
      setTimeout(() => { flash.style.opacity = 0; }, 80);
    }
  }

  _triggerShake(intensity) {
    this.shakeX = (Math.random() - 0.5) * intensity * 24;
    this.shakeY = (Math.random() - 0.5) * intensity * 24;
  }

  _triggerDarkness(intensity) {
    this.flashlightFlicker = 0.05;
    setTimeout(() => { this.flashlightFlicker = 1.0; }, 1800 * intensity);
  }

  _triggerEyes(intensity) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.eyes.push({
      x: cx + (Math.random() - 0.5) * this.width * 0.6,
      y: cy + (Math.random() - 0.5) * this.height * 0.4,
      scale: 0.8 + Math.random() * 0.8,
      alpha: intensity,
    });
  }
}

window.HorrorRenderer = HorrorRenderer;
