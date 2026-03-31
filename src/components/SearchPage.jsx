import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export default function SearchPage({ stats }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const searchTimeout = useRef(null);

    useEffect(() => {
        function handleKeyDown(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                setShowResults(false);
                inputRef.current?.blur();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = useCallback(async (value) => {
        setQuery(value);
        if (!value.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                if (window.electronAPI) {
                    const data = await window.electronAPI.search(value);
                    setResults(Array.isArray(data) ? data : data?.results || []);
                } else {
                    // Demo data for development
                    setResults(getDemoResults(value));
                }
                setShowResults(true);
            } catch (err) {
                console.error('Search error:', err);
            }
            setIsSearching(false);
        }, 300);
    }, []);

    function getTypeIcon(type) {
        switch (type) {
            case 'file_created':
            case 'file_modified':
            case 'file_opened':
                return 'file';
            case 'web_visit':
                return 'web';
            case 'clipboard':
                return 'clipboard';
            case 'screenshot':
                return 'screenshot';
            default:
                return 'file';
        }
    }

    function getTypeEmoji(type) {
        switch (type) {
            case 'file_created': return '📄';
            case 'file_modified': return '✏️';
            case 'web_visit': return '🌐';
            case 'clipboard': return '📋';
            case 'screenshot': return '📸';
            default: return '📁';
        }
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async function handleResultClick(result) {
        if (result.file_path && window.electronAPI) {
            await window.electronAPI.openFile(result.file_path);
        } else if (result.url) {
            // Open in default browser
            window.open(result.url, '_blank');
        }
    }

    async function handleDeleteFile(e, result) {
        e.stopPropagation();
        if (result.file_path && window.electronAPI) {
            if (window.confirm(`Are you sure you want to delete ${result.title || 'this file'}?`)) {
                const response = await window.electronAPI.deleteFile(result.file_path);
                if (response.success) {
                    setResults(prev => prev.filter(r => r.id !== result.id));
                } else {
                    alert('Failed to delete file: ' + response.error);
                }
            }
        }
    }

    return (
        <div className="page-container">
            {/* Hero Section */}
            <div style={{ textAlign: 'center', paddingTop: '60px', marginBottom: '48px' }}>
                <h1 style={{
                    fontSize: '2.8rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #00cec9 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '12px',
                    lineHeight: 1.2,
                }}>
                    Memory OS
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-md)', maxWidth: '500px', margin: '0 auto' }}>
                    Search your digital memory with natural language. Every file, screenshot, and activity — instantly recalled.
                </p>
            </div>

            {/* Search Bar */}
            <div className="search-container" ref={containerRef}>
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                    ref={inputRef}
                    className="search-bar"
                    type="text"
                    placeholder="Ask anything... e.g. 'Find the PDF about AI research'"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                />
                <div className="search-shortcut">
                    <span className="kbd">Ctrl</span>
                    <span className="kbd">K</span>
                </div>

                {/* Search Results Dropdown */}
                {showResults && (
                    <div className="search-results">
                        {isSearching ? (
                            <div className="loading-container">
                                <div className="spinner" />
                                <span>Searching your memory...</span>
                            </div>
                        ) : results.length > 0 ? (
                            results.map((result, i) => (
                                <div
                                    key={result.id || i}
                                    className="search-result-item"
                                    onClick={() => handleResultClick(result)}
                                >
                                    <div className={`result-icon ${getTypeIcon(result.type)}`}>
                                        {getTypeEmoji(result.type)}
                                    </div>
                                    <div className="result-info">
                                        <div className="result-title">{result.title || result.text || 'Untitled'}</div>
                                        <div className="result-desc">{result.description || result.file_path || result.url || ''}</div>
                                    </div>
                                    <div className="result-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span className="result-time">{formatTime(result.created_at)}</span>
                                        {result.file_path && (
                                            <button
                                                className="delete-btn"
                                                title="Delete file"
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--danger, #ff4757)',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: 0.6,
                                                    transition: 'opacity 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                                                onClick={(e) => handleDeleteFile(e, result)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : query.trim() ? (
                            <div className="empty-state" style={{ padding: '30px' }}>
                                <p>No results found for "{query}"</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{ marginTop: '48px' }}>
                <div className="stat-card">
                    <div className="stat-value">{stats?.totalActivities ?? '—'}</div>
                    <div className="stat-label">Total Activities</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.todayActivities ?? '—'}</div>
                    <div className="stat-label">Today's Activities</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.totalScreenshots ?? '—'}</div>
                    <div className="stat-label">Screenshots</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.fileTypes?.length ?? '—'}</div>
                    <div className="stat-label">Activity Types</div>
                </div>
            </div>

            {/* Quick Suggestions */}
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginBottom: '12px', textAlign: 'center' }}>
                    Try searching for...
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                        'Find the PDF about AI research',
                        'Show websites I visited today',
                        'Find the screenshot of the chart',
                        'Documents I edited yesterday',
                    ].map((suggestion, i) => (
                        <button
                            key={i}
                            className="suggestion-btn"
                            onClick={() => handleSearch(suggestion)}
                        >
                            💡 {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function getDemoResults(query) {
    return [
        { id: 1, type: 'file_modified', title: 'AI_Research_Paper.pdf', description: 'Modified in Documents', file_path: 'C:\\Users\\Documents\\AI_Research_Paper.pdf', created_at: new Date().toISOString() },
        { id: 2, type: 'web_visit', title: 'OpenAI - Artificial Intelligence', description: 'Visited in Chrome', url: 'https://openai.com', created_at: new Date().toISOString() },
        { id: 3, type: 'file_created', title: 'meeting_notes.docx', description: 'Created in Downloads', file_path: 'C:\\Users\\Downloads\\meeting_notes.docx', created_at: new Date().toISOString() },
        { id: 4, type: 'clipboard', title: 'Clipboard copy', description: query.substring(0, 80), created_at: new Date().toISOString() },
    ];
}
