const { desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

class ScreenshotCapture {
    constructor(db, dataPath, pythonBridge) {
        this.db = db;
        this.dataPath = dataPath;
        this.pythonBridge = pythonBridge;
        this.interval = null;
        this.screenshotDir = path.join(dataPath, 'screenshots');
    }

    start() {
        // Ensure screenshots directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }

        // Get interval from settings (default 5 minutes = 300 seconds)
        const intervalSec = parseInt(this.db.getSetting('screenshot_interval') || '300', 10);

        this.capture(); // Capture immediately
        this.interval = setInterval(() => this.capture(), intervalSec * 1000);
        console.log(`Screenshot capture started (every ${intervalSec}s)`);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async capture() {
        try {
            // Get actual screen size from Electron
            const { screen } = require('electron');
            const { width, height } = screen.getPrimaryDisplay().size;
            const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;

            // Capture at full native resolution
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: {
                    width: width * scaleFactor,
                    height: height * scaleFactor
                },
            });

            if (sources.length === 0) return;

            const screenshot = sources[0].thumbnail;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const dateFolder = new Date().toISOString().split('T')[0];
            const dir = path.join(this.screenshotDir, dateFolder);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const filePath = path.join(dir, `screenshot_${timestamp}.jpg`);
            const jpegBuffer = screenshot.toJPEG(90); // Increased quality from 75 to 90
            fs.writeFileSync(filePath, jpegBuffer);

            // Create better thumbnail
            const thumbPath = path.join(dir, `thumb_${timestamp}.jpg`);
            const thumbBuffer = screenshot.resize({ width: 640 }).toJPEG(80); // Increased width from 320 to 640, quality to 80
            fs.writeFileSync(thumbPath, thumbBuffer);

            // Record in database
            const screenshotId = this.db.addScreenshot({
                file_path: filePath,
                thumbnail_path: thumbPath,
                width: screenshot.getSize().width,
                height: screenshot.getSize().height,
            });

            // Send to Python for OCR (async, don't block)
            if (this.pythonBridge && this.pythonBridge.isRunning()) {
                this.pythonBridge.ocr(filePath, thumbPath)
                    .then((result) => {
                        if (result && result.text) {
                            // Update screenshot with OCR text
                            const stmt = `UPDATE screenshots SET ocr_text = ? WHERE id = ?`;
                            try {
                                this.db.db.prepare(stmt).run(result.text, screenshotId);
                            } catch { }
                        }
                    })
                    .catch(() => { });
            }
        } catch (err) {
            console.error('Screenshot capture error:', err.message);
        }
    }
}

module.exports = { ScreenshotCapture };
