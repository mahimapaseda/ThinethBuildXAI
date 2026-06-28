import React from 'react';
import ThemeToggle from './ThemeToggle';

export default function Header({ apiKey, user, onResetKey, onLogout, onAdminPanel, onLoginClick }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 20V8l8-4 8 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="header-title">Build<span>X</span> AI</div>
            <div className="header-tagline">Construction Intelligence</div>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-actions-primary">
            <ThemeToggle />
            <div className="api-status" title={apiKey ? 'Gemini API connected' : 'No API key set'}>
              <div className={`api-status-dot ${apiKey ? 'connected' : ''}`} />
              <span className="api-status-label">{apiKey ? 'AI Ready' : 'No Key'}</span>
            </div>
          </div>

          <div className="header-actions-secondary">
            {user ? (
              <div className="user-profile">
                <div className="user-avatar-sm" title={user.name}>{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                <span className="user-name">{user.name}</span>
                {user.isAdmin && (
                  <button type="button" className="btn-text btn-admin" onClick={onAdminPanel}>Admin</button>
                )}
                <button type="button" className="btn-text btn-logout" onClick={onLogout}>Logout</button>
              </div>
            ) : (
              <button type="button" className="btn btn-secondary btn-header-login" onClick={onLoginClick}>
                Sign In
              </button>
            )}

            {apiKey && (
              <button type="button" className="btn btn-ghost btn-header-reset" onClick={onResetKey}>
                <span className="btn-reset-full">Reset Key</span>
                <span className="btn-reset-short" aria-hidden="true">↺</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
