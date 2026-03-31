const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

class PythonBridge {
    constructor(dataPath) {
        this.dataPath = dataPath;
        this.process = null;
        this.port = 5678;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        this._running = false;
    }

    async start() {
        return new Promise((resolve, reject) => {
            const serviceDir = process.env.NODE_ENV === 'development' || !process.resourcesPath || !process.mainModule?.filename.includes('app.asar')
                ? path.join(__dirname, '..', 'python-service')
                : path.join(process.resourcesPath, 'python-service');
            const servicePath = path.join(serviceDir, 'app.py');

            // Prefer bundled Python (if present), then fall back to system Python.
            const pythonCandidates = process.platform === 'win32'
                ? [
                    path.join(serviceDir, 'venv', 'Scripts', 'python.exe'),
                    'python',
                    'py',
                ]
                : [
                    path.join(serviceDir, 'venv', 'bin', 'python3'),
                    path.join(serviceDir, 'venv', 'bin', 'python'),
                    'python3',
                    'python',
                ];
            const pythonPath = pythonCandidates.find((candidate) => {
                if (candidate.includes(path.sep)) return fs.existsSync(candidate);
                return true;
            });

            if (!fs.existsSync(servicePath)) {
                return reject(new Error(`AI service file missing: ${servicePath}`));
            }

            console.log(`🐍 Python service start ho raha hai: ${servicePath}`);
            console.log(`🐍 Python executable: ${pythonPath}`);

            this.process = spawn(pythonPath, [servicePath], {
                cwd: serviceDir,
                env: {
                    ...process.env,
                    MEMORY_DATA_PATH: this.dataPath,
                    FLASK_PORT: String(this.port),
                    PYTHONUNBUFFERED: '1',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let startupOutput = '';
            // ✅ FIX - ek baar hi resolve/reject ho
            let settled = false;

            const done = (err) => {
                if (settled) return;
                settled = true;
                if (err) reject(err);
                else resolve();
            };

            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                startupOutput += output;
                console.log(`[Python] ${output.trim()}`);
                if (output.includes('Running on') || output.includes('ready')) {
                    this._running = true;
                    done();
                }
            });

            this.process.stderr.on('data', (data) => {
                const output = data.toString();
                startupOutput += output;
                // Flask stdout stderr dono pe log karta hai
                if (output.includes('Running on') || output.includes('ready')) {
                    this._running = true;
                    done();
                }
            });

            this.process.on('error', (err) => {
                this._running = false;
                done(new Error(`Python start nahi hua: ${err.message}`));
            });

            this.process.on('exit', (code) => {
                this._running = false;
                if (code !== 0 && code !== null) {
                    console.error(`Python exited: ${code}`);
                    done(new Error(`Python exited ${code}: ${startupOutput}`));
                }
            });

            // ✅ FIX - Timeout ke baad health check karo
            setTimeout(() => {
                if (settled) return; // Already resolved
                this._healthCheck()
                    .then(() => {
                        this._running = true;
                        done();
                    })
                    .catch(() => {
                        done(new Error('Python 90 seconds mein start nahi hua'));
                    });
            }, 90000);
        });
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
            this._running = false;
            console.log('🛑 Python service stopped');
        }
    }

    isRunning() {
        return this._running;
    }

    async _healthCheck() {
        return this._request('GET', '/health');
    }

    async search(query) {
        return this._request('POST', '/search', { query, top_k: 20 });
    }

    async embed(text, sourceType, sourceId) {
        return this._request('POST', '/embed', {
            text,
            source_type: sourceType,
            source_id: sourceId
        });
    }

    async ocr(filePath, thumbnailPath) {
        return this._request('POST', '/ocr', {
            image_path: filePath,
            thumbnail_path: thumbnailPath
        });
    }

    async extractText(filePath) {
        return this._request('POST', '/extract', { file_path: filePath });
    }

    async askAssistant(question) {
        return this._request('POST', '/summarize', { question });
    }

    async crawlSystem() {
        return this._request('POST', '/crawl');
    }

    // ✅ NEW - Retry logic - agar Flask ready nahi toh wait karo
    async waitUntilReady(maxRetries = 10) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                await this._healthCheck();
                console.log('✅ Python service ready!');
                return true;
            } catch {
                console.log(`⏳ Waiting for Python service... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        return false;
    }

    _request(method, endpoint, body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method,
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(data);
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Timeout: ${endpoint}`));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
}

module.exports = { PythonBridge };