import React from 'react';

export default function TitleBar() {
    function handleMinimize() {
        if (window.electronAPI) window.electronAPI.minimizeWindow();
    }

    function handleMaximize() {
        if (window.electronAPI) window.electronAPI.maximizeWindow();
    }

    function handleClose() {
        if (window.electronAPI) window.electronAPI.closeWindow();
    }

    return (
        <div className="title-bar">
            <span className="title-bar-text">Memory OS</span>
            <div className="title-bar-controls">
                <button className="title-bar-btn" onClick={handleMinimize} title="Minimize">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect y="5" width="12" height="2" rx="1" fill="currentColor" /></svg>
                </button>
                <button className="title-bar-btn" onClick={handleMaximize} title="Maximize">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
                </button>
                <button className="title-bar-btn close" onClick={handleClose} title="Close">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
            </div>
        </div>
    );
}
