import { detectFace } from '../utils/faceDetection';

describe('Face Detection (Server-side fallback)', () => {
    it('should generate a hash-based face ID from buffer', async () => {
        const mockBuffer = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        const result = await detectFace(mockBuffer);

        // Should return a person ID (e.g., person_0, person_1, etc.)
        expect(result).toMatch(/^person_\d+$/);
        expect(result).toBeDefined();
    });

    it('should handle invalid/null buffers gracefully', async () => {
        const result = await detectFace(null);
        expect(result).toBe('unknown');
    });

    it('should handle empty buffers', async () => {
        const emptyBuffer = Buffer.alloc(0);
        const result = await detectFace(emptyBuffer);
        expect(result).toBe('unknown');
    });

    it('should generate consistent IDs for same buffer', async () => {
        const buffer1 = Buffer.from([1, 2, 3, 4, 5]);
        const buffer2 = Buffer.from([1, 2, 3, 4, 5]);

        const result1 = await detectFace(buffer1);
        const result2 = await detectFace(buffer2);

        // Same buffer should produce same hash
        expect(result1).toBe(result2);
    });
});
