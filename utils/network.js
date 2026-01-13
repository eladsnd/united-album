import os from 'os';

export function getLocalIP() {
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('192.168.')) {
                    return iface.address;
                }
                localIP = iface.address;
            }
        }
    }
    return localIP;
}
