const path = require('path');
const os = require('os');
const fs = require('fs');

let initSqlJs;
try {
    initSqlJs = require('sql.js');
} catch { }

class BrowserHistoryCollector {
    constructor(db) {
        this.db = db;
        this.interval = null;
        // Start by looking 1 hour in the past on first run
        this.lastChecked = new Date(Date.now() - 60 * 60 * 1000);
    }

    getBrowserPaths() {
        const home = os.homedir();
        const browsers = [];

        if (process.platform === 'win32') {
            // Chrome
            const chromeUserData = path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
            if (fs.existsSync(chromeUserData)) {
                // Check Default and Profile directories
                const profiles = fs.readdirSync(chromeUserData).filter(f => f === 'Default' || f.startsWith('Profile '));
                for (const profile of profiles) {
                    const profilePath = path.join(chromeUserData, profile, 'History');
                    if (fs.existsSync(profilePath)) browsers.push({ name: 'Chrome', path: profilePath });
                }
            }

            // Edge
            const edgePath = path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'History');
            if (fs.existsSync(edgePath)) browsers.push({ name: 'Edge', path: edgePath });

            // Firefox
            const firefoxDir = path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
            if (fs.existsSync(firefoxDir)) {
                const profiles = fs.readdirSync(firefoxDir).filter(f => f.endsWith('.default-release') || f.endsWith('.default'));
                for (const profile of profiles) {
                    const ffPath = path.join(firefoxDir, profile, 'places.sqlite');
                    if (fs.existsSync(ffPath)) browsers.push({ name: 'Firefox', path: ffPath });
                }
            }
        }

        return browsers;
    }

    start() {
        // Check every 1 minute for better real-time tracking
        this.collectHistory();
        this.interval = setInterval(() => this.collectHistory(), 60 * 1000);
        console.log('Browser history collector started');
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async collectHistory() {
        const browsers = this.getBrowserPaths();

        for (const browser of browsers) {
            try {
                await this.collectFromBrowser(browser);
            } catch (err) {
                console.error(`Error collecting from ${browser.name}:`, err.message);
            }
        }

        this.lastChecked = new Date();
    }

    async collectFromBrowser(browser) {
        // Copy the database to avoid lock conflicts
        const tmpPath = path.join(os.tmpdir(), `memory_os_${browser.name}_history.db`);

        try {
            fs.copyFileSync(browser.path, tmpPath);
        } catch {
            return; // Browser has it locked
        }

        try {
            const SQL = await initSqlJs();
            const buffer = fs.readFileSync(tmpPath);
            const browserDb = new SQL.Database(buffer);

            let rows = [];
            if (browser.name === 'Firefox') {
                const result = browserDb.exec(
                    `SELECT url, title, last_visit_date / 1000000 as visit_time
           FROM moz_places
           WHERE last_visit_date > ?
           ORDER BY last_visit_date DESC
           LIMIT 100`,
                    [this.lastChecked.getTime() * 1000]
                );
                rows = result.length ? result[0].values.map(r => ({ url: r[0], title: r[1], visit_time: r[2] })) : [];
            } else {
                // Chrome / Edge (Chromium-based)
                const chromeEpochOffset = 11644473600000000;
                const sinceTimestamp = this.lastChecked.getTime() * 1000 + chromeEpochOffset;

                const result = browserDb.exec(
                    `SELECT urls.url, urls.title, visits.visit_time
           FROM visits
           JOIN urls ON visits.url = urls.id
           WHERE visits.visit_time > ?
           ORDER BY visits.visit_time DESC
           LIMIT 100`,
                    [sinceTimestamp]
                );
                rows = result.length ? result[0].values.map(r => ({ url: r[0], title: r[1], visit_time: r[2] })) : [];
            }

            browserDb.close();

            for (const row of rows) {
                if (!row.url || row.url.startsWith('chrome://') || row.url.startsWith('edge://') || row.url.startsWith('about:')) {
                    continue;
                }

                this.db.addActivity({
                    type: 'web_visit',
                    title: row.title || row.url,
                    description: `Visited in ${browser.name}`,
                    url: row.url,
                    metadata: { browser: browser.name },
                });
            }
        } catch (err) {
            console.error(`Error reading ${browser.name} history:`, err.message);
        } finally {
            try { fs.unlinkSync(tmpPath); } catch { }
        }
    }
}

module.exports = { BrowserHistoryCollector };
