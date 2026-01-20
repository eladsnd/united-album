"use client";
import Link from 'next/link';
import { Camera, Image, Smartphone, Upload, Settings } from 'lucide-react';

export default function Sidebar({ activeSection, setActiveSection }) {
    const menuItems = [
        { id: 'challenge', label: 'Pose Challenge', icon: Camera },
        { id: 'gallery', label: 'Album Gallery', icon: Image },
        { id: 'bulk-upload', label: 'Regular Photos', icon: Upload },
        { id: 'access', label: 'App Access', icon: Smartphone }
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="logo">UNITED ALBUM</h1>
                <p className="tagline">Wedding Memories</p>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => (
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

            <div className="sidebar-footer">
                <Link href="/admin" className="admin-link">
                    <Settings size={14} />
                    <span>Admin</span>
                </Link>
            </div>
        </aside>
    );
}
