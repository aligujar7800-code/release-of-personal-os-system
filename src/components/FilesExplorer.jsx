import React, { useState, useEffect } from 'react';

const FILE_TYPES = [
    { id: 'all', label: 'All Files' },
    { id: '.pdf', label: 'PDFs' },
    { id: '.docx', label: 'Word' },
    { id: '.txt', label: 'Text' },
    { id: '.png', label: 'Images' },
    { id: '.xlsx', label: 'Excel' },
];

const EXT_COLORS = {
    '.pdf': { bg: 'rgba(225, 112, 85, 0.15)', color: '#e17055' },
    '.docx': { bg: 'rgba(116, 185, 255, 0.15)', color: '#74b9ff' },
    '.doc': { bg: 'rgba(116, 185, 255, 0.15)', color: '#74b9ff' },
    '.txt': { bg: 'rgba(162, 155, 254, 0.15)', color: '#a29bfe' },
    '.md': { bg: 'rgba(162, 155, 254, 0.15)', color: '#a29bfe' },
    '.png': { bg: 'rgba(0, 184, 148, 0.15)', color: '#00b894' },
    '.jpg': { bg: 'rgba(0, 184, 148, 0.15)', color: '#00b894' },
    '.jpeg': { bg: 'rgba(0, 184, 148, 0.15)', color: '#00b894' },
    '.gif': { bg: 'rgba(0, 184, 148, 0.15)', color: '#00b894' },
    '.xlsx': { bg: 'rgba(0, 206, 201, 0.15)', color: '#00cec9' },
    '.csv': { bg: 'rgba(0, 206, 201, 0.15)', color: '#00cec9' },
    '.js': { bg: 'rgba(243, 156, 18, 0.15)', color: '#f39c12' },
    '.py': { bg: 'rgba(108, 92, 231, 0.15)', color: '#6c5ce7' },
    '.html': { bg: 'rgba(253, 121, 168, 0.15)', color: '#fd79a8' },
};

export default function FilesExplorer() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadFiles();
    }, [activeFilter]);

    async function loadFiles() {
        setLoading(true);
        try {
            if (window.electronAPI) {
                const filters = {};
                if (activeFilter !== 'all') filters.type = activeFilter;
                if (searchQuery) filters.search = searchQuery;
                const data = await window.electronAPI.getTrackedFiles(filters);
                setFiles(data || []);
            } else {
                setFiles(getDemoFiles());
            }
        } catch (err) {
            console.error('Files error:', err);
        }
        setLoading(false);
    }

    function getExtension(filename) {
        if (!filename) return '';
        const parts = filename.split('.');
        return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
    }

    function getExtColor(ext) {
        return EXT_COLORS[ext] || { bg: 'rgba(107, 110, 138, 0.15)', color: '#6b6e8a' };
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatSize(metadata) {
        try {
            const m = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            const size = m?.size;
            if (!size) return '—';
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        } catch {
            return '—';
        }
    }

    function getTypeLabel(type) {
        switch (type) {
            case 'file_created': return '🆕 Created';
            case 'file_modified': return '✏️ Modified';
            case 'file_deleted': return '🗑️ Deleted';
            default: return type;
        }
    }

    async function handleFileClick(file) {
        if (file.file_path && window.electronAPI) {
            await window.electronAPI.openFile(file.file_path);
        }
    }

    async function handleFolderClick(e, file) {
        e.stopPropagation();
        if (file.file_path && window.electronAPI) {
            await window.electronAPI.openFolder(file.file_path);
        }
    }

    const filteredFiles = searchQuery
        ? files.filter(f => f.title?.toLowerCase().includes(searchQuery.toLowerCase()))
        : files;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Files & Memory</h1>
                <p className="page-subtitle">All tracked files and documents from your computer</p>
            </div>

            {/* Toolbar */}
            <div className="files-toolbar">
                {FILE_TYPES.map((ft) => (
                    <button
                        key={ft.id}
                        className={`files-filter-btn ${activeFilter === ft.id ? 'active' : ''}`}
                        onClick={() => setActiveFilter(ft.id)}
                    >
                        {ft.label}
                    </button>
                ))}
                <div style={{ flex: 1 }} />
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)',
                        border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
                        fontSize: 'var(--font-sm)', width: '200px',
                    }}
                />
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                    <span>Loading files...</span>
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📂</div>
                    <h3>No files tracked yet</h3>
                    <p>Files will appear here as they are created, modified, or accessed in your watched directories.</p>
                </div>
            ) : (
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table className="files-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Action</th>
                                <th>Size</th>
                                <th>Date</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFiles.map((file, i) => {
                                const ext = getExtension(file.title || '');
                                const extColor = getExtColor(ext);
                                return (
                                    <tr key={file.id || i} onClick={() => handleFileClick(file)}>
                                        <td>
                                            <div className="file-name-cell">
                                                <div
                                                    className="file-ext-icon"
                                                    style={{ background: extColor.bg, color: extColor.color }}
                                                >
                                                    {ext.replace('.', '') || '?'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                        {file.title || 'Unnamed'}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                                                        {file.file_path ? file.file_path.split('\\').slice(0, -1).join('\\') : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {getTypeLabel(file.type)}
                                        </td>
                                        <td style={{ color: 'var(--text-tertiary)' }}>
                                            {formatSize(file.metadata)}
                                        </td>
                                        <td style={{ color: 'var(--text-tertiary)' }}>
                                            {formatDate(file.created_at)}
                                        </td>
                                        <td>
                                            <button
                                                onClick={(e) => handleFolderClick(e, file)}
                                                style={{
                                                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                                    fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)',
                                                    background: 'var(--bg-elevated)',
                                                }}
                                                title="Show in folder"
                                            >
                                                📁
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function getDemoFiles() {
    const now = new Date();
    return [
        { id: 1, type: 'file_modified', title: 'Project_Proposal.pdf', file_path: 'C:\\Users\\Documents\\Project_Proposal.pdf', metadata: '{"ext":".pdf","size":2457600}', created_at: new Date(now - 3600000).toISOString() },
        { id: 2, type: 'file_created', title: 'meeting_notes.docx', file_path: 'C:\\Users\\Documents\\meeting_notes.docx', metadata: '{"ext":".docx","size":156000}', created_at: new Date(now - 7200000).toISOString() },
        { id: 3, type: 'file_modified', title: 'dataset_analysis.py', file_path: 'C:\\Users\\Projects\\dataset_analysis.py', metadata: '{"ext":".py","size":8200}', created_at: new Date(now - 14400000).toISOString() },
        { id: 4, type: 'file_created', title: 'chart_screenshot.png', file_path: 'C:\\Users\\Pictures\\chart_screenshot.png', metadata: '{"ext":".png","size":564000}', created_at: new Date(now - 28800000).toISOString() },
        { id: 5, type: 'file_modified', title: 'budget_2024.xlsx', file_path: 'C:\\Users\\Documents\\budget_2024.xlsx', metadata: '{"ext":".xlsx","size":98000}', created_at: new Date(now - 36000000).toISOString() },
    ];
}
