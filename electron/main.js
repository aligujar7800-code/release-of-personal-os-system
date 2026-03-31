const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, protocol, net, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { setupIpcHandlers } = require('./ipc-handlers');
const { createTray } = require('./tray');
const { DatabaseManager } = require('./database');
const { PythonBridge } = require('./python-bridge');
const { FileWatcher } = require('./collectors/file-watcher');
const { BrowserHistoryCollector } = require('./collectors/browser-history');
const { ClipboardMonitor } = require('./collectors/clipboard-monitor');
const { ScreenshotCapture } = require('./collectors/screenshot-capture');
const { AppCollector } = require('./collectors/app-collector');
const { WindowTracker } = require('./collectors/window-tracker');

let mainWindow = null;
let tray = null;
let db = null;
let pythonBridge = null;
let fileWatcher = null;
let browserHistory = null;
let clipboardMonitor = null;
let screenshotCapture = null;
let appCollector = null;
let windowTracker = null;
let isTracking = true;
let isQuitting = false;
let updateStatus = {
    state: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    lastCheckedAt: null,
};

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    // Return early but process will exit
}

app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

function getDataPath() {
    return path.join(app.getPath('userData'), 'memory-data');
}

async function createWindow(isHidden = false) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.min(1400, width),
        height: Math.min(900, height),
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0a0a1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        show: false,
    });

    mainWindow.once('ready-to-show', () => {
        if (!isHidden) {
            mainWindow.show();
        }
    });

    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    mainWindow.on('close', (e) => {
        if (isQuitting) {
            return;
        }
        e.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function initializeServices() {
    const dataPath = getDataPath();

    // Initialize database
    db = new DatabaseManager(dataPath);
    await db.initializeAsync();

    // Initialize Python bridge in the background (Models can take 30s+ to spin up)
    pythonBridge = new PythonBridge(dataPath);
    pythonBridge.start()
        .then(() => {
            console.log('Python AI service started successfully');
            // Trigger system crawl after startup
            setTimeout(() => {
                pythonBridge.crawlSystem().catch(console.error);
            }, 5000);
        })
        .catch(err => console.error('Failed to start Python service:', err.message));

    // Initialize collectors
    fileWatcher = new FileWatcher(db);
    browserHistory = new BrowserHistoryCollector(db);
    clipboardMonitor = new ClipboardMonitor(db);
    screenshotCapture = new ScreenshotCapture(db, dataPath, pythonBridge);
    appCollector = new AppCollector(db);
    windowTracker = new WindowTracker(db);

    // Start tracking if enabled
    const settings = db.getSetting('tracking_enabled');
    isTracking = settings !== 'false';

    if (isTracking) {
        startTracking();
    }
}

function setupAutoUpdater() {
    if (!app.isPackaged) {
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (error) => {
        updateStatus = {
            ...updateStatus,
            state: 'error',
            lastCheckedAt: new Date().toISOString(),
        };
        console.error('Auto-updater error:', error);
    });

    autoUpdater.on('update-available', async (info) => {
        updateStatus = {
            ...updateStatus,
            state: 'update-available',
            availableVersion: info.version || null,
            lastCheckedAt: new Date().toISOString(),
        };
        await dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available.`,
            detail: 'The update is downloading in the background.',
            buttons: ['OK']
        });
    });

    autoUpdater.on('update-not-available', async () => {
        updateStatus = {
            ...updateStatus,
            state: 'up-to-date',
            availableVersion: null,
            lastCheckedAt: new Date().toISOString(),
        };
        await dialog.showMessageBox({
            type: 'info',
            title: 'Up To Date',
            message: 'You already have the latest version.',
            buttons: ['OK']
        });
    });

    autoUpdater.on('update-downloaded', async (info) => {
        updateStatus = {
            ...updateStatus,
            state: 'update-downloaded',
            availableVersion: info.version || null,
            lastCheckedAt: new Date().toISOString(),
        };
        const result = await dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded.`,
            detail: 'The app will restart to install the update.',
            buttons: ['Install and Restart', 'Later'],
            defaultId: 0,
            cancelId: 1
        });

        if (result.response === 0) {
            isQuitting = true;
            autoUpdater.quitAndInstall();
        }
    });

    updateStatus = {
        ...updateStatus,
        state: 'checking',
        lastCheckedAt: new Date().toISOString(),
    };
    autoUpdater.checkForUpdates();
}

function startTracking() {
    if (fileWatcher) fileWatcher.start();
    if (browserHistory) browserHistory.start();
    if (clipboardMonitor) clipboardMonitor.start();
    if (screenshotCapture) screenshotCapture.start();
    if (windowTracker) windowTracker.start();
    appCollector.scan().catch(console.error);
    isTracking = true;
}

function stopTracking() {
    if (fileWatcher) fileWatcher.stop();
    if (browserHistory) browserHistory.stop();
    if (clipboardMonitor) clipboardMonitor.stop();
    if (screenshotCapture) screenshotCapture.stop();
    if (windowTracker) windowTracker.stop();
    isTracking = false;
}

app.whenReady().then(async () => {
    // Register local protocol to securely serve images to renderer
    protocol.handle('local', (request) => {
        const filePath = decodeURI(request.url.slice('local://'.length));
        // Windows absolute paths need file:/// (triple slash) before drive letter
        const fileUrl = filePath.match(/^[A-Za-z]:/) ? 'file:///' + filePath : 'file://' + filePath;
        return net.fetch(fileUrl);
    });

    await initializeServices();

    const isSpyMode = db.getSetting('work_as_spy') === 'true';
    const isHiddenStart = process.argv.includes('--hidden') || isSpyMode;
    await createWindow(isHiddenStart);

    // Setup IPC
    setupIpcHandlers(ipcMain, db, pythonBridge, mainWindow, {
        startTracking,
        stopTracking,
        isTracking: () => isTracking,
        getDataPath,
        toggleTray: (show) => {
            if (show && !tray) {
                tray = createTray(mainWindow, { startTracking, stopTracking, isTracking: () => isTracking });
            } else if (!show && tray) {
                tray.destroy();
                tray = null;
            }
        },
        getAppVersion: () => app.getVersion(),
        getUpdateStatus: () => updateStatus,
    });

    // Setup tray
    if (!isSpyMode) {
        tray = createTray(mainWindow, { startTracking, stopTracking, isTracking: () => isTracking });
    }

    // Enable auto-launch on startup
    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true,
            path: app.getPath('exe'),
            args: ['--hidden']
        });
    }

    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    // Don't quit — keep running in tray
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    stopTracking();
    if (pythonBridge) pythonBridge.stop();
    if (db) db.close();
    if (mainWindow) {
        mainWindow.removeAllListeners('close');
        mainWindow.close();
    }
    app.exit(0);
});
