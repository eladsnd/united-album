import { getLocalIP } from '../utils/network';
import os from 'os';

jest.mock('os');

describe('getLocalIP', () => {
    it('returns local IP address', () => {
        os.networkInterfaces.mockReturnValue({
            en0: [
                { family: 'IPv4', internal: false, address: '192.168.1.100' }
            ]
        });

        expect(getLocalIP()).toBe('192.168.1.100');
    });

    it('defaults to localhost if no external IPv4 found', () => {
        os.networkInterfaces.mockReturnValue({
            lo0: [
                { family: 'IPv4', internal: true, address: '127.0.0.1' }
            ]
        });

        expect(getLocalIP()).toBe('localhost');
    });
});
