"use client";
import { useState } from 'react';

export default function AdminAuth({ onAuthSuccess }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await res.json();

            if (res.ok) {
                onAuthSuccess(data.token);
            } else {
                setError(data.error || 'Authentication failed');
            }
        } catch (err) {
            console.error('[AdminAuth] Error:', err);
            setError('Failed to authenticate. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-auth-container">
            <div className="admin-auth-card card">
                <div className="admin-auth-header">
                    <div className="admin-icon">🔐</div>
                    <h1 style={{ fontWeight: '400', marginBottom: '0.5rem' }}>Administrator Access</h1>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '2rem' }}>
                        Enter your administrator password to continue
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="admin-auth-form">
                    <div className="form-group">
                        <label htmlFor="admin-password" className="form-label">
                            Password
                        </label>
                        <input
                            id="admin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="form-input"
                            placeholder="Enter admin password"
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                            {error.includes('not configured') && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                    Please set the ADMIN_PASSWORD environment variable in .env.local
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn admin-auth-btn"
                        disabled={loading || !password}
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin">⟳</span>
                                Authenticating...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div className="admin-auth-footer">
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center' }}>
                        This area is restricted to authorized administrators only
                    </p>
                </div>
            </div>
        </div>
    );
}
