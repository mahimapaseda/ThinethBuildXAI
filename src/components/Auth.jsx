import React, { useState } from 'react';
import { register, login } from '../services/api';

export default function Auth({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        address: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });

    const checkPasswordStrength = (pwd) => {
        let score = 0;
        if (pwd.length >= 8) score++;
        if (pwd.length >= 12) score++;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
        if (/\d/.test(pwd)) score++;
        if (/[^a-zA-Z0-9]/.test(pwd)) score++;

        const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
        const colors = ['#ef4444', '#f59e0b', '#eab308', '#10b981', '#059669'];
        return { score, label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)] };
    };

    const update = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'password') setPasswordStrength(checkPasswordStrength(value));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.email || !formData.password) {
            return setError('Email and password are required.');
        }

        if (!isLogin) {
            if (!formData.name) return setError('Full name is required.');
            if (formData.password.length < 8) return setError('Password must be at least 8 characters.');
            if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
            if (!formData.phone) return setError('Phone number is required.');
        }

        setLoading(true);
        try {
            let data;
            if (isLogin) {
                data = await login({ email: formData.email, password: formData.password });
            } else {
                data = await register({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    password: formData.password,
                });
            }
            onLogin(data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-in">
            <div className="glass-card auth-card">
                <div className="auth-header">
                    <div className="welcome-badge">🏗️ BuildX AI</div>
                    <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                    <p>{isLogin ? 'Sign in to access your engineering projects' : 'Register to start your construction journey'}</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => update('name', e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email Address *</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={(e) => update('email', e.target.value)}
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Phone Number *</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="+91 98765 43210"
                                    value={formData.phone}
                                    onChange={(e) => update('phone', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Enter your full address"
                                    value={formData.address}
                                    onChange={(e) => update('address', e.target.value)}
                                    rows={2}
                                    style={{ minHeight: '60px' }}
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Password *</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => update('password', e.target.value)}
                        />
                        {!isLogin && formData.password && (
                            <div className="password-strength">
                                <div className="strength-bar">
                                    <div
                                        className="strength-fill"
                                        style={{ width: `${(passwordStrength.score / 5) * 100}%`, background: passwordStrength.color }}
                                    />
                                </div>
                                <span style={{ color: passwordStrength.color, fontSize: '0.75rem' }}>
                                    {passwordStrength.label}
                                </span>
                            </div>
                        )}
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label">Confirm Password *</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => update('confirmPassword', e.target.value)}
                            />
                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                <span className="field-error">Passwords do not match</span>
                            )}
                        </div>
                    )}

                    {error && <div className="auth-error">{error}</div>}

                    <button type="submit" className="btn btn-primary btn-large w-full" disabled={loading}>
                        {loading ? '⏳ Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="auth-footer">
                    <button className="btn-text" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>

            <style>{`
                .auth-container {
                    max-width: 520px;
                    margin: 60px auto;
                    padding: 20px;
                }
                .auth-card {
                    padding: 40px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .auth-header {
                    text-align: center;
                    margin-bottom: 32px;
                }
                .auth-header h2 {
                    margin: 16px 0 8px;
                    font-size: 1.85rem;
                }
                .auth-header p {
                    color: var(--text-secondary);
                    font-size: 0.95rem;
                }
                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .auth-footer {
                    margin-top: 24px;
                    text-align: center;
                }
                .w-full {
                    width: 100%;
                }
                .btn-text {
                    background: none;
                    border: none;
                    color: var(--accent-blue);
                    cursor: pointer;
                    font-size: 0.9rem;
                    text-decoration: underline;
                }
                .auth-error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    text-align: center;
                }
                .field-error {
                    color: #ef4444;
                    font-size: 0.75rem;
                    margin-top: 4px;
                }
                .password-strength {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 6px;
                }
                .strength-bar {
                    flex: 1;
                    height: 4px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 2px;
                    overflow: hidden;
                }
                .strength-fill {
                    height: 100%;
                    border-radius: 2px;
                    transition: all 0.3s ease;
                }
            `}</style>
        </div>
    );
}
