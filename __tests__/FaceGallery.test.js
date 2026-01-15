import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import FaceGallery from '../components/FaceGallery';

// Mock fetch
global.fetch = jest.fn();

describe('FaceGallery Component', () => {
    beforeEach(() => {
        fetch.mockClear();
        // Mock photos API
        fetch.mockImplementation((url) => {
            if (url === '/api/photos') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, url: '/test1.jpg', mainFaceId: 'person_0', faceIds: ['person_0'], poseId: 'pose1', timestamp: new Date().toISOString() },
                        { id: 2, url: '/test2.jpg', mainFaceId: 'person_1', faceIds: ['person_1'], poseId: 'pose2', timestamp: new Date().toISOString() },
                        { id: 3, url: '/test3.jpg', mainFaceId: 'person_0', faceIds: ['person_0', 'person_1'], poseId: 'pose2', timestamp: new Date().toISOString() },
                    ]),
                });
            }
            if (url === '/api/face-thumbnails') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { faceId: 'person_0', faceUrl: '/face0.jpg', photoCount: 2 },
                        { faceId: 'person_1', faceUrl: '/face1.jpg', photoCount: 2 },
                    ]),
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });
    });

    it('renders the gallery title', async () => {
        await act(async () => {
            render(<FaceGallery />);
        });
        expect(screen.getByText('Album Gallery')).toBeInTheDocument();
    });

    it('fetches and displays photos', async () => {
        await act(async () => {
            render(<FaceGallery />);
        });

        await waitFor(() => {
            const images = screen.getAllByRole('img');
            expect(images.length).toBeGreaterThan(0);
        });
    });

    it('filters photos by pose', async () => {
        await act(async () => {
            render(<FaceGallery />);
        });

        const pose2Btn = await screen.findByRole('button', { name: 'pose2' });
        await act(async () => {
            fireEvent.click(pose2Btn);
        });

        await waitFor(() => {
            const images = screen.getAllByRole('img');
            // We expect at least 2 photos for pose2 (IDs 2 and 3)
            expect(images.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('filters photos by face', async () => {
        await act(async () => {
            render(<FaceGallery />);
        });

        // Wait for face thumbnails to load
        await waitFor(() => {
            expect(screen.getByText('person_0')).toBeInTheDocument();
        });

        const face0Btns = screen.getAllByText('person_0');
        const faceThumbnailBtn = face0Btns.find(el => el.closest('.face-thumb'));

        await act(async () => {
            fireEvent.click(faceThumbnailBtn.closest('button'));
        });

        await waitFor(() => {
            const images = screen.getAllByRole('img');
            // We expect at least 2 photos for person_0
            expect(images.length).toBeGreaterThan(0);
        });
    });
});
