import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                // Prefer 192.168.x.x addresses which are typical for local networks
                if (iface.address.startsWith('192.168.')) {
                    localIP = iface.address;
                    break;
                }
                localIP = iface.address;
            }
        }
    }

    return NextResponse.json({ localIP });
}
