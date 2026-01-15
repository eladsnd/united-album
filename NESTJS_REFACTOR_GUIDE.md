# NestJS-Style Refactoring Guide

This document explains the NestJS-inspired architecture implemented in the United Album codebase.

## Architecture Overview

The application now follows NestJS design patterns while maintaining Next.js as the frontend framework:

```
/src
  /services       - Business logic layer (like NestJS services)
  /repositories   - Data access layer (Repository pattern)
  /dto            - Data Transfer Objects with validation
  /validators     - Validation utilities
  /guards         - Authentication/authorization
  /interceptors   - Request/response middleware
  /errors         - Custom error classes
  container.js    - Dependency injection container
  bootstrap.js    - Service initialization
```

## Key Patterns

### 1. Service Layer Pattern

Services contain business logic and are injected with dependencies:

```javascript
// src/services/photo.service.js
@Injectable()
export class PhotoService {
  constructor(driveService, photoRepository, faceService) {
    this.driveService = driveService;
    this.photoRepository = photoRepository;
    this.faceService = faceService;
  }

  async uploadPhoto(uploadDto) {
    // Business logic here
  }
}
```

### 2. Repository Pattern

Repositories abstract data access and provide a clean API:

```javascript
// src/repositories/photo.repository.js
export class PhotoRepository extends BaseRepository {
  async findByDriveId(driveId) {
    return this.findOne((photo) => photo.driveId === driveId);
  }
}
```

**Base Repository Methods:**
- `findAll()` - Get all entities
- `findById(id)` - Find by ID
- `findWhere(predicate)` - Filter entities
- `save(entity)` - Create or update
- `update(id, updates)` - Update by ID
- `delete(id)` - Delete by ID
- `count(predicate)` - Count entities

### 3. Dependency Injection

Services are registered in a container and automatically resolved:

```javascript
// src/bootstrap.js
import { container } from './container.js';

export function bootstrapServices() {
  // Register PhotoService with dependencies
  container.register('PhotoService', (c) => {
    const driveService = c.get('DriveService');
    const photoRepository = c.get('PhotoRepository');
    const faceService = c.get('FaceService');
    return new PhotoService(driveService, photoRepository, faceService);
  });
}

// Get service instance
const photoService = container.get('PhotoService');
```

### 4. DTOs with Validation

DTOs define the shape of data and include validation rules:

```javascript
// src/dto/upload-photo.dto.js
export class UploadPhotoDto {
  @IsNotEmpty({ message: 'Uploader ID is required' })
  @IsString()
  uploaderId;

  @IsOptional()
  @IsString()
  poseId;
}

// Usage in API route
import { validateAndTransform } from '@/src/validators/dto-validator';

const dto = await validateAndTransform(UploadPhotoDto, {
  uploaderId: formData.get('uploaderId'),
  poseId: formData.get('poseId'),
});
```

### 5. Error Handling

Custom error classes with consistent structure:

```javascript
// src/errors/app-error.js
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

// Usage
throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
throw new ValidationError('Invalid input', errors);
throw new UnauthorizedError('Admin token required');
```

### 6. Guards

Guards handle authentication and authorization:

```javascript
// src/guards/admin.guard.js
export class AdminGuard {
  static async canActivate(request) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !verifyAdminToken(token)) {
      throw new UnauthorizedError('Invalid admin token');
    }
    return true;
  }
}

// Usage in API route
await AdminGuard.canActivate(request);
```

### 7. Interceptors

Interceptors wrap route handlers for cross-cutting concerns:

```javascript
// Error handling interceptor
import { withErrorHandler } from '@/src/interceptors/error.interceptor';

export const POST = withErrorHandler(async (request) => {
  // Your route logic here
  // Errors are automatically caught and formatted
});

// Logging interceptor
import { withLogging } from '@/src/interceptors/logging.interceptor';

export const GET = withLogging(async (request) => {
  // Requests and responses are automatically logged
});
```

## Example: Refactored API Route

### Before (Old Style)

```javascript
// app/api/upload/route.js (old)
import { uploadToDrive } from '@/lib/googleDrive';
import { getPhotos, savePhoto } from '@/lib/photoStorage';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    // Upload to Drive
    const driveFile = await uploadToDrive(/* ... */);

    // Save to photos.json
    const photos = getPhotos();
    photos.push({ driveId: driveFile.id, /* ... */ });
    savePhoto(photos);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### After (NestJS Style)

```javascript
// app/api/upload/route.js (new)
import { getPhotoService } from '@/src/bootstrap';
import { withErrorHandler } from '@/src/interceptors/error.interceptor';
import { withLogging } from '@/src/interceptors/logging.interceptor';
import { validateAndTransform } from '@/src/validators/dto-validator';
import { UploadPhotoDto } from '@/src/dto/upload-photo.dto';

async function uploadHandler(request) {
  const formData = await request.formData();

  // Validate DTO
  const dto = await validateAndTransform(UploadPhotoDto, {
    file: formData.get('file'),
    poseId: formData.get('poseId'),
    uploaderId: formData.get('uploaderId'),
  });

  // Use service (handles all business logic)
  const photoService = getPhotoService();
  const photo = await photoService.uploadPhoto(dto);

  return NextResponse.json({ success: true, photo });
}

// Export with interceptors
export const POST = withLogging(withErrorHandler(uploadHandler));
```

## Benefits of This Architecture

### 1. **Separation of Concerns**
- Services: Business logic
- Repositories: Data access
- Controllers (API routes): Request/response handling
- DTOs: Data validation
- Guards: Authentication
- Interceptors: Cross-cutting concerns

### 2. **Testability**
```javascript
// Easy to test services with mocks
const mockDriveService = { uploadFile: jest.fn() };
const mockPhotoRepo = { save: jest.fn() };
const photoService = new PhotoService(mockDriveService, mockPhotoRepo, null);
```

### 3. **Reusability**
Services can be used across multiple API routes:
```javascript
const photoService = getPhotoService();
await photoService.uploadPhoto(dto);  // In /api/upload
await photoService.deletePhoto(id);   // In /api/delete-photo
```

### 4. **Type Safety** (with JSDoc or TypeScript)
```javascript
/**
 * Upload a photo
 * @param {UploadPhotoDto} uploadDto - Upload data
 * @returns {Promise<Photo>} Uploaded photo
 */
async uploadPhoto(uploadDto) { /* ... */ }
```

### 5. **Consistent Error Handling**
All errors follow the same structure:
```json
{
  "error": "Photo not found",
  "code": "PHOTO_NOT_FOUND",
  "statusCode": 404,
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

## Migration Checklist

### ✅ Completed
1. Created service layer (PhotoService, FaceService, DriveService)
2. Implemented repository pattern (BaseRepository, PhotoRepository, FaceRepository)
3. Built dependency injection container
4. Added DTOs with class-validator
5. Created error handling infrastructure
6. Implemented guards (AdminGuard)
7. Built interceptors (ErrorInterceptor, LoggingInterceptor)

### ⏳ Next Steps
1. Refactor existing lib modules to use new services
2. Update all API routes to use services and interceptors
3. Add comprehensive tests for services
4. Add rate limiting interceptor
5. Document all services and DTOs

## How to Use in New Code

### Creating a New API Route

```javascript
import { getPhotoService } from '@/src/bootstrap';
import { withErrorHandler } from '@/src/interceptors/error.interceptor';
import { NextResponse } from 'next/server';

async function handler(request) {
  const photoService = getPhotoService();
  const photos = await photoService.getPhotos({ faceId: 'person_1' });
  return NextResponse.json(photos);
}

export const GET = withErrorHandler(handler);
```

### Creating a New Service

```javascript
import { Injectable } from '@nestjs/common';

@Injectable()
export class MyService {
  constructor(dependency1, dependency2) {
    this.dependency1 = dependency1;
    this.dependency2 = dependency2;
  }

  async myMethod() {
    // Business logic here
  }
}

// Register in bootstrap.js
container.register('MyService', (c) => {
  return new MyService(c.get('Dep1'), c.get('Dep2'));
});
```

### Creating a New DTO

```javascript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class MyDto {
  @IsNotEmpty()
  @IsString()
  requiredField;

  @IsOptional()
  @IsString()
  optionalField;

  constructor(data) {
    Object.assign(this, data);
  }
}
```

## File Organization

```
/src
  /services
    photo.service.js        - Photo business logic
    face.service.js         - Face recognition logic
    drive.service.js        - Google Drive operations

  /repositories
    base.repository.js      - Abstract repository
    photo.repository.js     - Photo data access
    face.repository.js      - Face data access

  /dto
    upload-photo.dto.js     - Upload validation
    pose.dto.js             - Pose validation

  /validators
    dto-validator.js        - DTO validation utilities

  /guards
    admin.guard.js          - Admin authentication

  /interceptors
    error.interceptor.js    - Error handling
    logging.interceptor.js  - Request/response logging

  /errors
    app-error.js            - Custom error classes

  container.js              - DI container
  bootstrap.js              - Service initialization
```

## Testing Examples

### Testing a Service

```javascript
import { PhotoService } from '@/src/services/photo.service';

describe('PhotoService', () => {
  let service;
  let mockDriveService;
  let mockPhotoRepo;

  beforeEach(() => {
    mockDriveService = { uploadFile: jest.fn() };
    mockPhotoRepo = { save: jest.fn() };
    service = new PhotoService(mockDriveService, mockPhotoRepo, null);
  });

  it('should upload photo', async () => {
    mockDriveService.uploadFile.mockResolvedValue({ id: '123' });
    mockPhotoRepo.save.mockResolvedValue({ id: 1 });

    const result = await service.uploadPhoto({
      file: mockFile,
      uploaderId: 'user_1',
    });

    expect(result.id).toBe(1);
    expect(mockDriveService.uploadFile).toHaveBeenCalled();
  });
});
```

### Testing an API Route

```javascript
import { POST } from '@/app/api/upload/route';

describe('POST /api/upload', () => {
  it('should upload photo', async () => {
    const formData = new FormData();
    formData.append('file', mockFile);
    formData.append('uploaderId', 'user_1');

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [class-validator Decorators](https://github.com/typestack/class-validator)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection)
