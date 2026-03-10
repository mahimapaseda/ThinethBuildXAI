import React from 'react';

export default function Header({ apiKey, user, onResetKey, onLogout, onAdminPanel, onLoginClick }) {
    return (
        <header className="header">
            <div className="header-brand">
                <div className="header-logo">B</div>
                <div className="header-title">Build<span>X</span> AI</div>
            </div>
            <div className="header-actions">
                {user ? (
                    <div className="user-profile">
                        <span className="user-name">👤 {user.name}</span>
                        {user.isAdmin && (
                            <button className="btn btn-text btn-admin" onClick={onAdminPanel}>Admin Panel</button>
                        )}
                        <button className="btn btn-text btn-logout" onClick={onLogout}>Logout</button>
                    </div>
                ) : (
                    <button className="btn btn-text btn-login" onClick={onLoginClick}>Login / Sign Up</button>
                )}
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
