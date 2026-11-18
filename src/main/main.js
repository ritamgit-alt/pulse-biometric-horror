const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { bindSmartSpectraIpc } = require('@smartspectra/node-sdk/main');

// Load environment variables from .env if present
try {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length > 0) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    }
  }
} catch (e) {
  console.log('[Main] Could not read .env file:', e.message);
}

let mainWindow;

function createWindow() {
  // Grant camera permission to our app
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
        return;
      }
      callback(false);
    }
  );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,
    backgroundColor: '#000000',
    title: 'PULSE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  // Bind SmartSpectra IPC bridge
  bindSmartSpectraIpc(mainWindow);

  // Load the horror experience
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Toggle fullscreen with F11
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
