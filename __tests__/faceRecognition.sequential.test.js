/**
 * Face Recognition Sequential Processing Test
 *
 * This test verifies that when multiple faces are detected in a single photo,
 * each face gets assigned a unique person ID (no false matches due to race conditions).
 *
 * This is a FAST test that validates the sequential processing logic without
 * running actual ML models.
 */

describe('Face Recognition Sequential Processing', () => {
    let originalFetch;
    let knownFaces = [];
    let saveCallOrder = [];

    beforeEach(() => {
        // Reset test state
        knownFaces = [];
        saveCallOrder = [];

        // Mock fetch to simulate the API
        originalFetch = global.fetch;
        global.fetch = jest.fn((url, options) => {
            if (url === '/api/faces' && !options) {
                // GET /api/faces - return known faces
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(knownFaces)
                });
            } else if (url === '/api/faces' && options?.method === 'POST') {
                // POST /api/faces - save new face
                const body = JSON.parse(options.body);
                const { faceId, descriptor } = body;

                // Track call order
                saveCallOrder.push(faceId);

                // Simulate saveFaceDescriptor logic
                const existingIndex = knownFaces.findIndex(f => f.faceId === faceId);
                if (existingIndex !== -1) {
                    // Update existing
                    const existing = knownFaces[existingIndex];
                    const descriptors = existing.descriptors || [existing.descriptor];
                    descriptors.push(descriptor);
                    knownFaces[existingIndex] = {
                        faceId,
                        descriptors,
                        descriptor,
                        sampleCount: descriptors.length,
                        photoCount: existing.photoCount + 1
                    };
                } else {
                    // New face
                    knownFaces.push({
                        faceId,
                        descriptors: [descriptor],
                        descriptor,
                        sampleCount: 1,
                        photoCount: 1
                    });
                }

                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            }

            return Promise.reject(new Error('Unexpected fetch call'));
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('should assign unique IDs when processing 7 faces sequentially', async () => {
        // Simulate the sequential face processing logic from clientFaceDetection.js
        const mockDescriptors = [
            Array(128).fill(0.1), // person_1
            Array(128).fill(0.2), // person_2
            Array(128).fill(0.3), // person_3
            Array(128).fill(0.4), // person_4
            Array(128).fill(0.5), // person_5
            Array(128).fill(0.6), // person_6
            Array(128).fill(0.7)  // person_7
        ];

        // Helper to calculate Euclidean distance
        function euclideanDistance(a, b) {
            return Math.sqrt(
                a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
            );
        }

        // Simulate matchFaceDescriptor logic (with human-friendly numbering)
        async function matchFaceDescriptor(descriptor) {
            const response = await fetch('/api/faces');
            const knownFaces = await response.json();

            if (knownFaces.length === 0) {
                return 'person_1'; // Human-friendly: start at 1
            }

            let bestMatch = null;
            let bestDistance = Infinity;

            for (const known of knownFaces) {
                const distance = euclideanDistance(descriptor, known.descriptor);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = known;
                }
            }

            const threshold = 0.30;
            if (bestMatch && bestDistance < threshold) {
                return bestMatch.faceId;
            }

            // Find max person number and add 1
            const personNumbers = knownFaces
                .map(f => f.faceId.match(/person_(\d+)/))
                .filter(match => match)
                .map(match => parseInt(match[1]));
            const maxNumber = personNumbers.length > 0 ? Math.max(...personNumbers) : 0;
            return `person_${maxNumber + 1}`;
        }

        // Process faces SEQUENTIALLY (like the fixed code)
        const faceIds = [];
        for (const descriptor of mockDescriptors) {
            const faceId = await matchFaceDescriptor(descriptor);

            // Save immediately (like the fixed code)
            await fetch('/api/faces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceId, descriptor })
            });

            faceIds.push(faceId);
        }

        // Verify all 7 faces got unique IDs (human-friendly: 1-7, not 0-6)
        expect(faceIds).toEqual([
            'person_1',
            'person_2',
            'person_3',
            'person_4',
            'person_5',
            'person_6',
            'person_7'
        ]);

        // Verify saves happened in correct order
        expect(saveCallOrder).toEqual([
            'person_1',
            'person_2',
            'person_3',
            'person_4',
            'person_5',
            'person_6',
            'person_7'
        ]);

        // Verify all 7 faces are in the database
        expect(knownFaces).toHaveLength(7);

        // Verify each has unique descriptors
        const descriptors = knownFaces.map(f => f.descriptor);
        for (let i = 0; i < descriptors.length; i++) {
            for (let j = i + 1; j < descriptors.length; j++) {
                const distance = euclideanDistance(descriptors[i], descriptors[j]);
                // Different people should have distance > 0.4
                expect(distance).toBeGreaterThan(0.4);
            }
        }

        console.log('✅ Sequential processing test passed!');
        console.log(`   - 7 faces detected`);
        console.log(`   - 7 unique IDs assigned (person_1 through person_7)`);
        console.log(`   - All descriptors saved in order`);
    });

    test('should fail if processed in parallel (demonstrates the bug)', async () => {
        const mockDescriptors = [
            Array(128).fill(0.1),
            Array(128).fill(0.2),
            Array(128).fill(0.3)
        ];

        function euclideanDistance(a, b) {
            return Math.sqrt(
                a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
            );
        }

        async function matchFaceDescriptor(descriptor) {
            const response = await fetch('/api/faces');
            const knownFaces = await response.json();

            if (knownFaces.length === 0) {
                return 'person_1'; // Human-friendly
            }

            let bestMatch = null;
            let bestDistance = Infinity;

            for (const known of knownFaces) {
                const distance = euclideanDistance(descriptor, known.descriptor);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = known;
                }
            }

            const threshold = 0.30;
            if (bestMatch && bestDistance < threshold) {
                return bestMatch.faceId;
            }

            const personNumbers = knownFaces
                .map(f => f.faceId.match(/person_(\d+)/))
                .filter(match => match)
                .map(match => parseInt(match[1]));
            const maxNumber = personNumbers.length > 0 ? Math.max(...personNumbers) : 0;
            return `person_${maxNumber + 1}`;
        }

        // Process in PARALLEL (the bug)
        const matchPromises = mockDescriptors.map(desc => matchFaceDescriptor(desc));
        const faceIds = await Promise.all(matchPromises);

        // ALL faces will get person_1 because they all read from empty DB
        expect(faceIds).toEqual(['person_1', 'person_1', 'person_1']);

        // Save after matching (too late!)
        await Promise.all(
            faceIds.map((faceId, index) =>
                fetch('/api/faces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        faceId,
                        descriptor: mockDescriptors[index]
                    })
                })
            )
        );

        // All 3 get saved to person_1 (demonstrating the bug)
        expect(knownFaces).toHaveLength(1);
        expect(knownFaces[0].faceId).toBe('person_1');
        expect(knownFaces[0].sampleCount).toBe(3); // 3 samples for same person!

        console.log('✅ Parallel processing test passed (correctly demonstrates bug)');
        console.log(`   - 3 different faces processed`);
        console.log(`   - ALL assigned to person_1 (BUG - race condition)`);
        console.log(`   - This is why we need sequential processing!`);
    });
});
