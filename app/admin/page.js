"use client";
import { useState, useEffect } from 'react';
import AdminAuth from '../../components/AdminAuth';
import AdminPoseManager from '../../components/AdminPoseManager';
import AdminEventManager from '../../components/AdminEventManager';
import FeatureFlagPanel from '../../components/FeatureFlagPanel';
import GamifyToggle from '../../components/GamifyToggle';
import { Image as ImageIcon, Calendar, Settings, LogOut } from 'lucide-react';

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
            {/* Header with Logout */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                        <GamifyToggle adminToken={adminToken} />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('poses')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition relative ${
                                activeTab === 'poses'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                            }`}
                        >
                            <ImageIcon size={20} />
                            Pose Challenges
                        </button>
                        <button
                            onClick={() => setActiveTab('events')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition relative ${
                                activeTab === 'events'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                            }`}
                        >
                            <Calendar size={20} />
                            Event Timeline
                        </button>
                        <button
                            onClick={() => setActiveTab('features')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition relative ${
                                activeTab === 'features'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                            }`}
                        >
                            <Settings size={20} />
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
                        onLogout={handleLogout}
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
