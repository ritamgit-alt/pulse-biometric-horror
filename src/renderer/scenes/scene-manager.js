/**
 * scene-manager.js — Manages the horror scene phases and narrative
 */

class SceneManager {
  constructor() {
    this.narrativeEl = document.getElementById('narrative-text');
    this.currentText = '';
    this._typewriterInterval = null;
  }

  /**
   * Display narrative text with a creepy typewriter effect
   */
  showNarrative(text, duration = 5000) {
    if (!this.narrativeEl) return;

    // Clear previous
    if (this._typewriterInterval) clearInterval(this._typewriterInterval);
    this.narrativeEl.textContent = '';
    this.narrativeEl.classList.add('visible');

    // Typewriter effect
    let i = 0;
    this._typewriterInterval = setInterval(() => {
      if (i < text.length) {
        this.narrativeEl.textContent += text[i];
        i++;
      } else {
        clearInterval(this._typewriterInterval);

        // Fade out after duration
        setTimeout(() => {
          this.narrativeEl.classList.remove('visible');
        }, duration);
      }
    }, 80 + Math.random() * 60); // Variable typing speed for unease
  }

  /**
   * Clear narrative
   */
  hideNarrative() {
    if (this.narrativeEl) {
      this.narrativeEl.classList.remove('visible');
    }
  }
}

window.SceneManager = SceneManager;
