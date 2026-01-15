"use client";
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'info', duration = 5000, onClose }) {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => {
                setIsVisible(false);
                onClose?.();
            }, 300); // Match CSS transition duration
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose?.();
        }, 300);
    };

    if (!isVisible) return null;

    const icons = {
        success: <CheckCircle size={20} />,
        error: <XCircle size={20} />,
        warning: <AlertCircle size={20} />,
        info: <AlertCircle size={20} />
    };

    return (
        <div className={`toast toast-${type} ${isExiting ? 'toast-exit' : ''}`}>
            <div className="toast-icon">
                {icons[type]}
            </div>
            <div className="toast-message">
                {message}
            </div>
            <button className="toast-close" onClick={handleClose} aria-label="Close notification">
                <X size={16} />
            </button>
        </div>
    );
}
