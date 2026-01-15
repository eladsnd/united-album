"use client";
import { Camera, Image, Smartphone, User, Settings } from 'lucide-react';
import Link from 'next/link';

export default function Sidebar({ activeSection, setActiveSection }) {
    const menuItems = [
        { id: 'challenge', label: 'Pose Challenge', icon: Camera },
        { id: 'gallery', label: 'Album Gallery', icon: Image },
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
                <div className="wedding-info">
                    <User size={16} />
                    <span>United Wedding 2026</span>
                </div>
                <Link href="/admin" className="admin-link">
                    <Settings size={14} />
                    <span>Admin</span>
                </Link>
            </div>
        </aside>
    );
}
