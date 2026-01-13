import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AlbumGallery from '../components/FaceGallery';

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
            { id: 1, url: '/test1.jpg', faceId: 'face1', poseId: 'pose1', timestamp: new Date().toISOString() },
            { id: 2, url: '/test2.jpg', faceId: 'face2', poseId: 'pose2', timestamp: new Date().toISOString() },
            { id: 3, url: '/test3.jpg', faceId: 'face1', poseId: 'pose2', timestamp: new Date().toISOString() },
        ]),
    })
);

describe('AlbumGallery Component', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('renders the gallery title', async () => {
        await act(async () => {
            render(<AlbumGallery />);
        });
        expect(screen.getByText('Album Gallery')).toBeInTheDocument();
    });

    it('fetches and displays photos', async () => {
        await act(async () => {
            render(<AlbumGallery />);
        });

        await waitFor(() => {
            const images = screen.getAllByRole('img');
            expect(images.length).toBeGreaterThanOrEqual(3);
        });
    });

    it('filters photos by pose', async () => {
        await act(async () => {
            render(<AlbumGallery />);
        });

        const pose2Btn = await screen.findByRole('button', { name: 'pose2' });
        await act(async () => {
            fireEvent.click(pose2Btn);
        });

        await waitFor(() => {
            const images = screen.getAllByRole('img');
            // We expect 2 photos for pose2
            expect(images).toHaveLength(2);
        });
    });

    it('filters photos by face', async () => {
        await act(async () => {
            render(<AlbumGallery />);
        });

        const face1Btn = await screen.findByRole('button', { name: 'face1' });
        await act(async () => {
            fireEvent.click(face1Btn);
        });

        await waitFor(() => {
            const images = screen.getAllByRole('img');
            // We expect 2 photos for face1
            expect(images).toHaveLength(2);
        });
    });
});
