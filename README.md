# PULSE 🫀

**A biometric horror experience that reads your fear in real-time.**

Built with the [Presage SmartSpectra SDK](https://smartspectra.presagetech.com/) for the [DEV Community SmartSpectra Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners-1370).

## 🎮 What Is This?

PULSE is a cinematic horror experience where **the game can hear your heartbeat**. Using your webcam and the SmartSpectra SDK, it monitors your pulse rate, breathing rate, and heart rate variability in real-time — then adapts the horror to your actual physiological state.

- 🫀 Your **real heartbeat** becomes the soundtrack
- 😰 When you're calm, the tension **builds**
- 💀 When your pulse spikes, it knows you're **scared**
- 🌫️ Your breathing rate controls the **fog and atmosphere**
- 👁️ Look away and something **changes** when you look back

## 🔒 Privacy & Consent

- All video processing happens **locally on your device**
- No video is stored, recorded, or transmitted
- Only anonymized vital sign metrics are used for gameplay
- Explicit camera consent required before the experience starts
- Press **ESC** at any time to stop

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A webcam
- A SmartSpectra API key from [smartspectra.presagetech.com](https://smartspectra.presagetech.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/ritamgit-alt/pulse-biometric-horror.git
cd pulse-biometric-horror

# Install dependencies
npm install

# Set up your API key
cp .env.example .env
# Edit .env and add your PRESAGE_API_KEY

# Run the experience
npm start
```

### Controls
- **F11** — Toggle fullscreen
- **H** — Toggle HUD (shows real-time BPM, breathing rate, fear meter, sensor mode)
- **C** — Toggle Night-Vision Biometric Facecam & live sweeping PPG cardiac waveform
- **Space** — Trigger fright test (simulates heart spike & initiates monster sprint)
- **ESC** — Exit experience & view your final **Fear Profile** report

## 🏗️ Architecture

```
src/
├── main/
│   └── main.js              # Electron main process + SmartSpectra IPC
├── renderer/
│   ├── index.html            # UI screens (consent → calibration → horror → end)
│   ├── styles.css            # Dark horror styling + animations
│   ├── app.js                # Main app orchestrator
│   ├── engine/
│   │   ├── biometrics.js     # SmartSpectra SDK bridge + vital sign processing
│   │   ├── fear-engine.js    # Adaptive AI: decides WHAT to scare and WHEN
│   │   └── horror-renderer.js # Canvas 2D rendering: shadows, particles, effects
│   ├── audio/
│   │   └── audio-engine.js   # Procedural audio via Web Audio API
│   ├── scenes/
│   │   └── scene-manager.js  # Narrative text + phase management
│   └── ui/
│       └── hud.js            # Optional debug HUD overlay
```

### How the Fear Engine Works

1. **Calibration** — PULSE reads your baseline vitals for 15 seconds
2. **Adaptive Horror** — The Fear Engine compares live vitals to your baseline:
   - If you're **calm**, tension builds and scares escalate
   - If you're **stressed**, it modulates intensity to prevent desensitization
   - **Pulse spikes** are detected in real-time — the game *notices* when you flinch
3. **Procedural Everything** — All audio and visuals are generated in real-time:
   - No asset files needed
   - Every playthrough is unique to YOUR physiology
4. **Fear Profile** — At the end, you get a personalized report of your fear response

## 🛠️ Built With

- [Presage SmartSpectra SDK](https://smartspectra.presagetech.com/) — Contactless vital sign monitoring
- [Electron](https://www.electronjs.org/) — Cross-platform desktop app
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — Procedural horror audio
- Canvas 2D — Real-time visual effects

## 📄 License

MIT
