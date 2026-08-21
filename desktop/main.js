import { app, BrowserWindow, dialog, Menu, Tray, nativeImage, Notification } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server/api.js';
import { isGitRepo, getRepoRoot } from '../src/git.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    if (app.isReady()) {
      const p = path.join(app.getPath('userData'), 'agentrace.log');
      fs.appendFileSync(p, line + '\n');
    }
  } catch {}
}

log('App starting...');

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;
let serverInstance = null;
let tray = null;
let quitting = false;
let lastTargetUrl = '';

function getIcoPath() {
  try {
    if (app.isReady()) {
      const userData = app.getPath('userData');
      if (!fs.existsSync(userData)) {
        fs.mkdirSync(userData, { recursive: true });
      }
      const targetPath = path.join(userData, 'icon.ico');
      const srcIco = path.join(__dirname, 'icon.ico');
      if (fs.existsSync(srcIco)) {
        fs.writeFileSync(targetPath, fs.readFileSync(srcIco));
        return targetPath;
      }
    }
  } catch (err) {
    log(`getIcoPath error: ${err.message}`);
  }
  return path.join(__dirname, 'icon.png');
}

if (!gotTheLock) {
  log('Another instance is already running. Quitting this instance.');
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Second instance launched. Showing main window.');
    showMainWindow();
  });

  app.whenReady().then(async () => {
    log('App ready. Initializing repository root...');
    const cwd = process.cwd();
    let repoRoot = cwd;

    if (isGitRepo(cwd)) {
      repoRoot = getRepoRoot(cwd);
    }
    log(`Repo root: ${repoRoot}`);

    // Start in-process AgentRace HTTP/SSE server on local loopback with dynamic port
    try {
      serverInstance = createServer(repoRoot);
    } catch (err) {
      log(`Server create error: ${err.message}`);
      dialog.showErrorBox('AgentRace Initialization Error', `Failed to initialize server: ${err.message}`);
      app.quit();
      return;
    }

    serverInstance.listen(0, '127.0.0.1', () => {
      const port = serverInstance.address().port;
      lastTargetUrl = `http://127.0.0.1:${port}`;
      log(`Server listening at ${lastTargetUrl}`);

      createMainWindow(lastTargetUrl);
      createTray();
    });

    serverInstance.on('error', (err) => {
      log(`Server runtime error: ${err.message}`);
      dialog.showErrorBox('AgentRace Server Error', `Web service encountered an error: ${err.message}`);
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    log('All windows closed (staying resident in system tray)');
  });

  app.on('before-quit', () => {
    quitting = true;
    log('App before-quit');
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
    if (serverInstance) {
      try {
        serverInstance.close();
      } catch {}
    }
  });

  app.on('activate', () => {
    log('App activate event');
    showMainWindow();
  });
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadSavedWindowState() {
  try {
    if (app.isReady()) {
      const p = getWindowStatePath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
  } catch {}
  return { width: 1280, height: 860 };
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (app.isReady()) {
      const bounds = win.getBounds();
      fs.writeFileSync(getWindowStatePath(), JSON.stringify(bounds), 'utf8');
    }
  } catch {}
}

function createTray() {
  if (tray) return;
  try {
    const icoPath = getIcoPath();
    log(`Creating tray with icon: ${icoPath}`);
    tray = new Tray(icoPath);
    tray.setToolTip('AgentRace (arace) 2.0');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示主窗口', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true;
          app.quit();
        }
      }
    ]));
    tray.on('click', showMainWindow);
    log('Tray created successfully');
  } catch (err) {
    log(`Tray creation error: ${err.message}`);
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (serverInstance && serverInstance.listening) {
      const port = serverInstance.address().port;
      createMainWindow(`http://127.0.0.1:${port}`);
    } else {
      const cwd = process.cwd();
      const repoRoot = isGitRepo(cwd) ? getRepoRoot(cwd) : cwd;
      try {
        serverInstance = createServer(repoRoot);
        serverInstance.listen(0, '127.0.0.1', () => {
          const port = serverInstance.address().port;
          createMainWindow(`http://127.0.0.1:${port}`);
        });
      } catch {}
    }
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(targetUrl) {
  lastTargetUrl = targetUrl;
  const savedBounds = loadSavedWindowState();
  const icoPath = getIcoPath();
  log(`Creating main window with URL: ${targetUrl}`);

  const winOptions = {
    width: savedBounds.width || 1280,
    height: savedBounds.height || 860,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#0b1120',
    show: true,
    center: true,
    title: 'AgentRace (arace) 2.0',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  if (typeof savedBounds.x === 'number' && typeof savedBounds.y === 'number') {
    winOptions.x = savedBounds.x;
    winOptions.y = savedBounds.y;
    winOptions.center = false;
  }

  if (fs.existsSync(icoPath)) {
    winOptions.icon = icoPath;
  }

  mainWindow = new BrowserWindow(winOptions);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(targetUrl);

  mainWindow.on('close', (e) => {
    log('Window close event triggered');
    saveWindowState(mainWindow);
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
      log('Window hidden to tray');
      if (!app.hasBeenNotifiedOnce && Notification.isSupported()) {
        try {
          new Notification({ title: 'AgentRace', body: '已最小化到系统托盘' }).show();
          app.hasBeenNotifiedOnce = true;
        } catch {}
      }
    }
  });

  mainWindow.on('closed', () => {
    log('Window closed event');
    mainWindow = null;
  });

  mainWindow.show();
  mainWindow.focus();
  log('Window created and focused');
}
