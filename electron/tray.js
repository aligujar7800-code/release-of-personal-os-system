const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

function createTray(mainWindow, controls) {
    // Create a simple tray icon — use a default Electron icon
    let trayIcon;
    try {
        trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
        if (trayIcon.isEmpty()) {
            trayIcon = nativeImage.createEmpty();
        }
    } catch {
        trayIcon = nativeImage.createEmpty();
    }

    const tray = new Tray(trayIcon.isEmpty() ? nativeImage.createFromBuffer(createDefaultIcon()) : trayIcon);

    function updateContextMenu() {
        const tracking = controls.isTracking();
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Memory OS',
                click: () => mainWindow?.show(),
            },
            { type: 'separator' },
            {
                label: tracking ? '⏸ Pause Tracking' : '▶ Resume Tracking',
                click: () => {
                    if (tracking) controls.stopTracking();
                    else controls.startTracking();
                    updateContextMenu();
                },
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    mainWindow?.removeAllListeners('close');
                    app.quit();
                },
            },
        ]);

        tray.setContextMenu(contextMenu);
        tray.setToolTip(`Memory OS ${tracking ? '(Tracking)' : '(Paused)'}`);
    }

    updateContextMenu();

    tray.on('double-click', () => {
        mainWindow?.show();
    });

    return tray;
}

function createDefaultIcon() {
    // Create a simple 16x16 PNG icon buffer
    // This is a minimal valid 16x16 white PNG
    const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff,
        0x61, 0x00, 0x00, 0x00, 0x01, 0x73, 0x52, 0x47,
        0x42, 0x00, 0xae, 0xce, 0x1c, 0xe9, 0x00, 0x00,
        0x00, 0x44, 0x49, 0x44, 0x41, 0x54, 0x38, 0x4f,
        0x63, 0xd8, 0x7c, 0xf4, 0xdf, 0x7f, 0x06, 0x06,
        0x06, 0x54, 0x01, 0x26, 0x74, 0x01, 0x20, 0x66,
        0x44, 0x17, 0x00, 0x62, 0x46, 0x74, 0x01, 0x20,
        0x66, 0x44, 0x17, 0x00, 0x62, 0x46, 0x74, 0x01,
        0x20, 0x66, 0x44, 0x17, 0x00, 0x62, 0x46, 0x74,
        0x01, 0x20, 0x66, 0x44, 0x17, 0x00, 0x62, 0x46,
        0x74, 0x01, 0x20, 0x06, 0x00, 0x75, 0xec, 0x02,
        0xb1, 0xfc, 0xab, 0xba, 0x8d, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60,
        0x82
    ]);
    return pngHeader;
}

module.exports = { createTray };
