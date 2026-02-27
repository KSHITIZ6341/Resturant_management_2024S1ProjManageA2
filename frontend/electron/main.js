const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

/**
 * Creates the main borderless window that hosts the Vite-powered React app.
 */
function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (isDev) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  window.on('maximize', () => {
    window.webContents.send('window:maximized-state', true);
  });

  window.on('unmaximize', () => {
    window.webContents.send('window:maximized-state', false);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function withFocusedWindow(callback) {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    callback(focused);
  }
}

ipcMain.on('window:minimize', () => {
  withFocusedWindow((win) => win.minimize());
});

ipcMain.on('window:maximize', () => {
  withFocusedWindow((win) => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
});

ipcMain.on('window:close', () => {
  withFocusedWindow((win) => win.close());
});

ipcMain.handle('window:isMaximized', () => {
  const focused = BrowserWindow.getFocusedWindow();
  return focused ? focused.isMaximized() : false;
});
