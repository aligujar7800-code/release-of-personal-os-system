const { exec } = require('child_process');

class WindowTracker {
    constructor(db) {
        this.db = db;
        this.interval = null;
        this.lastWindow = null;
    }

    start() {
        // Poll active window every 5 seconds
        this.interval = setInterval(() => this.checkActiveWindow(), 5000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    checkActiveWindow() {
        // Simple PowerShell script to get active window title
        const command = `powershell -command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty MainWindowTitle"`;

        exec(command, (err, stdout) => {
            if (err) return;
            const windows = stdout.trim().split('\r\n');
            const currentWindow = windows[0]; // Usually the first one is active/foregroundish in simple scripts

            if (currentWindow && currentWindow !== this.lastWindow) {
                this.lastWindow = currentWindow;
                this.recordWindowActivity(currentWindow);
            }
        });
    }

    recordWindowActivity(title) {
        this.db.addActivity({
            type: 'window_active',
            title: title,
            description: `Active Window: ${title}`,
            metadata: { timestamp: new Date().toISOString() }
        });
    }
}

module.exports = { WindowTracker };
