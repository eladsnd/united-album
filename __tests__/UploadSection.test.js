import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadSection from '../components/UploadSection';

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
        },
        json: () => Promise.resolve({ success: true, driveLink: '/api/image/mock_id' }),
    })
);

// Mock FileReader and Image for compression
class MockFileReader {
    readAsDataURL() {
        setTimeout(() => {
            this.onload({ target: { result: 'data:image/png;base64,hello' } });
        }, 0);
    }
}
global.FileReader = MockFileReader;

global.Image = class {
    constructor() {
        setTimeout(() => {
            if (this.onload) this.onload();
        }, 0);
    }
    set src(val) { }
    get width() { return 100; }
    get height() { return 100; }
};

// Mock Canvas.toBlob
HTMLCanvasElement.prototype.toBlob = function (callback) {
    callback(new Blob(['hello'], { type: 'image/jpeg' }));
};

describe('UploadSection', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('renders upload button initially', () => {
        render(<UploadSection />);
        expect(screen.getByText('Upload your Challenge Photo')).toBeInTheDocument();
    });

    it('shows uploading status after file selection', async () => {
        render(<UploadSection />);
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Upload your Challenge Photo/i);

        fireEvent.change(input, { target: { files: [file] } });

        expect(screen.getByText(/Processing & Uploading.../i)).toBeInTheDocument();
    });

    it('shows success message after successful upload', async () => {
        render(<UploadSection />);
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Upload your Challenge Photo/i);

        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/Beautiful! Your photo is now in the album./i)).toBeInTheDocument();
        });
    });
});
