"use client";
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function MobileAccessQR() {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            // In a real scenario, this would be the local network IP or public URL
            const url = window.location.href;
            QRCode.toCanvas(canvasRef.current, url, {
                width: 150,
                margin: 2,
                color: {
                    dark: '#2c3e50',
                    light: '#ffffff'
                }
            }, (error) => {
                if (error) console.error(error);
            });
        }
    }, []);

    return (
        <div className="qr-container card" style={{ maxWidth: '300px', margin: '2rem auto', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '400', marginBottom: '1rem' }}>Access on Mobile</h3>
            <canvas ref={canvasRef}></canvas>
            <p style={{ fontSize: '0.8rem', marginTop: '1rem', opacity: 0.7 }}>
                Scan to take the challenge from your phone camera!
            </p>
        </div>
    );
}
