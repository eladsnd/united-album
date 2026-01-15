/**
 * Face Recognition Fixtures Test
 *
 * Validates test fixture files exist and are properly organized.
 * For actual face detection tests, see manual testing instructions in
 * __tests__/fixtures/face-recognition/README.md
 */

import path from 'path';
import fs from 'fs';

describe('Face Recognition Test Fixtures', () => {
    const FIXTURES_DIR = path.join(__dirname, 'fixtures/face-recognition');
    const GROUP_PHOTO = path.join(FIXTURES_DIR, 'group-photo-7-people.jpg');
    const INDIVIDUAL_FACES = Array.from({ length: 7 }, (_, i) =>
        path.join(FIXTURES_DIR, `person-${i + 1}-face.png`)
    );

    test('should have face-recognition fixtures directory', () => {
        expect(fs.existsSync(FIXTURES_DIR)).toBe(true);
        expect(fs.statSync(FIXTURES_DIR).isDirectory()).toBe(true);
    });

    test('should have group photo with 7 people', () => {
        expect(fs.existsSync(GROUP_PHOTO)).toBe(true);
        const stats = fs.statSync(GROUP_PHOTO);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);
        console.log(`✓ Group photo: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    });

    test('should have all 7 individual face crops', () => {
        INDIVIDUAL_FACES.forEach((facePath, i) => {
            expect(fs.existsSync(facePath)).toBe(true);
            const stats = fs.statSync(facePath);
            expect(stats.isFile()).toBe(true);
            expect(stats.size).toBeGreaterThan(0);
            console.log(`✓ person-${i + 1}-face.png: ${(stats.size / 1024).toFixed(0)} KB`);
        });
    });

    test('should have README with testing instructions', () => {
        const readmePath = path.join(FIXTURES_DIR, 'README.md');
        expect(fs.existsSync(readmePath)).toBe(true);
        const content = fs.readFileSync(readmePath, 'utf8');
        expect(content).toContain('Face Recognition Test Fixtures');
        expect(content).toContain('Manual Browser Testing');
    });
});
