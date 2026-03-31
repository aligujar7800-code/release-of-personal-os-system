const { clipboard } = require('electron');

class ClipboardMonitor {
    constructor(db) {
        this.db = db;
        this.interval = null;
        this.lastText = '';
    }

    start() {
        // Check clipboard every 3 seconds
        this.interval = setInterval(() => this.checkClipboard(), 3000);
        console.log('Clipboard monitor started');
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    checkClipboard() {
        try {
            const text = clipboard.readText();
            if (text && text !== this.lastText && text.trim().length > 2) {
                this.lastText = text;
                this.recordClipboard(text);
            }
        } catch (err) {
            // Ignore clipboard read errors
        }
    }

    recordClipboard(text) {
        // Truncate very long clipboard content
        const truncated = text.length > 5000 ? text.substring(0, 5000) + '...' : text;

        this.db.addActivity({
            type: 'clipboard',
            title: 'Clipboard copy',
            description: truncated.substring(0, 200),
            content: truncated,
            metadata: { length: text.length },
        });
    }
}

module.exports = { ClipboardMonitor };
