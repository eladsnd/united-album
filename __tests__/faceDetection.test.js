import { detectFace } from '../utils/faceDetection';

describe('Face Detection Initialization', () => {
    it('should initialize and return a face ID without crashing', async () => {
        // We use an empty buffer, which should trigger a mock or 'unknown'
        // depending on whether models load in the test environment
        const mockBuffer = Buffer.alloc(10);

        try {
            const result = await detectFace(mockBuffer);
            console.log('[Test] detectFace result:', result);
            expect(result).toBeDefined();
        } catch (error) {
            console.error('[Test] detectFace crashed:', error);
            throw error;
        }
    });

    it('should handle invalid buffers gracefully', async () => {
        const result = await detectFace(null);
        expect(result).toBe('unknown');
    });
});
