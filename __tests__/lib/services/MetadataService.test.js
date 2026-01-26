/**
 * MetadataService Tests
 *
 * Tests EXIF metadata extraction from image buffers.
 */

import { MetadataService } from '../../../lib/services/MetadataService.js';
import sharp from 'sharp';

// Mock sharp library
jest.mock('sharp');

describe('MetadataService', () => {
  let metadataService;

  beforeEach(() => {
    metadataService = new MetadataService();
    jest.clearAllMocks();
  });

  describe('extractMetadata()', () => {
    it('should extract EXIF metadata with all fields present', async () => {
      const mockMetadata = {
        exif: {
          DateTimeOriginal: Buffer.from('2024:06:15 14:30:45'),
          Make: 'Apple',
          Model: 'iPhone 13'
        }
      };

      const mockImage = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      sharp.mockReturnValue(mockImage);

      const buffer = Buffer.from('fake-image-data');
      const result = await metadataService.extractMetadata(buffer);

      expect(result.capturedAt).toBeInstanceOf(Date);
      // Check the date components rather than exact ISO string (timezone-independent)
      expect(result.capturedAt?.getFullYear()).toBe(2024);
      expect(result.capturedAt?.getMonth()).toBe(5); // June (0-indexed)
      expect(result.capturedAt?.getDate()).toBe(15);
      expect(result.capturedAt?.getHours()).toBe(14);
      expect(result.capturedAt?.getMinutes()).toBe(30);
      expect(result.capturedAt?.getSeconds()).toBe(45);
      expect(result.deviceMake).toBe('Apple');
      expect(result.deviceModel).toBe('iPhone 13');
    });

    it('should handle missing EXIF data gracefully', async () => {
      const mockMetadata = {
        exif: {}
      };

      const mockImage = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      sharp.mockReturnValue(mockImage);

      const buffer = Buffer.from('fake-image-data');
      const result = await metadataService.extractMetadata(buffer);

      expect(result.capturedAt).toBeNull();
      expect(result.deviceMake).toBeNull();
      expect(result.deviceModel).toBeNull();
    });

    it('should handle missing exif object', async () => {
      const mockMetadata = {};

      const mockImage = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      sharp.mockReturnValue(mockImage);

      const buffer = Buffer.from('fake-image-data');
      const result = await metadataService.extractMetadata(buffer);

      expect(result.capturedAt).toBeNull();
      expect(result.deviceMake).toBeNull();
      expect(result.deviceModel).toBeNull();
    });

    it('should handle partial EXIF data (only device info)', async () => {
      const mockMetadata = {
        exif: {
          Make: 'Samsung',
          Model: 'Galaxy S21'
        }
      };

      const mockImage = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      sharp.mockReturnValue(mockImage);

      const buffer = Buffer.from('fake-image-data');
      const result = await metadataService.extractMetadata(buffer);

      expect(result.capturedAt).toBeNull();
      expect(result.deviceMake).toBe('Samsung');
      expect(result.deviceModel).toBe('Galaxy S21');
    });

    it('should handle partial EXIF data (only date)', async () => {
      const mockMetadata = {
        exif: {
          DateTimeOriginal: Buffer.from('2024:12:25 09:15:30')
        }
      };

      const mockImage = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      sharp.mockReturnValue(mockImage);

      const buffer = Buffer.from('fake-image-data');
      const result = await metadataService.extractMetadata(buffer);

      expect(result.capturedAt).toBeInstanceOf(Date);
      expect(result.capturedAt?.getFullYear()).toBe(2024);
      expect(result.capturedAt?.getMonth()).toBe(11); // December (0-indexed)
      expect(result.capturedAt?.getDate()).toBe(25);
      expect(result.capturedAt?.getHours()).toBe(9);
      expect(result.capturedAt?.getMinutes()).toBe(15);
      expect(result.capturedAt?.getSeconds()).toBe(30);
      expect(result.deviceMake).toBeNull();
      expect(result.deviceModel).toBeNull();
    });

    it('should return null values on sharp error', async () => {
      const mockImage = {
        metadata: jest.fn().mockRejectedValue(new Error('Invalid image'))
      };
      sharp.mockReturnValue(mockImage);

      const buffer = Buffer.from('invalid-data');
      const result = await metadataService.extractMetadata(buffer);

      expect(result.capturedAt).toBeNull();
      expect(result.deviceMake).toBeNull();
      expect(result.deviceModel).toBeNull();
    });
  });

  describe('parseExifDateTime()', () => {
    it('should parse valid EXIF datetime string', () => {
      const exifDate = '2024:06:15 14:30:45';
      const result = metadataService.parseExifDateTime(exifDate);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5); // June (0-indexed)
      expect(result?.getDate()).toBe(15);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
      expect(result?.getSeconds()).toBe(45);
    });

    it('should parse EXIF datetime from Buffer', () => {
      const exifDate = Buffer.from('2024:06:15 14:30:45');
      const result = metadataService.parseExifDateTime(exifDate);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(15);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
      expect(result?.getSeconds()).toBe(45);
    });

    it('should handle various valid datetime formats', () => {
      const testCases = [
        { input: '2024:01:01 00:00:00', year: 2024, month: 0, date: 1, hours: 0, minutes: 0, seconds: 0 },
        { input: '2024:12:31 23:59:59', year: 2024, month: 11, date: 31, hours: 23, minutes: 59, seconds: 59 },
        { input: '2023:07:04 12:00:00', year: 2023, month: 6, date: 4, hours: 12, minutes: 0, seconds: 0 },
      ];

      testCases.forEach(({ input, year, month, date, hours, minutes, seconds }) => {
        const result = metadataService.parseExifDateTime(input);
        expect(result?.getFullYear()).toBe(year);
        expect(result?.getMonth()).toBe(month);
        expect(result?.getDate()).toBe(date);
        expect(result?.getHours()).toBe(hours);
        expect(result?.getMinutes()).toBe(minutes);
        expect(result?.getSeconds()).toBe(seconds);
      });
    });

    it('should return null for invalid format', () => {
      const invalidDates = [
        'invalid',
        '2024-06-15 14:30:45', // Wrong separator
        '15/06/2024 14:30:45', // Wrong format
        '2024:06:15', // Missing time
        '',
        null,
        undefined,
      ];

      invalidDates.forEach(invalidDate => {
        const result = metadataService.parseExifDateTime(invalidDate);
        expect(result).toBeNull();
      });
    });

    it('should return null for invalid date values', () => {
      const invalidValues = [
        '2024:13:01 12:00:00', // Invalid month
        '2024:06:32 12:00:00', // Invalid day
        '2024:06:15 25:00:00', // Invalid hour
        '2024:06:15 12:60:00', // Invalid minute
        '2024:06:15 12:00:60', // Invalid second
      ];

      invalidValues.forEach(invalidValue => {
        const result = metadataService.parseExifDateTime(invalidValue);
        expect(result).toBeNull();
      });
    });

    it('should handle Buffer with extra whitespace', () => {
      const exifDate = Buffer.from('  2024:06:15 14:30:45  ');
      const result = metadataService.parseExifDateTime(exifDate);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(15);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
      expect(result?.getSeconds()).toBe(45);
    });

    it('should return null for non-string, non-Buffer input', () => {
      const invalidInputs = [123, {}, [], true];

      invalidInputs.forEach(input => {
        const result = metadataService.parseExifDateTime(input);
        expect(result).toBeNull();
      });
    });
  });
});
