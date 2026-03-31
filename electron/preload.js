const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Search
    search: (query) => ipcRenderer.invoke('search', query),

    // Timeline
    getTimeline: (date, limit) => ipcRenderer.invoke('get-timeline', date, limit),
    getTimelineRange: (startDate, endDate) => ipcRenderer.invoke('get-timeline-range', startDate, endDate),

    // Screenshots
    getScreenshots: (date, limit) => ipcRenderer.invoke('get-screenshots', date, limit),
    captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
    getImageData: (filePath) => ipcRenderer.invoke('get-image-data', filePath),

    // Files
    getTrackedFiles: (filters) => ipcRenderer.invoke('get-tracked-files', filters),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    openFolder: (filePath) => ipcRenderer.invoke('open-folder', filePath),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

    // AI Assistant
    askAssistant: (question) => ipcRenderer.invoke('ask-assistant', question),

    // Settings & Security
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (key, value) => ipcRenderer.invoke('update-setting', key, value),
    hasPassword: () => ipcRenderer.invoke('has-password'),
    verifyPassword: (password) => ipcRenderer.invoke('verify-password', password),
    setPassword: (password) => ipcRenderer.invoke('set-password', password),
    toggleTracking: () => ipcRenderer.invoke('toggle-tracking'),
    deleteHistory: (range) => ipcRenderer.invoke('delete-history', range),
    getStats: () => ipcRenderer.invoke('get-stats'),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    // Events from main process
    onTrackingUpdate: (callback) => {
        ipcRenderer.on('tracking-update', (_, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('tracking-update');
    },
    onNewActivity: (callback) => {
        ipcRenderer.on('new-activity', (_, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('new-activity');
    },
});
