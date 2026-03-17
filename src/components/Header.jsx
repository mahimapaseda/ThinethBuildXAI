import React from 'react';

export default function Header({ apiKey, onResetKey }) {
    return (
        <header className="header">
            <div className="header-brand">
                <div className="header-logo">B</div>
                <div className="header-title">Build<span>X</span> AI</div>
            </div>
            <div className="header-actions">
                <div className="api-status">
                    <div className={`api-status-dot ${apiKey ? 'connected' : ''}`}></div>
                    {apiKey ? 'AI Connected' : 'No API Key'}
                </div>
                {apiKey && (
                    <button className="btn btn-secondary btn-header-reset" onClick={onResetKey}>
                        Reset Key
                    </button>
                )}
            </div>
        </header>
    );
}
