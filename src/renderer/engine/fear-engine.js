/**
 * fear-engine.js — The Brain of PULSE
 *
 * Takes biometric data and decides WHAT horror events to trigger and WHEN.
 * This is the core game logic that makes the experience adaptive.
 */

class FearEngine {
  constructor() {
    // Fear state (0 = calm, 1 = terrified)
    this.fearLevel = 0;
    this.tensionLevel = 0; // Builds over time between scares
    this.adaptiveIntensity = 0.5; // Adjusts based on user sensitivity

    // Timing
    this.lastScareTime = 0;
    this.lastEventTime = 0;
    this.experienceStartTime = 0;
    this.elapsed = 0;

    // Scare cooldowns and pacing
    this.minScareCooldown = 12000; // At least 12s between major scares
    this.tensionBuildRate = 0.02;  // How fast tension builds per tick

    // Track what events we've used (don't repeat too soon)
    this.recentEvents = [];
    this.maxRecentEvents = 5;

    // Event listeners
    this._listeners = {};

    // Narrative state
    this.currentPhase = 0; // Story progression 0-5
    this.phaseStartTime = 0;

    // Narrative phases with timing (ms) and text
    this.phases = [
      {
        duration: 15000,
        narrative: "You shouldn't have come here.",
        ambience: 'drone_low',
        baseIntensity: 0.1,
      },
      {
        duration: 25000,
        narrative: 'Something is watching.',
        ambience: 'drone_mid',
        baseIntensity: 0.3,
      },
      {
        duration: 30000,
        narrative: 'It knows your heartbeat.',
        ambience: 'drone_high',
        baseIntensity: 0.5,
      },
      {
        duration: 35000,
        narrative: "Don't. Move.",
        ambience: 'drone_intense',
        baseIntensity: 0.7,
      },
      {
        duration: 40000,
        narrative: 'It has found you.',
        ambience: 'drone_max',
        baseIntensity: 0.9,
      },
      {
        duration: 20000,
        narrative: '...',
        ambience: 'silence',
        baseIntensity: 0.3, // Calm before the final scare
      },
    ];

    // Available scare events
    this.scareEvents = [
      { type: 'flicker', intensity: 0.3, weight: 3 },
      { type: 'shadow_move', intensity: 0.4, weight: 3 },
      { type: 'static_burst', intensity: 0.5, weight: 2 },
      { type: 'face_flash', intensity: 0.8, weight: 1 },
      { type: 'screen_shake', intensity: 0.4, weight: 2 },
      { type: 'whisper', intensity: 0.3, weight: 3 },
      { type: 'heartbeat_sync', intensity: 0.2, weight: 4 },
      { type: 'darkness', intensity: 0.6, weight: 2 },
      { type: 'text_glitch', intensity: 0.3, weight: 3 },
      { type: 'breathing_fog', intensity: 0.2, weight: 4 },
      { type: 'eyes_in_dark', intensity: 0.7, weight: 1 },
      { type: 'door_creak', intensity: 0.5, weight: 2 },
    ];
  }

  /**
   * Start the fear engine
   */
  start() {
    this.experienceStartTime = Date.now();
    this.phaseStartTime = Date.now();
    this.currentPhase = 0;
    this.fearLevel = 0;
    this.tensionLevel = 0;

    this._emit('phase_change', this.phases[0]);
    this._emit('narrative', this.phases[0].narrative);
  }

  /**
   * Main tick — called with biometric data each frame/update
   * Returns array of events to execute
   */
  update(biometrics) {
    const now = Date.now();
    this.elapsed = now - this.experienceStartTime;
    const events = [];

    // Update fear level from biometrics
    this.fearLevel = this.fearLevel * 0.9 + biometrics.stress * 0.1; // Smooth

    // Update tension (builds continuously between scares)
    const timeSinceLastScare = now - this.lastScareTime;
    this.tensionLevel = Math.min(
      1,
      this.tensionLevel + this.tensionBuildRate * (timeSinceLastScare / 1000) * 0.01
    );

    // Phase progression
    const phaseElapsed = now - this.phaseStartTime;
    const currentPhaseData = this.phases[this.currentPhase];

    if (
      currentPhaseData &&
      phaseElapsed > currentPhaseData.duration &&
      this.currentPhase < this.phases.length - 1
    ) {
      this.currentPhase++;
      this.phaseStartTime = now;
      const newPhase = this.phases[this.currentPhase];
      this._emit('phase_change', newPhase);
      this._emit('narrative', newPhase.narrative);
    }

    // Decide whether to trigger a scare event
    const phase = this.phases[this.currentPhase] || this.phases[this.phases.length - 1];
    const shouldScare = this._shouldTriggerScare(now, biometrics, phase);

    if (shouldScare) {
      const event = this._selectScareEvent(phase);
      if (event) {
        events.push(event);
        this.lastScareTime = now;
        this.tensionLevel = 0; // Reset tension after scare
        this.recentEvents.push(event.type);
        if (this.recentEvents.length > this.maxRecentEvents) {
          this.recentEvents.shift();
        }
      }
    }

    // Always-on atmospheric effects based on biometrics
    events.push({
      type: 'atmosphere',
      data: {
        vignetteIntensity: 0.5 + this.fearLevel * 0.4,
        fogDensity: (biometrics.breathingRate || 15) / 30, // Faster breathing = more fog
        heartbeatRate: biometrics.pulseRate || 72,
        colorShift: this.fearLevel, // 0 = cool/dark, 1 = red/intense
        shakeAmount: biometrics.spike ? 3 : this.fearLevel * 1,
      },
    });

    // Heartbeat sync — always happening
    if (biometrics.pulseRate > 0) {
      events.push({
        type: 'heartbeat_tick',
        data: {
          bpm: biometrics.pulseRate,
          interval: 60000 / biometrics.pulseRate,
        },
      });
    }

    // Detect if the user just had a fear spike — the game notices
    if (biometrics.spike) {
      events.push({ type: 'spike_detected' });
      this.adaptiveIntensity = Math.min(1, this.adaptiveIntensity + 0.1);
    }

    // Check for end of experience
    if (this.currentPhase >= this.phases.length - 1) {
      const finalPhaseElapsed = now - this.phaseStartTime;
      if (finalPhaseElapsed > this.phases[this.phases.length - 1].duration) {
        events.push({ type: 'experience_end' });
      }
    }

    return events;
  }

  /**
   * Decide whether to trigger a scare
   */
  _shouldTriggerScare(now, biometrics, phase) {
    const timeSinceLastScare = now - this.lastScareTime;

    // Respect cooldown
    if (timeSinceLastScare < this.minScareCooldown) return false;

    // Higher tension = higher chance
    // Lower fear level = more likely to escalate (the game pushes when you're calm)
    const calmFactor = 1 - this.fearLevel; // More likely when calm
    const tensionFactor = this.tensionLevel;
    const phaseFactor = phase.baseIntensity;

    const scareChance = calmFactor * 0.3 + tensionFactor * 0.4 + phaseFactor * 0.3;

    // Random roll scaled by time since last event
    const roll = Math.random();
    const timeMultiplier = Math.min(2, timeSinceLastScare / 20000);

    return roll < scareChance * timeMultiplier * 0.15;
  }

  /**
   * Select which scare event to use
   */
  _selectScareEvent(phase) {
    // Filter out recently used events
    const available = this.scareEvents.filter(
      (e) =>
        !this.recentEvents.includes(e.type) &&
        e.intensity <= phase.baseIntensity + 0.3
    );

    if (available.length === 0) {
      // All events recently used, allow any
      return this._weightedRandom(this.scareEvents);
    }

    return this._weightedRandom(available);
  }

  _weightedRandom(events) {
    const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const event of events) {
      roll -= event.weight;
      if (roll <= 0) {
        return { type: event.type, intensity: event.intensity * this.adaptiveIntensity };
      }
    }
    return events[0];
  }

  // Simple event emitter
  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach((cb) => cb(data));
  }

  /**
   * Get session summary for the end screen
   */
  getSummary() {
    return {
      totalDuration: this.elapsed,
      phasesReached: this.currentPhase + 1,
      totalPhases: this.phases.length,
      adaptiveIntensity: this.adaptiveIntensity,
      fearResponsiveness: this.adaptiveIntensity > 0.7 ? 'High' : this.adaptiveIntensity > 0.4 ? 'Medium' : 'Low',
    };
  }
}

window.FearEngine = FearEngine;
