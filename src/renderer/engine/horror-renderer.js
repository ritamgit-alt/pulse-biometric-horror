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
    this.walkDistance = 0; // forward creeping motion
    this.walkSpeed = 0.003;

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
    this.walkDistance += this.walkSpeed;
    const headBobY = Math.sin(this.walkDistance * 28) * 4;
    const headBobX = Math.cos(this.walkDistance * 14) * 2.5;

    const cx = this.width / 2 + this.camX + headBobX;
    const cy = this.height / 2 + this.camY + headBobY;

    // Vanishing point at the end of the hall
    const depthSteps = 12;
    const endW = this.width * 0.10;
    const endH = this.height * 0.16;
    const endX = cx - endW / 2;
    const endY = cy - endH / 2;

    // 1. Draw End Wall & Dark Threshold
    this.ctx.fillStyle = `rgb(${8 + this.colorShift * 18}, 4, 6)`;
    this.ctx.fillRect(endX, endY, endW, endH);

    // 2. Hanging swinging ceiling lamp at the end
    const lampSwing = Math.sin(this.time * 2) * 12;
    const lampX = cx + lampSwing * 0.4;
    const lampY = endY + 20;

    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, 0);
    this.ctx.lineTo(lampX, lampY);
    this.ctx.stroke();

    // Lamp light pulse
    const bulbGlow = this.ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 80);
    bulbGlow.addColorStop(0, `rgba(255, 180, 80, ${0.35 * this.flashlightFlicker})`);
    bulbGlow.addColorStop(0.5, `rgba(180, 40, 30, ${0.12 * this.flashlightFlicker})`);
    bulbGlow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = bulbGlow;
    this.ctx.fillRect(lampX - 80, lampY - 80, 160, 160);

    // 3. Perspective Lines: Ceiling, Floor, Wall edges
    const corners = [
      [0, 0, endX, endY], // top-left
      [this.width, 0, endX + endW, endY], // top-right
      [this.width, this.height, endX + endW, endY + endH], // bottom-right
      [0, this.height, endX, endY + endH], // bottom-left
    ];

    this.ctx.strokeStyle = `rgba(${80 + this.colorShift * 60}, 35, 40, 0.45)`;
    this.ctx.lineWidth = 2.5;
    for (const [x1, y1, x2, y2] of corners) {
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    // 4. Moving Wall Ribs & Floor Planks (Continuous walking animation)
    for (let i = 0; i < depthSteps; i++) {
      const rawT = i / depthSteps + (this.walkDistance % (1 / depthSteps));
      const t = Math.max(0.01, Math.min(0.99, rawT));

      const w = this.width * (1 - t * 0.9);
      const h = this.height * (1 - t * 0.84);
      const x = cx - w / 2;
      const y = cy - h / 2;

      const alpha = Math.sin(t * Math.PI) * 0.45;
      this.ctx.strokeStyle = `rgba(${110 + this.colorShift * 60}, 45, 50, ${alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);

      // Floor plank lines
      const floorY = y + h;
      this.ctx.beginPath();
      this.ctx.moveTo(x + w * 0.25, floorY);
      this.ctx.lineTo(cx - endW * 0.2, endY + endH);
      this.ctx.moveTo(x + w * 0.5, floorY);
      this.ctx.lineTo(cx, endY + endH);
      this.ctx.moveTo(x + w * 0.75, floorY);
      this.ctx.lineTo(cx + endW * 0.2, endY + endH);
      this.ctx.stroke();

      // Side door frames
      if (i % 2 === 0 && t > 0.2 && t < 0.85) {
        const doorW = 20 * (1 - t * 0.7);
        const doorTop = y + h * 0.22;
        const doorBottom = floorY;

        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.7 - t * 0.3})`;
        this.ctx.fillRect(x - doorW, doorTop, doorW, doorBottom - doorTop);
        this.ctx.strokeStyle = `rgba(160, 40, 40, ${alpha * 0.8})`;
        this.ctx.strokeRect(x - doorW, doorTop, doorW, doorBottom - doorTop);
      }
    }

    // 5. Silhouette of The Entity watching from the end of the hall
    this._drawStalkerAtEnd(cx, cy, endW, endH, endX, endY);

    // Distant ominous glow down the hallway
    const glow = this.ctx.createRadialGradient(cx, cy, 5, cx, cy, endW * 1.5);
    glow.addColorStop(0, `rgba(${160 + this.colorShift * 80}, 20, 20, ${0.15 + this.colorShift * 0.25})`);
    glow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(cx - endW * 1.5, cy - endH * 1.5, endW * 3, endH * 3);
  }

  _drawStalkerAtEnd(cx, cy, endW, endH, endX, endY) {
    // Dark silhouetted entity standing under the swinging light at the end of the hall
    const stalkerScale = 1.0 + this.colorShift * 1.6;
    const sw = endW * 0.45 * stalkerScale;
    const sh = endH * 0.85 * stalkerScale;
    const sy = endY + endH - sh;

    this.ctx.fillStyle = '#020102';
    // Head
    this.ctx.beginPath();
    this.ctx.arc(cx, sy + sh * 0.2, sw * 0.35, 0, Math.PI * 2);
    this.ctx.fill();

    // Body
    this.ctx.beginPath();
    this.ctx.moveTo(cx - sw * 0.55, sy + sh * 0.4);
    this.ctx.lineTo(cx + sw * 0.55, sy + sh * 0.4);
    this.ctx.lineTo(cx + sw * 0.35, sy + sh);
    this.ctx.lineTo(cx - sw * 0.35, sy + sh);
    this.ctx.closePath();
    this.ctx.fill();

    // Piercing glowing red eyes that pulse with player heartbeat
    const eyeAlpha = 0.6 + Math.sin(this.time * 6) * 0.4;
    this.ctx.fillStyle = `rgba(255, 20, 20, ${eyeAlpha})`;
    this.ctx.beginPath();
    this.ctx.arc(cx - sw * 0.12, sy + sh * 0.19, 1.8, 0, Math.PI * 2);
    this.ctx.arc(cx + sw * 0.12, sy + sh * 0.19, 1.8, 0, Math.PI * 2);
    this.ctx.fill();
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
