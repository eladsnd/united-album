import { getPhotos, savePhoto } from '../lib/photoStorage';
import fs from 'fs';

jest.mock('fs');

describe('photoStorage module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPhotos', () => {
        it('returns empty array if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            expect(getPhotos()).toEqual([]);
        });

        it('returns parsed photos from file', () => {
            const mockPhotos = [{ id: 1, driveId: 'drive1' }];
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockPhotos));
            expect(getPhotos()).toEqual(mockPhotos);
        });
    });

    describe('savePhoto', () => {
        it('saves new photo with deduplication by driveId', () => {
            const existingPhotos = [{ id: 1, driveId: 'drive1' }];
            const newPhoto = { id: 2, driveId: 'drive2', mainFaceId: 'person_0', faceIds: ['person_0'] };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(existingPhotos));
            fs.writeFileSync = jest.fn();

            savePhoto(newPhoto);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"driveId": "drive2"')
            );
        });

        it('updates existing photo if driveId already exists', () => {
            const existingPhotos = [{ id: 1, driveId: 'drive1', mainFaceId: 'person_0' }];
            const updatedPhoto = { id: 1, driveId: 'drive1', mainFaceId: 'person_1' };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(existingPhotos));
            fs.writeFileSync = jest.fn();

            savePhoto(updatedPhoto);

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData[0].mainFaceId).toBe('person_1');
        });
    });
});
