import React, { useState, useEffect } from 'react';

export default function Settings({ isTracking, setIsTracking, onStatsUpdate }) {
    const [settings, setSettings] = useState({
        tracking_enabled: 'true',
        screenshot_interval: '300',
        theme: 'dark',
        work_as_spy: 'false',
    });
    const [stats, setStats] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    // Security State
    const [hasPassword, setHasPassword] = useState(false);
    const [pwdInput, setPwdInput] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');

    useEffect(() => {
        loadSettings();
        loadStats();
        checkPasswordStatus();
    }, []);

    async function checkPasswordStatus() {
        if (window.electronAPI) {
            const isSet = await window.electronAPI.hasPassword();
            setHasPassword(isSet);
        }
    }

    async function loadSettings() {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getSettings();
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error('Settings load error:', err);
        }
    }

    async function loadStats() {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getStats();
                setStats(data);
            } else {
                setStats({ totalActivities: 1247, totalScreenshots: 342, todayActivities: 58, fileTypes: [{ type: 'file_modified', count: 520 }, { type: 'web_visit', count: 380 }] });
            }
        } catch (err) {
            console.error('Stats load error:', err);
        }
    }

    async function handleToggleTracking() {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.toggleTracking();
                setIsTracking(result.tracking);
                setSettings(prev => ({ ...prev, tracking_enabled: result.tracking ? 'true' : 'false' }));
            } else {
                setIsTracking(!isTracking);
                setSettings(prev => ({ ...prev, tracking_enabled: isTracking ? 'false' : 'true' }));
            }
        } catch (err) {
            console.error('Toggle tracking error:', err);
        }
    }

    async function handleUpdateSetting(key, value) {
        try {
            if (window.electronAPI) {
                await window.electronAPI.updateSetting(key, value);
            }
            setSettings(prev => ({ ...prev, [key]: value }));
        } catch (err) {
            console.error('Update setting error:', err);
        }
    }

    async function handleDeleteHistory(range) {
        try {
            if (window.electronAPI) {
                await window.electronAPI.deleteHistory(range);
            }
            setShowDeleteConfirm(null);
            loadStats();
            if (onStatsUpdate) onStatsUpdate();
        } catch (err) {
            console.error('Delete history error:', err);
        }
    }

    async function handleSetPassword() {
        if (!pwdInput) {
            setPwdError('Password cannot be empty.');
            return;
        }
        try {
            if (window.electronAPI) {
                await window.electronAPI.setPassword(pwdInput);
                setHasPassword(true);
                setPwdInput('');
                setPwdError('');
                setPwdSuccess('Password saved successfully.');
                setTimeout(() => setPwdSuccess(''), 3000);
            }
        } catch (err) {
            setPwdError('Error saving password.');
        }
    }

    async function handleRemovePassword() {
        if (!pwdInput) {
            setPwdError('Enter your current password to remove it.');
            return;
        }
        try {
            if (window.electronAPI) {
                const isValid = await window.electronAPI.verifyPassword(pwdInput);
                if (isValid) {
                    await window.electronAPI.setPassword('');
                    setHasPassword(false);
                    setPwdInput('');
                    setPwdError('');
                    setPwdSuccess('Password removed.');
                    setTimeout(() => setPwdSuccess(''), 3000);
                } else {
                    setPwdError('Incorrect current password.');
                }
            }
        } catch (err) {
            setPwdError('Error verifying password.');
        }
    }

    function getIntervalLabel(seconds) {
        const s = parseInt(seconds);
        if (s < 60) return `${s} seconds`;
        if (s === 60) return '1 minute';
        if (s < 3600) return `${Math.round(s / 60)} minutes`;
        return `${Math.round(s / 3600)} hour(s)`;
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Configure tracking, privacy, and display preferences</p>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value">{stats.totalActivities.toLocaleString()}</div>
                        <div className="stat-label">Total Activities</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.totalScreenshots.toLocaleString()}</div>
                        <div className="stat-label">Screenshots</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.todayActivities.toLocaleString()}</div>
                        <div className="stat-label">Today</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.fileTypes?.length || 0}</div>
                        <div className="stat-label">Activity Types</div>
                    </div>
                </div>
            )}

            <div className="settings-grid">
                {/* Tracking Settings */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        🔄 Tracking
                    </h3>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Enable Activity Tracking</div>
                            <div className="setting-desc">Monitor file changes, browser history, and clipboard</div>
                        </div>
                        <div
                            className={`toggle-switch ${isTracking ? 'active' : ''}`}
                            onClick={handleToggleTracking}
                        />
                    </div>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Enable – Work as Spy</div>
                            <div className="setting-desc">Run invisibly in background on startup (no window or tray icon)</div>
                        </div>
                        <div
                            className={`toggle-switch ${settings.work_as_spy === 'true' ? 'active' : ''}`}
                            onClick={() => handleUpdateSetting('work_as_spy', settings.work_as_spy === 'true' ? 'false' : 'true')}
                        />
                    </div>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Screenshot Interval</div>
                            <div className="setting-desc">
                                Capture desktop every {getIntervalLabel(settings.screenshot_interval)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="range"
                                className="settings-slider"
                                min="60"
                                max="1800"
                                step="60"
                                value={settings.screenshot_interval}
                                onChange={(e) => handleUpdateSetting('screenshot_interval', e.target.value)}
                            />
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', minWidth: '60px' }}>
                                {getIntervalLabel(settings.screenshot_interval)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Application Security */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        🛡️ Application Security
                    </h3>

                    <div className="setting-row" style={{ alignItems: 'flex-start' }}>
                        <div>
                            <div className="setting-label">Startup Password Required</div>
                            <div className="setting-desc">
                                {hasPassword
                                    ? "A password is required to open the application."
                                    : "Protect your memory data with a startup password."}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="password"
                                    placeholder={hasPassword ? "Enter current password..." : "Enter new password..."}
                                    className="search-input"
                                    value={pwdInput}
                                    onChange={(e) => {
                                        setPwdInput(e.target.value);
                                        setPwdError('');
                                        setPwdSuccess('');
                                    }}
                                    style={{ margin: 0, height: '36px', width: '200px', fontSize: '14px' }}
                                />
                                <button
                                    className={hasPassword ? "danger-btn" : "action-btn primary"}
                                    onClick={hasPassword ? handleRemovePassword : handleSetPassword}
                                    style={!hasPassword ? { padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', color: 'white', fontWeight: 500, cursor: 'pointer', background: 'var(--accent-primary)' } : {}}
                                >
                                    {hasPassword ? 'Remove' : 'Set Password'}
                                </button>
                            </div>
                            {pwdError && <span style={{ color: 'var(--accent-red)', fontSize: '12px' }}>{pwdError}</span>}
                            {pwdSuccess && <span style={{ color: 'var(--accent-green)', fontSize: '12px' }}>{pwdSuccess}</span>}
                        </div>
                    </div>
                </div>

                {/* Privacy & Data */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        🔒 Privacy & Data
                    </h3>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Data Storage</div>
                            <div className="setting-desc">All data is stored locally on your computer. No cloud uploads.</div>
                        </div>
                        <span style={{
                            padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(0, 184, 148, 0.15)',
                            color: 'var(--accent-green)', fontSize: 'var(--font-xs)', fontWeight: 600,
                        }}>
                            ✓ Local Only
                        </span>
                    </div>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Delete Today's History</div>
                            <div className="setting-desc">Remove all activities and screenshots from today</div>
                        </div>
                        {showDeleteConfirm === 'today' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="danger-btn" onClick={() => handleDeleteHistory('today')}>Confirm</button>
                                <button
                                    style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}
                                    onClick={() => setShowDeleteConfirm(null)}
                                >Cancel</button>
                            </div>
                        ) : (
                            <button className="danger-btn" onClick={() => setShowDeleteConfirm('today')}>Delete</button>
                        )}
                    </div>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Delete Past Week</div>
                            <div className="setting-desc">Remove all activities from the past 7 days</div>
                        </div>
                        {showDeleteConfirm === 'week' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="danger-btn" onClick={() => handleDeleteHistory('week')}>Confirm</button>
                                <button
                                    style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}
                                    onClick={() => setShowDeleteConfirm(null)}
                                >Cancel</button>
                            </div>
                        ) : (
                            <button className="danger-btn" onClick={() => setShowDeleteConfirm('week')}>Delete</button>
                        )}
                    </div>

                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Delete All History</div>
                            <div className="setting-desc">⚠️ Permanently remove all stored activities, screenshots, and search index</div>
                        </div>
                        {showDeleteConfirm === 'all' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="danger-btn" onClick={() => handleDeleteHistory('all')}>Confirm Delete All</button>
                                <button
                                    style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}
                                    onClick={() => setShowDeleteConfirm(null)}
                                >Cancel</button>
                            </div>
                        ) : (
                            <button className="danger-btn" onClick={() => setShowDeleteConfirm('all')}>Delete All</button>
                        )}
                    </div>
                </div>

                {/* About */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        ℹ️ About
                    </h3>
                    <div className="setting-row">
                        <div>
                            <div className="setting-label">Personal Digital Memory OS</div>
                            <div className="setting-desc">Version 1.0.0 — AI-powered desktop memory system</div>
                        </div>
                    </div>
                    <div className="setting-row">
                        <div>
                            <div className="setting-label">AI Engine</div>
                            <div className="setting-desc">Sentence Transformers (all-MiniLM-L6-v2) + FAISS vector search</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
