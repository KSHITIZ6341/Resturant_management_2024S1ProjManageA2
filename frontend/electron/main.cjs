const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

/**
 * Creates the main borderless window that hosts the Vite-powered React app.
 */
function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    title: 'Restaurant Manager',
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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

ipcMain.handle('system:openPath', async (_event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'Invalid file path.' };
  }

  const resolvedPath = path.resolve(filePath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const supportedExtensions = new Set(['.docx', '.pdf']);

  if (!supportedExtensions.has(extension)) {
    return { ok: false, error: 'Unsupported file type.' };
  }

  if (!fs.existsSync(resolvedPath)) {
    return { ok: false, error: 'File not found.' };
  }

  const openError = await shell.openPath(resolvedPath);
  if (openError) {
    return { ok: false, error: openError };
  }

  return { ok: true };
});
