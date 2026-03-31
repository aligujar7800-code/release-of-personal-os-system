import React, { useState, useEffect } from 'react';

export default function Timeline() {
    const [activities, setActivities] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTimeline();
    }, [selectedDate]);

    async function loadTimeline() {
        setLoading(true);
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getTimeline(selectedDate, 200);
                setActivities(data || []);
            } else {
                setActivities(getDemoTimeline());
            }
        } catch (err) {
            console.error('Timeline error:', err);
        }
        setLoading(false);
    }

    function getTypeBadge(type) {
        const badges = {
            file_created: { class: 'badge-file', icon: '📄', label: 'Created' },
            file_modified: { class: 'badge-file', icon: '✏️', label: 'Modified' },
            file_deleted: { class: 'badge-file', icon: '🗑️', label: 'Deleted' },
            web_visit: { class: 'badge-web', icon: '🌐', label: 'Web' },
            clipboard: { class: 'badge-clipboard', icon: '📋', label: 'Clipboard' },
            screenshot: { class: 'badge-screenshot', icon: '📸', label: 'Screenshot' },
        };
        return badges[type] || { class: '', icon: '📁', label: type };
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function navigateDate(direction) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + direction);
        setSelectedDate(d.toISOString().split('T')[0]);
    }

    function formatDateDisplay(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (dateStr === today) return 'Today';
        if (dateStr === yesterday) return 'Yesterday';
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    async function handleItemClick(activity) {
        if (activity.file_path && window.electronAPI) {
            await window.electronAPI.openFile(activity.file_path);
        } else if (activity.url) {
            window.open(activity.url, '_blank');
        }
    }

    // Group activities by hour
    function groupByHour(items) {
        const groups = {};
        items.forEach(item => {
            const hour = item.created_at ? new Date(item.created_at).getHours() : 0;
            const key = `${hour.toString().padStart(2, '0')}:00`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }

    const hourGroups = groupByHour(activities);

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Activity Timeline</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <button
                        onClick={() => navigateDate(-1)}
                        style={{
                            padding: '8px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                            border: '1px solid var(--glass-border)', color: 'var(--text-secondary)',
                            fontSize: 'var(--font-sm)', cursor: 'pointer',
                        }}
                    >
                        ← Prev
                    </button>
                    <span style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatDateDisplay(selectedDate)}
                    </span>
                    <button
                        onClick={() => navigateDate(1)}
                        style={{
                            padding: '8px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                            border: '1px solid var(--glass-border)', color: 'var(--text-secondary)',
                            fontSize: 'var(--font-sm)', cursor: 'pointer',
                        }}
                    >
                        Next →
                    </button>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                            border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
                            fontSize: 'var(--font-sm)', cursor: 'pointer',
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <span>Loading timeline...</span>
                </div>
            ) : activities.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🕐</div>
                    <h3>No activities recorded</h3>
                    <p>Activities will appear here once tracking is active and events are captured.</p>
                </div>
            ) : (
                <div className="timeline-container">
                    {hourGroups.map(([hour, items]) => (
                        <div key={hour} style={{ marginBottom: '24px' }}>
                            <div className="timeline-date-header">{hour}</div>
                            <div className="timeline-list">
                                {items.map((activity, i) => {
                                    const badge = getTypeBadge(activity.type);
                                    return (
                                        <div
                                            key={activity.id || i}
                                            className="timeline-item"
                                            onClick={() => handleItemClick(activity)}
                                        >
                                            <div className="timeline-item-header">
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span className={`timeline-type-badge ${badge.class}`}>
                                                        {badge.icon} {badge.label}
                                                    </span>
                                                    <span className="timeline-item-title">
                                                        {activity.title || 'Unknown Activity'}
                                                    </span>
                                                </div>
                                                <span className="timeline-item-time">{formatTime(activity.created_at)}</span>
                                            </div>
                                            {activity.description && (
                                                <div className="timeline-item-desc">{activity.description}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getDemoTimeline() {
    const now = new Date();
    return [
        { id: 1, type: 'file_modified', title: 'Project_Plan.docx', description: 'File modified in Documents', created_at: new Date(now - 1000 * 60 * 5).toISOString() },
        { id: 2, type: 'web_visit', title: 'Stack Overflow - React Hooks', description: 'Visited in Chrome', url: 'https://stackoverflow.com', created_at: new Date(now - 1000 * 60 * 15).toISOString() },
        { id: 3, type: 'clipboard', title: 'Clipboard copy', description: 'const [state, setState] = useState(null);', created_at: new Date(now - 1000 * 60 * 20).toISOString() },
        { id: 4, type: 'file_created', title: 'screenshot_2024.png', description: 'File created in Pictures', created_at: new Date(now - 1000 * 60 * 45).toISOString() },
        { id: 5, type: 'web_visit', title: 'GitHub - Personal Projects', description: 'Visited in Chrome', url: 'https://github.com', created_at: new Date(now - 1000 * 60 * 60).toISOString() },
        { id: 6, type: 'file_modified', title: 'report_analysis.pdf', description: 'File modified in Downloads', created_at: new Date(now - 1000 * 60 * 90).toISOString() },
    ];
}
