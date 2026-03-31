import React, { useState, useEffect, useRef } from 'react';

// Component to lazily load a screenshot image via IPC
function ScreenshotImage({ filePath, className, onClick, style }) {
    const [src, setSrc] = useState(null);
    const loaded = useRef(false);

    useEffect(() => {
        if (filePath && window.electronAPI && !loaded.current) {
            loaded.current = true;
            window.electronAPI.getImageData(filePath).then(data => {
                if (data) setSrc(data);
            }).catch(() => { });
        }
    }, [filePath]);

    if (!filePath) {
        return (
            <div className={className} style={style} onClick={onClick}>
                📸
            </div>
        );
    }

    return (
        <div className={className} style={style} onClick={onClick}>
            {src ? (
                <img
                    src={src}
                    alt="Screenshot"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                />
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    ⏳ Loading...
                </div>
            )}
        </div>
    );
}

export default function ScreenshotsViewer() {
    const [screenshots, setScreenshots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadScreenshots();
    }, [selectedDate]);

    async function loadScreenshots() {
        setLoading(true);
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getScreenshots(selectedDate, 100);
                setScreenshots(data || []);
            } else {
                setScreenshots(getDemoScreenshots());
            }
        } catch (err) {
            console.error('Screenshots error:', err);
        }
        setLoading(false);
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        // Database stores UTC time via CURRENT_TIMESTAMP
        // Append 'Z' if no timezone marker present so JS treats it as UTC
        const normalized = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
        const d = new Date(normalized);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    async function openLightbox(filePath) {
        if (!filePath || !window.electronAPI) return;
        try {
            const data = await window.electronAPI.getImageData(filePath);
            if (data) setLightboxSrc(data);
        } catch (err) {
            console.error('Lightbox load error:', err);
        }
    }

    const filteredScreenshots = searchQuery
        ? screenshots.filter(s => s.ocr_text?.toLowerCase().includes(searchQuery.toLowerCase()))
        : screenshots;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Screenshots</h1>
                <p className="page-subtitle">Automatically captured screenshots of your desktop activity</p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                        padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                        border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
                        fontSize: 'var(--font-sm)',
                    }}
                />
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search screenshot text (OCR)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)', fontSize: 'var(--font-sm)',
                        }}
                    />
                </div>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>
                    {filteredScreenshots.length} screenshots
                </span>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <span>Loading screenshots...</span>
                </div>
            ) : filteredScreenshots.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📸</div>
                    <h3>No screenshots captured yet</h3>
                    <p>Screenshots are automatically captured at regular intervals. They'll appear here once tracking is active.</p>
                </div>
            ) : (
                <div className="screenshots-grid">
                    {filteredScreenshots.map((screenshot, i) => (
                        <div
                            key={screenshot.id || i}
                            className="screenshot-card"
                            onClick={() => openLightbox(screenshot.file_path || screenshot.thumbnail_path)}
                        >
                            <ScreenshotImage
                                filePath={screenshot.thumbnail_path}
                                className="screenshot-image"
                                style={{
                                    backgroundColor: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    fontSize: '2rem',
                                    overflow: 'hidden',
                                }}
                            />
                            <div className="screenshot-info">
                                <div className="screenshot-time">
                                    🕐 {formatTime(screenshot.created_at)}
                                </div>
                                {screenshot.ocr_text && (
                                    <div className="screenshot-ocr">{screenshot.ocr_text}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxSrc && (
                <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
                    <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
                    <img
                        className="lightbox-image"
                        src={lightboxSrc}
                        alt="Screenshot"
                    />
                </div>
            )}
        </div>
    );
}

function getDemoScreenshots() {
    const now = new Date();
    return [
        { id: 1, file_path: '', thumbnail_path: '', ocr_text: 'Visual Studio Code - main.js file editing', created_at: new Date(now - 1000 * 60 * 5).toISOString() },
        { id: 2, file_path: '', thumbnail_path: '', ocr_text: 'Chrome browser - Stack Overflow discussion', created_at: new Date(now - 1000 * 60 * 10).toISOString() },
        { id: 3, file_path: '', thumbnail_path: '', ocr_text: 'File Explorer - Documents folder view', created_at: new Date(now - 1000 * 60 * 15).toISOString() },
    ];
}
