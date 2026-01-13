import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadSection from '../components/UploadSection';

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
    })
);

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

        expect(screen.getByText(/Analyzing faces & uploading to Drive.../i)).toBeInTheDocument();
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
