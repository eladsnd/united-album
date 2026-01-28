"use client";
import { useState, useEffect } from 'react';
import AdminAuth from '../../components/admin/AdminAuth';
import AdminPoseManager from '../../components/admin/AdminPoseManager';
import AdminEventManager from '../../components/admin/AdminEventManager';
import FeatureFlagPanel from '../../components/admin/FeatureFlagPanel';
import { Image as ImageIcon, Calendar, Settings, LogOut, Zap } from 'lucide-react';

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminToken, setAdminToken] = useState(null);
    const [activeTab, setActiveTab] = useState('poses');

    useEffect(() => {
        // Check for existing admin session
        const token = sessionStorage.getItem('admin_token');
        if (token) {
            setAdminToken(token);
            setIsAuthenticated(true);
        }
    }, []);

    const handleAuthSuccess = (token) => {
        sessionStorage.setItem('admin_token', token);
        setAdminToken(token);
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_token');
        setAdminToken(null);
        setIsAuthenticated(false);
        setActiveTab('poses');
    };

    if (!isAuthenticated) {
        return (
            <div className="admin-container">
                <AdminAuth onAuthSuccess={handleAuthSuccess} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with Navigation Actions */}
            <div style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                borderBottom: '2px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 style={{
                        fontSize: '1.875rem',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        Admin Panel
                    </h1>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <a
                            href="/"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1.5rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.9375rem',
                                borderRadius: '0.75rem',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            Back to Album
                        </a>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1.5rem',
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.9375rem',
                                borderRadius: '0.75rem',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                            }}
                        >
                            <LogOut size={18} strokeWidth={2.5} />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{
                background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
                borderBottom: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div className="max-w-7xl mx-auto px-6">
                    <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem' }}>
                        <button
                            onClick={() => setActiveTab('poses')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.875rem 1.5rem',
                                fontWeight: '600',
                                fontSize: '0.9375rem',
                                borderRadius: '0.75rem 0.75rem 0 0',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                background: activeTab === 'poses'
                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                    : 'transparent',
                                color: activeTab === 'poses' ? 'white' : '#6b7280',
                                boxShadow: activeTab === 'poses'
                                    ? '0 4px 12px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    : 'none',
                                transform: activeTab === 'poses' ? 'translateY(0)' : 'translateY(2px)',
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== 'poses') {
                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                                    e.currentTarget.style.color = '#3b82f6';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== 'poses') {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }}
                        >
                            <ImageIcon size={20} strokeWidth={2.5} />
                            Pose Challenges
                        </button>

                        <button
                            onClick={() => setActiveTab('events')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.875rem 1.5rem',
                                fontWeight: '600',
                                fontSize: '0.9375rem',
                                borderRadius: '0.75rem 0.75rem 0 0',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                background: activeTab === 'events'
                                    ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                                    : 'transparent',
                                color: activeTab === 'events' ? 'white' : '#6b7280',
                                boxShadow: activeTab === 'events'
                                    ? '0 4px 12px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    : 'none',
                                transform: activeTab === 'events' ? 'translateY(0)' : 'translateY(2px)',
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== 'events') {
                                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                                    e.currentTarget.style.color = '#8b5cf6';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== 'events') {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }}
                        >
                            <Calendar size={20} strokeWidth={2.5} />
                            Event Timeline
                        </button>

                        <button
                            onClick={() => setActiveTab('timed')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.875rem 1.5rem',
                                fontWeight: '600',
                                fontSize: '0.9375rem',
                                borderRadius: '0.75rem 0.75rem 0 0',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                background: activeTab === 'timed'
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : 'transparent',
                                color: activeTab === 'timed' ? 'white' : '#6b7280',
                                boxShadow: activeTab === 'timed'
                                    ? '0 4px 12px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    : 'none',
                                transform: activeTab === 'timed' ? 'translateY(0)' : 'translateY(2px)',
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== 'timed') {
                                    e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
                                    e.currentTarget.style.color = '#f59e0b';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== 'timed') {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }}
                        >
                            <Zap size={20} strokeWidth={2.5} />
                            Timed Challenges
                        </button>

                        <button
                            onClick={() => setActiveTab('features')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.875rem 1.5rem',
                                fontWeight: '600',
                                fontSize: '0.9375rem',
                                borderRadius: '0.75rem 0.75rem 0 0',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                background: activeTab === 'features'
                                    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                    : 'transparent',
                                color: activeTab === 'features' ? 'white' : '#6b7280',
                                boxShadow: activeTab === 'features'
                                    ? '0 4px 12px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    : 'none',
                                transform: activeTab === 'features' ? 'translateY(0)' : 'translateY(2px)',
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== 'features') {
                                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                                    e.currentTarget.style.color = '#6366f1';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== 'features') {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }}
                        >
                            <Settings size={20} strokeWidth={2.5} />
                            Feature Flags
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="py-6">
                {activeTab === 'poses' && (
                    <AdminPoseManager
                        adminToken={adminToken}
                        timedOnly={false}
                    />
                )}
                {activeTab === 'timed' && (
                    <AdminPoseManager
                        adminToken={adminToken}
                        timedOnly={true}
                    />
                )}
                {activeTab === 'events' && (
                    <AdminEventManager
                        adminToken={adminToken}
                    />
                )}
                {activeTab === 'features' && (
                    <FeatureFlagPanel
                        adminToken={adminToken}
                    />
                )}
            </div>
        </div>
    );
}
