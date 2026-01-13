import { getPhotos, savePhoto } from '../utils/photos';
import fs from 'fs';

jest.mock('fs');

describe('photos utility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPhotos', () => {
        it('returns empty array if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            expect(getPhotos()).toEqual([]);
        });

        it('returns parsed photos from file', () => {
            const mockPhotos = [{ id: 1 }];
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockPhotos));
            expect(getPhotos()).toEqual(mockPhotos);
        });
    });

    describe('savePhoto', () => {
        it('appends photo and writes to file', () => {
            const existingPhotos = [{ id: 1 }];
            const newPhoto = { id: 2 };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(existingPhotos));
            fs.writeFileSync = jest.fn();

            savePhoto(newPhoto);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"id": 2')
            );
        });
    });
});
