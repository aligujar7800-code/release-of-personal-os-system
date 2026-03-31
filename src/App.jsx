import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import SearchPage from './components/SearchPage';
import Timeline from './components/Timeline';
import ScreenshotsViewer from './components/ScreenshotsViewer';
import FilesExplorer from './components/FilesExplorer';
import AssistantPanel from './components/AssistantPanel';
import Settings from './components/Settings';
import Login from './components/Login';

const PAGES = {
    search: 'search',
    timeline: 'timeline',
    screenshots: 'screenshots',
    files: 'files',
    assistant: 'assistant',
    settings: 'settings',
};

export default function App() {
    const [currentPage, setCurrentPage] = useState(PAGES.search);
    const [isTracking, setIsTracking] = useState(true);
    const [stats, setStats] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        checkAuth();
        loadStats();
        loadTrackingState();
    }, []);

    async function checkAuth() {
        try {
            if (window.electronAPI) {
                const hasPassword = await window.electronAPI.hasPassword();
                if (!hasPassword) {
                    setIsAuthenticated(true);
                }
            } else {
                // Dev fallback without backend
                setIsAuthenticated(true);
            }
        } catch (err) {
            console.error('Failed to check auth:', err);
            // Default to safe side if DB fails
            setIsAuthenticated(false);
        } finally {
            setIsCheckingAuth(false);
        }
    }

    async function loadStats() {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getStats();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    async function loadTrackingState() {
        try {
            if (window.electronAPI) {
                const settings = await window.electronAPI.getSettings();
                setIsTracking(settings?.tracking_enabled !== 'false');
            }
        } catch (err) {
            console.error('Failed to load tracking state:', err);
        }
    }

    function renderPage() {
        switch (currentPage) {
            case PAGES.search:
                return <SearchPage stats={stats} />;
            case PAGES.timeline:
                return <Timeline />;
            case PAGES.screenshots:
                return <ScreenshotsViewer />;
            case PAGES.files:
                return <FilesExplorer />;
            case PAGES.assistant:
                return <AssistantPanel />;
            case PAGES.settings:
                return <Settings isTracking={isTracking} setIsTracking={setIsTracking} onStatsUpdate={loadStats} />;
            default:
                return <SearchPage stats={stats} />;
        }
    }

    if (isCheckingAuth) {
        return <div style={{ height: '100vh', width: '100vw', background: '#0a0a1a' }} />;
    }

    if (!isAuthenticated) {
        return <Login onAuthenticated={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className="app-layout">
            <TitleBar />
            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} isTracking={isTracking} />
            <main className="main-content">
                {renderPage()}
            </main>
        </div>
    );
}
