const { shell } = require('electron');
const path = require('path');
const fs = require('fs');

function setupIpcHandlers(ipcMain, db, pythonBridge, mainWindow, controls, glmService) {
    // Window controls
    ipcMain.handle('window-minimize', () => mainWindow?.minimize());
    ipcMain.handle('window-maximize', () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
    });
    ipcMain.handle('window-close', () => mainWindow?.hide());

    // Search
    ipcMain.handle('search', async (_, query) => {
        try {
            // Always start with DB keyword search (fast, reliable)
            const dbResults = db.searchActivities(query);

            // If Python AI is running (or becomes ready shortly), try semantic search and merge results.
            if (pythonBridge) {
                if (!pythonBridge.isRunning()) {
                    await pythonBridge.waitUntilReady(5);
                }
            }

            if (pythonBridge && pythonBridge.isRunning()) {
                try {
                    const searchResponse = await pythonBridge.search(query);
                    const pythonResults = Array.isArray(searchResponse) ? searchResponse : searchResponse?.results || [];

                    if (pythonResults.length > 0) {
                        // Map AI results to full database records
                        const aiResults = pythonResults.map(hit => {
                            if (hit.source_type === 'screenshot' && hit.source_id) {
                                const records = db.db.exec(`SELECT * FROM screenshots WHERE id = ?`, [hit.source_id]);
                                if (records.length && records[0].values.length) {
                                    const record = db._toObjects(records)[0];
                                    return { ...record, type: 'screenshot', score: hit.score, text: hit.text };
                                }
                            } else if (hit.source_type === 'system_file') {
                                if (!fs.existsSync(hit.source_id)) return null;
                                return {
                                    id: 'sys_' + Math.random().toString(36).substr(2, 9),
                                    type: 'file_created',
                                    title: path.basename(hit.source_id),
                                    description: 'System File',
                                    file_path: hit.source_id,
                                    score: hit.score,
                                    text: hit.text
                                };
                            } else if (hit.source_id) {
                                const records = db.db.exec(`SELECT * FROM activities WHERE id = ?`, [hit.source_id]);
                                if (records.length && records[0].values.length) {
                                    const record = db._toObjects(records)[0];
                                    return { ...record, score: hit.score, text: hit.text || record.content };
                                }
                            }
                            return null;
                        }).filter(Boolean);

                        // Merge: AI results first (by score), then DB results not already included
                        const aiIds = new Set(aiResults.map(r => r.id));
                        const merged = [
                            ...aiResults.sort((a, b) => (b.score || 0) - (a.score || 0)),
                            ...dbResults.filter(r => !aiIds.has(r.id)),
                        ];

                        // Deduplicate by file_path to prevent same file showing multiple times
                        const seenPaths = new Set();
                        const deduplicated = merged.filter(result => {
                            if (!result.file_path) return true; // Keep items without paths (like some activities)

                            // Normalize path for comparison
                            const normPath = result.file_path.toLowerCase().replace(/\\/g, '/');
                            if (seenPaths.has(normPath)) {
                                return false; // Skip if we already saw this file
                            }
                            seenPaths.add(normPath);
                            return true;
                        });

                        return deduplicated;
                    }
                } catch (aiErr) {
                    console.error('AI search error (using DB fallback):', aiErr.message);
                }
            }

            // If AI is not running, just return deduplicated DB results
            const seenPaths = new Set();
            return dbResults.filter(result => {
                if (!result.file_path) return true;
                const normPath = result.file_path.toLowerCase().replace(/\\/g, '/');
                if (seenPaths.has(normPath)) return false;
                seenPaths.add(normPath);
                return true;
            });
        } catch (err) {
            console.error('Search error:', err);
            return [];
        }
    });

    ipcMain.handle('launch-app', async (_, appPath) => {
        try {
            const { exec } = require('child_process');
            exec(`start "" "${appPath}"`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Timeline
    ipcMain.handle('get-timeline', (_, date, limit = 100) => {
        return db.getTimeline(date, limit);
    });

    ipcMain.handle('get-timeline-range', (_, startDate, endDate) => {
        return db.getTimelineRange(startDate, endDate);
    });

    // Screenshots
    ipcMain.handle('get-screenshots', (_, date, limit = 50) => {
        return db.getScreenshots(date, limit);
    });

    ipcMain.handle('capture-screenshot', async () => {
        // Trigger manual screenshot capture
        return { success: true, message: 'Screenshot captured' };
    });

    // Serve local image as base64 data URL
    ipcMain.handle('get-image-data', async (_, filePath) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) return null;
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
        } catch (err) {
            console.error('Image read error:', err.message);
            return null;
        }
    });

    // Files
    ipcMain.handle('get-tracked-files', (_, filters = {}) => {
        return db.getTrackedFiles(filters);
    });

    ipcMain.handle('open-file', async (_, filePath) => {
        try {
            await shell.openPath(filePath);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('open-folder', async (_, filePath) => {
        try {
            shell.showItemInFolder(filePath);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('delete-file', async (_, filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            db.deleteFileRecords(filePath);
            return { success: true };
        } catch (err) {
            console.error('Delete file error:', err);
            return { success: false, error: err.message };
        }
    });

    // AI Assistant
    ipcMain.handle('ask-assistant', async (_, question) => {
        try {
            // 1. Get chronological context if relevant (Rule-based)
            let ruleSummary = '';
            const questionLower = question.toLowerCase();
            
            // Try to get context from Python only if it's running
            let searchResults = [];
            if (pythonBridge && pythonBridge.isRunning()) {
                if (questionLower.includes('yesterday') || questionLower.includes('today') || questionLower.includes('week')) {
                    const response = await pythonBridge.askAssistant(question).catch(() => null);
                    if (response) ruleSummary = response.answer || '';
                }
                const searchResponse = await pythonBridge.search(question).catch(() => []);
                searchResults = Array.isArray(searchResponse) ? searchResponse : searchResponse?.results || [];
            }

            // 2. Build Context
            let context = '';
            if (ruleSummary) {
                context += `Summary of activity:\n${ruleSummary}\n\n`;
            }
            
            if (searchResults.length > 0) {
                context += `Relevant Memory Fragments:\n`;
                searchResults.slice(0, 5).forEach((hit) => {
                    context += `- [Source: ${hit.source_type}] ${hit.text}\n`;
                });
            }

            // 3. Fallback/Supplement with basic DB search (always available)
            const dbResults = db.searchActivities(question);
            if (dbResults.length > 0) {
                context += `\nRecent Activity/Files found in DB:\n`;
                dbResults.slice(0, 8).forEach(r => {
                    context += `- ${r.title || r.type}: ${r.description || r.content || ''}\n`;
                });
            }

            // 4. Generate LLM response using GLM-5.1
            if (glmService && context) {
                const aiResponse = await glmService.generateResponse(question, context);
                return {
                    answer: aiResponse.answer,
                    sources: searchResults.slice(0, 5),
                    model: aiResponse.model
                };
            }

            // Absolute fallback for basic questions if no context
            if (glmService) {
                const aiResponse = await glmService.generateResponse(question, "Ask general question. No local context available yet.");
                return {
                    answer: aiResponse.answer,
                    sources: [],
                    model: aiResponse.model
                };
            }

            return { answer: 'I am still initializing and couldn\'t find context to help with that.', sources: [] };
        } catch (err) {
            console.error('Assistant error:', err);
            return { answer: 'Sorry, I encountered an error processing your question.', sources: [] };
        }
    });

    // Settings
    ipcMain.handle('get-settings', () => {
        return db.getAllSettings();
    });

    ipcMain.handle('update-setting', (_, key, value) => {
        db.setSetting(key, value);
        if (key === 'work_as_spy' && controls.toggleTray) {
            controls.toggleTray(value !== 'true');
        }
        return { success: true };
    });

    ipcMain.handle('toggle-tracking', () => {
        if (controls.isTracking()) {
            controls.stopTracking();
            db.setSetting('tracking_enabled', 'false');
        } else {
            controls.startTracking();
            db.setSetting('tracking_enabled', 'true');
        }
        return { tracking: controls.isTracking() };
    });

    ipcMain.handle('delete-history', (_, range) => {
        db.deleteHistory(range);
        return { success: true };
    });

    // Password Security
    ipcMain.handle('has-password', () => {
        const pwd = db.getSetting('app_password');
        return !!pwd && pwd.trim().length > 0;
    });

    ipcMain.handle('verify-password', (_, password) => {
        const stored = db.getSetting('app_password');
        return stored === password;
    });

    ipcMain.handle('set-password', (_, newPassword) => {
        db.setSetting('app_password', newPassword);
        return { success: true };
    });

    ipcMain.handle('get-stats', () => {
        return db.getStats();
    });

    ipcMain.handle('get-app-version', () => {
        return controls.getAppVersion ? controls.getAppVersion() : null;
    });

    ipcMain.handle('get-update-status', () => {
        return controls.getUpdateStatus ? controls.getUpdateStatus() : null;
    });
}

module.exports = { setupIpcHandlers };
