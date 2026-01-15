"use client";
import { useState, useEffect } from 'react';
import AdminAuth from '../../components/AdminAuth';
import AdminPoseManager from '../../components/AdminPoseManager';

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminToken, setAdminToken] = useState(null);

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
    };

    return (
        <div className="admin-container">
            {!isAuthenticated ? (
                <AdminAuth onAuthSuccess={handleAuthSuccess} />
            ) : (
                <AdminPoseManager
                    adminToken={adminToken}
                    onLogout={handleLogout}
                />
            )}
        </div>
    );
}
