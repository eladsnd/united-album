"use client";
import Link from 'next/link';
import { Camera, Image, Smartphone, Upload, Settings } from 'lucide-react';
import Leaderboard from './Leaderboard';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlag';

export default function Sidebar({ activeSection, setActiveSection, eventSlug = null, eventName = null, eventDescription = null }) {
    const { flags, loading } = useFeatureFlags();

    // All possible menu items with their feature flag requirements
    const allMenuItems = [
        { id: 'challenge', label: 'Pose Challenge', icon: Camera, requiresFeature: 'challenges' },
        { id: 'gallery', label: 'Album Gallery', icon: Image, alwaysShow: true },
        { id: 'bulk-upload', label: 'Regular Photos', icon: Upload, requiresFeature: 'bulkUpload' },
        { id: 'access', label: 'App Access', icon: Smartphone, alwaysShow: true }
    ];

    // Filter menu items based on feature flags
    const menuItems = allMenuItems.filter(item => {
        // Always show items that don't require a feature flag
        if (item.alwaysShow) return true;

        // Only show if the required feature is enabled
        if (item.requiresFeature) {
            return flags?.[item.requiresFeature] === true;
        }

        return true;
    });

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="logo">{eventName || 'UNITED ALBUM'}</h1>
                {eventDescription && <p className="tagline">{eventDescription}</p>}
                {!eventDescription && !eventName && <p className="tagline">Wedding Memories</p>}
            </div>

            <nav className="sidebar-nav">
                {menuItems?.map((item) => (
                    <button
                        key={item.id}
                        className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(item.id)}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div style={{ padding: '1rem', flex: 1, overflow: 'auto' }}>
                <Leaderboard />
            </div>

            <div className="sidebar-footer">
                <Link href={eventSlug ? `/${eventSlug}/admin` : "/admin"} className="admin-link">
                    <Settings size={14} />
                    <span>Admin</span>
                </Link>
            </div>
        </aside>
    );
}
