const path = require('path');
const os = require('os');
const fs = require('fs');

class FileWatcher {
    constructor(db) {
        this.db = db;
        this.watchers = [];
        this.debounceTimers = new Map();

        // Define system directories to ignore to prevent high CPU usage
        this.ignoredPattern = /(^|[\/\\])(Windows|Program Files|Program Files \(x86\)|AppData|ProgramData|\$Recycle\.Bin|System Volume Information|node_modules|dist|build|\.git|\.__pycache__|venv|\.venv|env)[\/\\]/i;
    }

    getWatchPaths() {
        const drives = [];
        if (os.platform() === 'win32') {
            for (let i = 65; i <= 90; i++) {
                const driveMap = String.fromCharCode(i) + ':\\';
                try {
                    if (fs.existsSync(driveMap)) {
                        drives.push(driveMap);
                    }
                } catch { }
            }
        } else {
            drives.push('/');
        }
        return drives;
    }

    start() {
        const watchPaths = this.getWatchPaths();
        if (watchPaths.length === 0) return;

        for (const drive of watchPaths) {
            try {
                // Use native Node.js recursive watch for Windows (zero initial scan delay)
                const watcher = fs.watch(drive, { recursive: true }, (eventType, filename) => {
                    if (!filename) return;

                    // Filter out heavy OS directories and temp files immediately
                    if (this.ignoredPattern.test(filename) || filename.endsWith('.tmp') || filename.endsWith('.db') || filename.endsWith('~')) {
                        return;
                    }

                    const fullPath = path.join(drive, filename);
                    this.handleEvent(eventType, fullPath);
                });

                watcher.on('error', (error) => {
                    // Ignore EPERM/EBUSY errors from locked system files
                    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOENT') return;
                    console.error(`Watcher error on ${drive}:`, error.message || error);
                });

                this.watchers.push(watcher);
            } catch (err) {
                console.error(`Failed to watch drive ${drive}:`, err.message);
            }
        }

        console.log('File watcher (native) started on:', watchPaths);
    }

    handleEvent(eventType, filePath) {
        // fs.watch only gives 'rename' (create/delete) and 'change' (modify)
        // We use a debounce to prevent duplicate spam and figure out the exact state
        const key = filePath;

        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        this.debounceTimers.set(key, setTimeout(() => {
            this.debounceTimers.delete(key);
            this.determineAndRecordActivity(filePath);
        }, 1000));
    }

    determineAndRecordActivity(filePath) {
        try {
            // Check if file still exists to determine if it's a create/modify or delete
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);

                // Ignore directories and empty files
                if (stats.isDirectory() || stats.size === 0) return;

                // Simple heuristic: If it was created in the last 2 seconds, it's a new file
                // Otherwise it's a modification
                const now = Date.now();
                const isNew = (now - stats.birthtimeMs) < 2000;

                const type = isNew ? 'file_created' : 'file_modified';
                this.recordActivity(type, filePath, stats.size);

            } else {
                // File no longer exists, it was deleted
                this.recordActivity('file_deleted', filePath, null);
            }
        } catch (err) {
            // Unreadable or quickly deleted file
            if (err.code !== 'ENOENT' && err.code !== 'EPERM' && err.code !== 'EBUSY') {
                console.error('Error determining file activity:', err.message);
            }
        }
    }

    recordActivity(type, filePath, size) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const name = path.basename(filePath);

            this.db.addActivity({
                type,
                title: name,
                description: `${this.getTypeLabel(type)}: ${name}`,
                file_path: filePath,
                metadata: {
                    ext,
                    dir: path.dirname(filePath),
                    size: size
                },
            });
        } catch (err) {
            console.error('Error recording file activity:', err.message);
        }
    }

    getTypeLabel(type) {
        switch (type) {
            case 'file_created': return 'File created';
            case 'file_modified': return 'File modified';
            case 'file_deleted': return 'File deleted';
            default: return type;
        }
    }

    stop() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
}

module.exports = { FileWatcher };
