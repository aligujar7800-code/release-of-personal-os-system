const path = require('path');
const fs = require('fs');

let initSqlJs;
try {
    initSqlJs = require('sql.js');
} catch {
    // Will be loaded dynamically
}

class DatabaseManager {
    constructor(dataPath) {
        this.dataPath = dataPath;
        this.dbPath = path.join(dataPath, 'memory.db');
        this.db = null;
    }

    async initializeAsync() {
        // Ensure data directory exists
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }

        const SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
        }

        this.createTables();
        this._startAutoSave();
    }

    initialize() {
        // Synchronous wrapper — call initializeAsync and wait
        // For compatibility with the existing main.js approach
        // In practice, main.js should call initializeAsync
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }

    _startAutoSave() {
        // Auto-save database to disk every 30 seconds
        this._saveInterval = setInterval(() => this._saveToDisk(), 30000);
    }

    _saveToDisk() {
        if (!this.db) return;
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        } catch (err) {
            console.error('Failed to save database:', err.message);
        }
    }

    createTables() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT,
        description TEXT,
        file_path TEXT,
        url TEXT,
        content TEXT,
        metadata TEXT,
        embedding_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.run(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        ocr_text TEXT,
        embedding_id TEXT,
        width INTEGER,
        height INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.run(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        content_hash TEXT,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        vector BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create indexes
        try {
            this.db.run('CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_activities_file_path ON activities(file_path)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_screenshots_created ON screenshots(created_at)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id)');
        } catch { }

        // Set default settings
        const defaults = {
            tracking_enabled: 'true',
            screenshot_interval: '300',
            theme: 'dark',
            watched_directories: JSON.stringify([]),
            work_as_spy: 'false',
            app_password: '',
        };

        for (const [key, value] of Object.entries(defaults)) {
            const existing = this.db.exec("SELECT value FROM settings WHERE key = ?", [key]);
            if (!existing.length || !existing[0].values.length) {
                this.db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
            }
        }

        this._saveToDisk();
    }

    // Helper to convert sql.js result to array of objects
    _toObjects(result) {
        if (!result || result.length === 0) return [];
        const { columns, values } = result[0];
        return values.map(row => {
            const obj = {};
            columns.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
        });
    }

    // Activities
    addActivity(activity) {
        this.db.run(
            `INSERT INTO activities (type, title, description, file_path, url, content, metadata, embedding_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                activity.type,
                activity.title || null,
                activity.description || null,
                activity.file_path || null,
                activity.url || null,
                activity.content || null,
                activity.metadata ? JSON.stringify(activity.metadata) : null,
                activity.embedding_id || null,
            ]
        );
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        return result.length ? result[0].values[0][0] : null;
    }

    getTimeline(date, limit = 100) {
        const result = this.db.exec(
            `SELECT * FROM activities WHERE date(created_at) = date(?) ORDER BY created_at DESC LIMIT ?`,
            [date || new Date().toISOString().split('T')[0], limit]
        );
        return this._toObjects(result);
    }

    getTimelineRange(startDate, endDate) {
        const result = this.db.exec(
            `SELECT * FROM activities WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
            [startDate, endDate]
        );
        return this._toObjects(result);
    }

    searchActivities(query) {
        const qLower = query.toLowerCase();

        // Simple NLP date filters
        let dateCondition = '';
        let dateParams = [];

        if (qLower.includes('yesterday')) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
            const yEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
            dateCondition = ' AND created_at BETWEEN ? AND ?';
            dateParams.push(yStart, yEnd);
        } else if (qLower.includes('today')) {
            const today = new Date();
            const tStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
            const tEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
            dateCondition = ' AND created_at BETWEEN ? AND ?';
            dateParams.push(tStart, tEnd);
        }

        // Split query into individual keywords (ignore common stop words)
        const stopWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'me', 'my',
            'show', 'find', 'get', 'search', 'for', 'about', 'of', 'in', 'on',
            'to', 'and', 'or', 'that', 'this', 'with', 'from', 'it', 'its',
            'all', 'any', 'do', 'did', 'does', 'has', 'have', 'had', 'be',
            'been', 'being', 'what', 'which', 'where', 'when', 'how', 'can',
        ]);

        const keywords = query.toLowerCase().split(/\s+/)
            .filter(w => w.length > 1 && !stopWords.has(w));

        if (keywords.length === 0) {
            if (dateCondition) {
                // Only time filter, no actual keywords (all other words were stop words)
                const result = this.db.exec(
                    `SELECT * FROM activities WHERE 1=1 ${dateCondition} ORDER BY created_at DESC LIMIT 50`,
                    dateParams
                );
                return this._toObjects(result);
            }

            // If only stop words, do basic full-text search
            const pattern = `%${query}%`;
            const result = this.db.exec(
                `SELECT * FROM activities WHERE (title LIKE ? OR description LIKE ? OR content LIKE ? OR file_path LIKE ?) ${dateCondition} ORDER BY created_at DESC LIMIT 50`,
                [pattern, pattern, pattern, pattern, ...dateParams]
            );
            return this._toObjects(result);
        }

        // Build query: match activities containing ALL keywords somewhere in their fields
        const conditions = keywords.map(() =>
            `(LOWER(COALESCE(title,'')) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ? OR LOWER(COALESCE(content,'')) LIKE ? OR LOWER(COALESCE(file_path,'')) LIKE ? OR LOWER(COALESCE(type,'')) LIKE ?)`
        ).join(' AND ');

        const params = [];
        for (const kw of keywords) {
            const pattern = `%${kw}%`;
            params.push(pattern, pattern, pattern, pattern, pattern);
        }

        const sql = `SELECT * FROM activities WHERE ${conditions} ${dateCondition} ORDER BY created_at DESC LIMIT 50`;
        const result = this.db.exec(sql, [...params, ...dateParams]);
        return this._toObjects(result);
    }

    // Screenshots
    addScreenshot(screenshot) {
        this.db.run(
            `INSERT INTO screenshots (file_path, thumbnail_path, ocr_text, embedding_id, width, height) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                screenshot.file_path,
                screenshot.thumbnail_path || null,
                screenshot.ocr_text || null,
                screenshot.embedding_id || null,
                screenshot.width || null,
                screenshot.height || null,
            ]
        );
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        return result.length ? result[0].values[0][0] : null;
    }

    getScreenshots(date, limit = 50) {
        const result = this.db.exec(
            `SELECT * FROM screenshots WHERE date(created_at) = date(?) ORDER BY created_at DESC LIMIT ?`,
            [date || new Date().toISOString().split('T')[0], limit]
        );
        return this._toObjects(result);
    }

    // Tracked Files
    getTrackedFiles(filters = {}) {
        let query = "SELECT * FROM activities WHERE type IN ('file_created', 'file_modified', 'file_opened')";
        const params = [];

        if (filters.type) {
            query += ' AND metadata LIKE ?';
            params.push(`%"ext":"${filters.type}"%`);
        }

        if (filters.search) {
            query += ' AND (title LIKE ? OR file_path LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(filters.limit || 200);

        const result = this.db.exec(query, params);
        return this._toObjects(result);
    }

    // Settings
    getSetting(key) {
        const result = this.db.exec('SELECT value FROM settings WHERE key = ?', [key]);
        return result.length && result[0].values.length ? result[0].values[0][0] : null;
    }

    getAllSettings() {
        const result = this.db.exec('SELECT * FROM settings');
        const rows = this._toObjects(result);
        const settings = {};
        for (const row of rows) {
            // Never return the app_password to the frontend in the general payload
            if (row.key !== 'app_password') {
                settings[row.key] = row.value;
            }
        }
        return settings;
    }

    setSetting(key, value) {
        this.db.run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
            [key, value]
        );
        this._saveToDisk();
    }

    // Stats
    getStats() {
        const totalActivities = this._toObjects(this.db.exec('SELECT COUNT(*) as count FROM activities'));
        const totalScreenshots = this._toObjects(this.db.exec('SELECT COUNT(*) as count FROM screenshots'));
        const todayActivities = this._toObjects(this.db.exec("SELECT COUNT(*) as count FROM activities WHERE date(created_at) = date('now')"));
        const fileTypes = this._toObjects(this.db.exec('SELECT type, COUNT(*) as count FROM activities GROUP BY type ORDER BY count DESC'));

        return {
            totalActivities: totalActivities.length ? totalActivities[0].count : 0,
            totalScreenshots: totalScreenshots.length ? totalScreenshots[0].count : 0,
            todayActivities: todayActivities.length ? todayActivities[0].count : 0,
            fileTypes,
        };
    }

    // Delete history
    deleteHistory(range) {
        if (range === 'all') {
            this.db.run('DELETE FROM activities');
            this.db.run('DELETE FROM screenshots');
            this.db.run('DELETE FROM embeddings');
        } else if (range === 'today') {
            this.db.run("DELETE FROM activities WHERE date(created_at) = date('now')");
            this.db.run("DELETE FROM screenshots WHERE date(created_at) = date('now')");
        } else if (range === 'week') {
            this.db.run("DELETE FROM activities WHERE created_at >= datetime('now', '-7 days')");
            this.db.run("DELETE FROM screenshots WHERE created_at >= datetime('now', '-7 days')");
        } else if (range === 'month') {
            this.db.run("DELETE FROM activities WHERE created_at >= datetime('now', '-30 days')");
            this.db.run("DELETE FROM screenshots WHERE created_at >= datetime('now', '-30 days')");
        }
        this._saveToDisk();
    }

    deleteFileRecords(filePath) {
        if (!filePath) return;
        this.db.run('DELETE FROM activities WHERE file_path = ?', [filePath]);
        this.db.run('DELETE FROM screenshots WHERE file_path = ?', [filePath]);
        this._saveToDisk();
    }

    close() {
        if (this._saveInterval) {
            clearInterval(this._saveInterval);
        }
        this._saveToDisk();
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = { DatabaseManager };
