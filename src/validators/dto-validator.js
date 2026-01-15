import { validate } from 'class-validator';
import { ValidationError } from '../errors/app-error.js';

/**
 * Validate a DTO instance
 * @param {Object} dto - DTO instance to validate
 * @returns {Promise<void>} Throws ValidationError if invalid
 */
export async function validateDto(dto) {
  const errors = await validate(dto);

  if (errors.length > 0) {
    const formattedErrors = errors.map((error) => ({
      property: error.property,
      constraints: error.constraints,
      value: error.value,
    }));

    const message =
      errors.length === 1
        ? Object.values(errors[0].constraints)[0]
        : 'Validation failed';

    throw new ValidationError(message, formattedErrors);
  }
}

/**
 * Validate and transform plain object to DTO
 * @param {Function} DtoClass - DTO class constructor
 * @param {Object} plainObject - Plain object to transform
 * @returns {Promise<Object>} Validated DTO instance
 */
export async function validateAndTransform(DtoClass, plainObject) {
  const dto = new DtoClass(plainObject);
  await validateDto(dto);
  return dto;
}

/**
 * Validate file upload
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @param {Array<string>} options.allowedTypes - Allowed MIME types
 * @param {number} options.maxSize - Maximum file size in bytes
 * @returns {void} Throws ValidationError if invalid
 */
export function validateFile(file, options = {}) {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    maxSize = 10 * 1024 * 1024, // 10MB default
  } = options;

  if (!file) {
    throw new ValidationError('File is required');
  }

  // Check file size
  if (file.size > maxSize) {
    throw new ValidationError(
      `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`
    );
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
}

/**
 * Validate file buffer with magic number check
 * @param {Buffer} buffer - File buffer
 * @param {string} declaredType - Declared MIME type
 * @returns {boolean} True if valid
 */
export function validateFileContent(buffer, declaredType) {
  const bytes = new Uint8Array(buffer.slice(0, 4));

  // JPEG magic number: FF D8 FF
  const isJPEG =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  // PNG magic number: 89 50 4E 47
  const isPNG =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  // WebP magic number: 52 49 46 46 (RIFF)
  const isWebP =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;

  // Verify actual content matches declared type
  if (declaredType === 'image/jpeg' && !isJPEG) {
    throw new ValidationError('File content does not match declared JPEG type');
  }
  if (declaredType === 'image/png' && !isPNG) {
    throw new ValidationError('File content does not match declared PNG type');
  }
  if (declaredType === 'image/webp' && !isWebP) {
    throw new ValidationError('File content does not match declared WebP type');
  }

  return true;
}
