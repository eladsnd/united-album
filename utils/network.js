import os from 'os';

export function getLocalIP() {
    // Priority 1: Environment override
    if (process.env.NEXT_PUBLIC_LOCAL_IP) {
        return process.env.NEXT_PUBLIC_LOCAL_IP;
    }

    const interfaces = os.networkInterfaces();
    let backupIP = 'localhost';

    for (const name of Object.keys(interfaces)) {
        // Skip common virtual interface names
        if (name.toLowerCase().includes('virtualbox') || name.toLowerCase().includes('vmmnet') || name.toLowerCase().includes('wsl')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // Ignore specific VirtualBox/Host-Only ranges if they snuck through
                if (iface.address.startsWith('192.168.56.')) continue;

                // Priority 2: Common home network ranges
                if (iface.address.startsWith('192.168.1.') || iface.address.startsWith('192.168.0.')) {
                    return iface.address;
                }
                backupIP = iface.address;
            }
        }
    }
    return backupIP;
}
