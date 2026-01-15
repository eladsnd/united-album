import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for creating/updating pose challenges
 */
export class CreatePoseDto {
  /**
   * Pose title
   */
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  title;

  /**
   * Pose instruction text
   */
  @IsNotEmpty({ message: 'Instruction is required' })
  @IsString()
  instruction;

  /**
   * Google Drive folder ID for this pose
   */
  @IsOptional()
  @IsString()
  driveFolderId;

  /**
   * Image file for pose (validated separately)
   */
  image;

  constructor(data) {
    Object.assign(this, data);
  }
}

/**
 * DTO for updating existing pose
 */
export class UpdatePoseDto {
  /**
   * Pose ID to update
   */
  @IsNotEmpty({ message: 'Pose ID is required' })
  @IsString()
  id;

  /**
   * Updated title (optional)
   */
  @IsOptional()
  @IsString()
  title;

  /**
   * Updated instruction (optional)
   */
  @IsOptional()
  @IsString()
  instruction;

  /**
   * Updated Drive folder ID (optional)
   */
  @IsOptional()
  @IsString()
  driveFolderId;

  /**
   * Updated image file (optional)
   */
  @IsOptional()
  image;

  constructor(data) {
    Object.assign(this, data);
  }
}

/**
 * DTO for deleting pose
 */
export class DeletePoseDto {
  /**
   * Pose ID to delete
   */
  @IsNotEmpty({ message: 'Pose ID is required' })
  @IsString()
  id;

  constructor(data) {
    Object.assign(this, data);
  }
}
