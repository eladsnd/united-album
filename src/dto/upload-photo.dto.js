import { IsString, IsOptional, IsNotEmpty, ValidateIf } from 'class-validator';

/**
 * Data Transfer Object for photo upload
 * Validates upload request data
 */
export class UploadPhotoDto {
  /**
   * Image file to upload
   * Validated separately as File type
   */
  file;

  /**
   * Pose challenge ID (optional)
   */
  @IsOptional()
  @IsString()
  poseId;

  /**
   * Google Drive folder ID (optional, uses default if not provided)
   */
  @IsOptional()
  @IsString()
  folderId;

  /**
   * Uploader session ID (required)
   */
  @IsNotEmpty({ message: 'Uploader ID is required' })
  @IsString()
  uploaderId;

  constructor(data) {
    Object.assign(this, data);
  }
}

/**
 * DTO for updating photo with face detection results
 */
export class UpdatePhotoFacesDto {
  /**
   * Array of face IDs detected in photo
   */
  @IsNotEmpty({ message: 'Face IDs array is required' })
  faceIds;

  /**
   * Primary/largest face ID
   */
  @IsNotEmpty({ message: 'Main face ID is required' })
  @IsString()
  mainFaceId;

  /**
   * Bounding boxes for each face
   */
  @IsNotEmpty({ message: 'Face boxes array is required' })
  faceBoxes;

  /**
   * Face thumbnails (optional)
   */
  @IsOptional()
  faceThumbnails;

  constructor(data) {
    Object.assign(this, data);
  }
}

/**
 * DTO for photo deletion
 */
export class DeletePhotoDto {
  /**
   * Photo ID to delete
   */
  @IsNotEmpty({ message: 'Photo ID is required' })
  photoId;

  /**
   * Requester's uploader ID (optional if admin)
   */
  @IsOptional()
  @IsString()
  uploaderId;

  /**
   * Whether requester is admin
   */
  @IsOptional()
  isAdmin;

  constructor(data) {
    Object.assign(this, data);
  }
}

/**
 * DTO for photo query filters
 */
export class PhotoFilterDto {
  /**
   * Filter by face ID
   */
  @IsOptional()
  @IsString()
  faceId;

  /**
   * Filter by pose ID
   */
  @IsOptional()
  @IsString()
  poseId;

  /**
   * Filter by uploader ID
   */
  @IsOptional()
  @IsString()
  uploaderId;

  constructor(data) {
    Object.assign(this, data || {});
  }
}
