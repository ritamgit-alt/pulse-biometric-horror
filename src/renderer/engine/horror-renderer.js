/**
 * horror-renderer.js — Atmospheric 2.5D Canvas Horror Renderer
 *
 * Renders an immersive, terrifying perspective corridor with a dynamic flashlight,
 * volumetric dust, dynamic shadows, and a terrifying sprinting monster that charges
 * straight at the camera when your heart rate spikes!
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
    this.walkDistance = 0;
    this.walkSpeed = 0.003;

    // SPRINTING MONSTER STATE
    this.monsterDistance = 1.0; // 1.0 = distant doorway, 0.06 = in your face!
    this.isChasing = false;
    this.isRetreating = false;
    this.chaseTimer = 0;
    this.jumpscareAlpha = 0;

    // Atmospheric objects
    this.particles = [];
    this.maxParticles = 140;
    this.eyes = [];

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

  // ---- Monster Chase Controls ----

  startMonsterCharge() {
    this.isChasing = true;
    this.isRetreating = false;
    this.chaseTimer = Date.now();
    this._triggerFlicker(1.0);
    this.shakeX = (Math.random() - 0.5) * 30;
    this.shakeY = (Math.random() - 0.5) * 30;
  }

  retreatMonster() {
    if (this.isChasing || this.monsterDistance < 0.95) {
      this.isChasing = false;
      this.isRetreating = true;
    }
  }

  processEvents(events) {
    if (!events) return;
    for (const event of events) {
      switch (event.type) {
        case 'atmosphere':
          this._updateAtmosphere(event.data);
          break;
        case 'monster_charge':
          this.startMonsterCharge();
          break;
        case 'monster_retreat':
          this.retreatMonster();
          break;
        case 'flicker':
          this._triggerFlicker(event.intensity || 0.6);
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
        case 'eyes_in_dark':
          this._triggerEyes(event.intensity || 0.7);
          break;
        case 'heartbeat_tick':
          this._pulseHeartbeat(event.data);
          break;
        case 'spike_detected':
          this.startMonsterCharge();
          break;
      }
    }
  }

  // ---- Main Render Loop ----

  _loop() {
    if (!this.isRunning) return;
    this.time += 0.016;

    // Camera tracking flashlight with walking headbob
    const targetCamX = (this.mouseX - this.width / 2) * 0.15;
    const targetCamY = (this.mouseY - this.height / 2) * 0.15 + Math.sin(this.time * 2) * 3;
    this.camX += (targetCamX - this.camX) * 0.08;
    this.camY += (targetCamY - this.camY) * 0.08;

    // Monster sprint movement logic
    if (this.isChasing) {
      // Sprints closer every frame!
      this.monsterDistance = Math.max(0.06, this.monsterDistance - 0.016);
      this.shakeX += (Math.random() - 0.5) * 14;
      this.shakeY += (Math.random() - 0.5) * 14;
      this.colorShift = Math.min(1.0, this.colorShift + 0.04);

      // In-your-face jumpscare trigger
      if (this.monsterDistance <= 0.07 && this.jumpscareAlpha <= 0.1) {
        this.jumpscareAlpha = 1.0;
        this._triggerFaceFlash(1.0);
      }
    } else if (this.isRetreating) {
      // Stumbles back into the shadows
      this.monsterDistance = Math.min(1.0, this.monsterDistance + 0.035);
      this.colorShift = Math.max(0, this.colorShift - 0.03);
      if (this.monsterDistance >= 0.98) {
        this.isRetreating = false;
      }
    }

    this.ctx.save();

    // Screen shake
    this.ctx.translate(this.shakeX, this.shakeY);
    this.shakeX *= 0.86;
    this.shakeY *= 0.86;

    // 1. Dark Void Base
    const r = Math.floor(6 + this.colorShift * 26);
    const g = Math.floor(4);
    const b = Math.floor(8 - this.colorShift * 5);
    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    this.ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    // 2. Render 3D Perspective Hallway
    this._drawHallway();

    // 3. Render Sprinting / Stalking Monster
    this._drawMonster();

    // 4. Floating Atmospheric Dust & Glowing Eyes
    this._drawParticles();
    this._drawEyes();

    // 5. Flashlight Cone Lighting Overlay
    this._drawFlashlightLighting();

    // 6. Dynamic Biometric Heartbeat Pulse Border
    this._drawHeartbeatPulse();

    // 7. Jumpscare Flash Overlay
    if (this.jumpscareAlpha > 0) {
      this._drawJumpscare();
      this.jumpscareAlpha *= 0.91;
    }

    this.ctx.restore();

    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  // ---- Hallway Rendering ----

  _drawHallway() {
    this.walkDistance += this.walkSpeed;
    const headBobY = Math.sin(this.walkDistance * 28) * 4;
    const headBobX = Math.cos(this.walkDistance * 14) * 2.5;

    const cx = this.width / 2 + this.camX + headBobX;
    const cy = this.height / 2 + this.camY + headBobY;

    const depthSteps = 12;
    const endW = this.width * 0.10;
    const endH = this.height * 0.16;
    const endX = cx - endW / 2;
    const endY = cy - endH / 2;

    // End Wall
    this.ctx.fillStyle = `rgb(${8 + this.colorShift * 20}, 4, 6)`;
    this.ctx.fillRect(endX, endY, endW, endH);

    // Ceiling Lamp at the end
    const lampSwing = Math.sin(this.time * 2.2) * 12;
    const lampX = cx + lampSwing * 0.4;
    const lampY = endY + 20;

    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, 0);
    this.ctx.lineTo(lampX, lampY);
    this.ctx.stroke();

    const bulbGlow = this.ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 80);
    bulbGlow.addColorStop(0, `rgba(255, 180, 80, ${0.4 * this.flashlightFlicker})`);
    bulbGlow.addColorStop(0.5, `rgba(180, 40, 30, ${0.15 * this.flashlightFlicker})`);
    bulbGlow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = bulbGlow;
    this.ctx.fillRect(lampX - 80, lampY - 80, 160, 160);

    // Corner perspective lines
    const corners = [
      [0, 0, endX, endY],
      [this.width, 0, endX + endW, endY],
      [this.width, this.height, endX + endW, endY + endH],
      [0, this.height, endX, endY + endH],
    ];

    this.ctx.strokeStyle = `rgba(${80 + this.colorShift * 80}, 35, 40, 0.45)`;
    this.ctx.lineWidth = 2.5;
    for (const [x1, y1, x2, y2] of corners) {
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    // Moving Wall Ribs & Floor Planks
    for (let i = 0; i < depthSteps; i++) {
      const rawT = i / depthSteps + (this.walkDistance % (1 / depthSteps));
      const t = Math.max(0.01, Math.min(0.99, rawT));

      const w = this.width * (1 - t * 0.9);
      const h = this.height * (1 - t * 0.84);
      const x = cx - w / 2;
      const y = cy - h / 2;

      const alpha = Math.sin(t * Math.PI) * 0.45;
      this.ctx.strokeStyle = `rgba(${110 + this.colorShift * 70}, 45, 50, ${alpha})`;
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

      // Side doors
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
  }

  // ---- THE SPRINTING MONSTER ----

  _drawMonster() {
    const cx = this.width / 2 + this.camX;
    const cy = this.height / 2 + this.camY;

    // Distance 1.0 (far end) down to 0.06 (right in your face!)
    const d = this.monsterDistance;
    const scale = Math.pow(1 - d * 0.92, 1.8);

    const mw = this.width * 0.16 * scale;
    const mh = this.height * 0.48 * scale;
    const mx = cx - mw / 2;
    const my = cy + (this.height * 0.12 * (1 - d)) - mh * 0.5;

    this.ctx.save();

    // Violent running flail when sprinting!
    const runSway = this.isChasing ? Math.sin(this.time * 26) * (18 * scale) : 0;
    const headTwitch = this.isChasing ? (Math.random() - 0.5) * (12 * scale) : 0;

    // Dark demonic silhouette
    this.ctx.fillStyle = '#050204';

    // 1. Torso & ragged coat
    this.ctx.beginPath();
    this.ctx.moveTo(cx - mw * 0.45 + runSway, my + mh * 0.35);
    this.ctx.lineTo(cx + mw * 0.45 + runSway, my + mh * 0.35);
    this.ctx.lineTo(cx + mw * 0.35 - runSway, my + mh);
    this.ctx.lineTo(cx - mw * 0.35 - runSway, my + mh);
    this.ctx.closePath();
    this.ctx.fill();

    // 2. Thrashing clawing arms
    const armFlailL = this.isChasing ? Math.sin(this.time * 24) * (mw * 0.8) : mw * 0.2;
    const armFlailR = this.isChasing ? -Math.cos(this.time * 24) * (mw * 0.8) : -mw * 0.2;

    this.ctx.strokeStyle = '#050204';
    this.ctx.lineWidth = Math.max(3, 8 * scale);
    this.ctx.beginPath();
    // Left arm
    this.ctx.moveTo(cx - mw * 0.4 + runSway, my + mh * 0.4);
    this.ctx.lineTo(cx - mw * 0.7 + armFlailL, my + mh * 0.65);
    this.ctx.lineTo(cx - mw * 0.8 + armFlailL, my + mh * 0.95);
    // Right arm
    this.ctx.moveTo(cx + mw * 0.4 + runSway, my + mh * 0.4);
    this.ctx.lineTo(cx + mw * 0.7 + armFlailR, my + mh * 0.65);
    this.ctx.lineTo(cx + mw * 0.8 + armFlailR, my + mh * 0.95);
    this.ctx.stroke();

    // 3. Head & Gaping Jagged Mouth
    this.ctx.beginPath();
    this.ctx.arc(cx + headTwitch, my + mh * 0.18, mw * 0.32, 0, Math.PI * 2);
    this.ctx.fill();

    // Gaping screaming maw when close/chasing
    if (d < 0.65 || this.isChasing) {
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.ellipse(cx + headTwitch, my + mh * 0.24, mw * 0.14, mh * 0.12, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Sharp razor teeth
      this.ctx.fillStyle = '#eeddcc';
      for (let t = -3; t <= 3; t++) {
        const tx = cx + headTwitch + t * (mw * 0.035);
        this.ctx.beginPath();
        this.ctx.moveTo(tx - 2, my + mh * 0.17);
        this.ctx.lineTo(tx + 2, my + mh * 0.17);
        this.ctx.lineTo(tx, my + mh * 0.21);
        this.ctx.fill();
      }
    }

    // 4. Piercing Red Eyes (Glow flares as monster gets closer!)
    const eyeAlpha = Math.min(1.0, 0.7 + (1 - d) * 0.4 + Math.sin(this.time * 12) * 0.2);
    const eyeSize = Math.max(2, 5 * scale);
    const eyeSpacing = mw * 0.14;

    this.ctx.fillStyle = `rgba(255, 20, 20, ${eyeAlpha})`;
    this.ctx.beginPath();
    this.ctx.arc(cx + headTwitch - eyeSpacing, my + mh * 0.15, eyeSize, 0, Math.PI * 2);
    this.ctx.arc(cx + headTwitch + eyeSpacing, my + mh * 0.15, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();

    // Eye flare beams when close
    if (d < 0.5) {
      const flare = this.ctx.createRadialGradient(
        cx + headTwitch, my + mh * 0.15, 2,
        cx + headTwitch, my + mh * 0.15, mw * 0.9
      );
      flare.addColorStop(0, `rgba(255, 0, 0, ${0.45 * (1 - d)})`);
      flare.addColorStop(1, 'transparent');
      this.ctx.fillStyle = flare;
      this.ctx.fillRect(cx - mw, my - mh * 0.2, mw * 2, mh);
    }

    this.ctx.restore();
  }

  // ---- Atmosphere & Lighting ----

  _drawFlashlightLighting() {
    const fx = this.mouseX;
    const fy = this.mouseY;
    const radius = Math.max(this.width, this.height) * 0.55;
    const flicker = Math.min(1.0, this.flashlightFlicker + (Math.random() - 0.5) * 0.05);

    const lightGrad = this.ctx.createRadialGradient(fx, fy, 40, fx, fy, radius);
    lightGrad.addColorStop(0, `rgba(255, 235, 200, ${0.08 * flicker})`);
    lightGrad.addColorStop(0.3, `rgba(200, 180, 160, ${0.04 * flicker})`);
    lightGrad.addColorStop(0.7, `rgba(0, 0, 0, ${0.65 + this.colorShift * 0.2})`);
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
    }
  }

  _drawHeartbeatPulse() {
    if (this.heartbeatScale <= 0.01) return;

    const pulseGrad = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.width * 0.30,
      this.width / 2, this.height / 2, this.width * 0.65
    );
    pulseGrad.addColorStop(0, 'transparent');
    pulseGrad.addColorStop(1, `rgba(220, 15, 15, ${this.heartbeatScale * 0.55})`);

    this.ctx.fillStyle = pulseGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.heartbeatScale *= 0.88;
  }

  _drawJumpscare() {
    this.ctx.fillStyle = `rgba(220, 10, 10, ${this.jumpscareAlpha * 0.5})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;

    this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.jumpscareAlpha * 0.9})`;
    this.ctx.lineWidth = 5;
    // Screaming open mouth
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy + 60, 75, 130, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    // Piercing eyes
    this.ctx.beginPath();
    this.ctx.arc(cx - 85, cy - 70, 40, 0, Math.PI * 2);
    this.ctx.arc(cx + 85, cy - 70, 40, 0, Math.PI * 2);
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

  _triggerStatic(intensity) {
    const overlay = document.getElementById('static-overlay');
    if (overlay) {
      overlay.style.opacity = intensity * 0.5;
      setTimeout(() => { overlay.style.opacity = 0; }, 300);
    }
  }

  _triggerFaceFlash(intensity) {
    this.jumpscareAlpha = intensity;
    this._triggerShake(1.6);
    const flash = document.getElementById('flash-overlay');
    if (flash) {
      flash.style.opacity = 0.95;
      setTimeout(() => { flash.style.opacity = 0; }, 90);
    }
  }

  _triggerShake(intensity) {
    this.shakeX = (Math.random() - 0.5) * intensity * 28;
    this.shakeY = (Math.random() - 0.5) * intensity * 28;
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
