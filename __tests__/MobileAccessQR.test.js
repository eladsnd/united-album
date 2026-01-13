import { render, screen, waitFor, act } from '@testing-library/react';
import MobileAccessQR from '../components/MobileAccessQR';
import QRCode from 'qrcode';

// Mock QRCode
jest.mock('qrcode', () => ({
    toCanvas: jest.fn((canvas, url, options, callback) => callback(null))
}));

// Mock fetch
global.fetch = jest.fn();

describe('MobileAccessQR Component', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        fetch.mockClear();
        QRCode.toCanvas.mockClear();

        // Safe JSDOM mock
        delete window.location;
        window.location = new URL('http://localhost:3000');
    });

    afterAll(() => {
        window.location = originalLocation;
    });

    it('renders the component title', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ localIP: '192.168.1.100' }),
        });

        await act(async () => {
            render(<MobileAccessQR />);
        });
        expect(screen.getByText('Access on Mobile')).toBeInTheDocument();
    });

    it('fetches local IP and generates QR code with correct URL', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ localIP: '192.168.1.100' }),
        });

        await act(async () => {
            render(<MobileAccessQR />);
        });

        await waitFor(() => {
            expect(QRCode.toCanvas).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                'http://192.168.1.100:3000',
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    it('falls back to current URL if IP fetch fails', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        // Bypassing JSDOM limitation
        delete window.location;
        window.location = new URL('http://localhost:3000/fallback');

        await act(async () => {
            render(<MobileAccessQR />);
        });

        await waitFor(() => {
            expect(QRCode.toCanvas).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                // URL objects in JSDOM should return the full href
                expect.stringContaining('/fallback'),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });
});
