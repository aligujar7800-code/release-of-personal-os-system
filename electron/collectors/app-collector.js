const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class AppCollector {
    constructor(db) {
        this.db = db;
        this.apps = [];
    }

    async scan() {
        console.log('Scanning for installed applications...');
        const startMenuPaths = [
            path.join(process.env.PROGRAMDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
            path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        ];

        for (const basePath of startMenuPaths) {
            if (fs.existsSync(basePath)) {
                this.scanDirectory(basePath);
            }
        }

        // Add apps to database as special activity types
        for (const app of this.apps) {
            this.db.addActivity({
                type: 'app_launch',
                title: app.name,
                description: `Application: ${app.name}`,
                file_path: app.path,
                metadata: { icon: app.icon }
            });
        }

        console.log(`Found ${this.apps.length} applications.`);
        return this.apps;
    }

    scanDirectory(dir) {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    this.scanDirectory(fullPath);
                } else if (file.endsWith('.lnk')) {
                    this.apps.push({
                        name: path.basename(file, '.lnk'),
                        path: fullPath
                    });
                }
            }
        } catch (err) {
            console.error(`Error scanning apps in ${dir}:`, err.message);
        }
    }

    async launch(appPath) {
        return new Promise((resolve, reject) => {
            exec(`start "" "${appPath}"`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = { AppCollector };
