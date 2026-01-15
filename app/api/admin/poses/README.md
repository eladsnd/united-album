# Pose Management API

RESTful API for managing pose challenges in the United Album wedding photo app.

## Base URL

```
/api/admin/poses
```

## Endpoints

### 1. GET - List All Poses

Retrieve all pose challenges.

**Authentication:** Not required (public data)

**Request:**
```http
GET /api/admin/poses
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "romantic-dip",
      "title": "The Romantic Dip",
      "instruction": "Groom, dip the bride back gently and share a romantic kiss.",
      "image": "/challenges/romantic-dip.png",
      "folderId": "1O9XzS3aj1YZgVxCRd0m6R7xRcx1VHPvt"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Failed to read challenges

---

### 2. POST - Create New Pose

Create a new pose challenge with image upload.

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request:**
```http
POST /api/admin/poses
Content-Type: multipart/form-data

FormData:
  - title: string (required)
  - instruction: string (required)
  - image: File (required, PNG/JPEG, max 5MB)
  - folderId: string (optional)
```

**Example (JavaScript):**
```javascript
const formData = new FormData();
formData.append('title', 'The Romantic Dip');
formData.append('instruction', 'Dip your partner romantically');
formData.append('image', fileInput.files[0]);
formData.append('folderId', '1O9XzS3...');

const response = await fetch('/api/admin/poses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "the-romantic-dip",
    "title": "The Romantic Dip",
    "instruction": "Dip your partner romantically",
    "image": "/challenges/the-romantic-dip.png",
    "folderId": "1O9XzS3..."
  },
  "message": "Pose created successfully."
}
```

**Status Codes:**
- `201 Created` - Pose created successfully
- `400 Bad Request` - Missing/invalid fields or invalid file
- `401 Unauthorized` - Not authenticated as admin
- `409 Conflict` - Pose with same ID already exists
- `500 Internal Server Error` - Server error

**Error Examples:**
```json
{
  "error": "Title is required and must be a non-empty string."
}

{
  "error": "Invalid file type. Only PNG and JPEG images are allowed."
}

{
  "error": "File size exceeds 5MB limit."
}

{
  "error": "Pose with ID \"romantic-dip\" already exists. Please use a different title."
}
```

---

### 3. PUT - Update Existing Pose

Update an existing pose challenge.

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request:**
```http
PUT /api/admin/poses
Content-Type: multipart/form-data

FormData:
  - id: string (required)
  - title: string (optional)
  - instruction: string (optional)
  - image: File (optional, PNG/JPEG, max 5MB)
  - folderId: string (optional)
```

**Example (JavaScript):**
```javascript
const formData = new FormData();
formData.append('id', 'romantic-dip');
formData.append('title', 'Updated Romantic Dip');
formData.append('instruction', 'New instruction text');

// Only include image if updating
if (newImage) {
  formData.append('image', newImage);
}

const response = await fetch('/api/admin/poses', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "romantic-dip",
    "title": "Updated Romantic Dip",
    "instruction": "New instruction text",
    "image": "/challenges/romantic-dip.png",
    "folderId": "1O9XzS3..."
  },
  "message": "Pose updated successfully."
}
```

**Status Codes:**
- `200 OK` - Pose updated successfully
- `400 Bad Request` - Missing ID or invalid file
- `401 Unauthorized` - Not authenticated as admin
- `404 Not Found` - Pose not found
- `500 Internal Server Error` - Server error

**Notes:**
- Only provided fields will be updated
- If a new image is provided, it replaces the existing one
- The pose ID cannot be changed

---

### 4. DELETE - Remove Pose

Delete a pose challenge.

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request:**
```http
DELETE /api/admin/poses?id=romantic-dip
```

**Example (JavaScript):**
```javascript
const response = await fetch('/api/admin/poses?id=romantic-dip', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
```

**Response:**
```json
{
  "success": true,
  "message": "Pose deleted successfully.",
  "data": {
    "id": "romantic-dip",
    "note": "Image file preserved to prevent breaking existing references."
  }
}
```

**Status Codes:**
- `200 OK` - Pose deleted successfully
- `400 Bad Request` - Missing ID parameter
- `401 Unauthorized` - Not authenticated as admin
- `404 Not Found` - Pose not found
- `500 Internal Server Error` - Server error

**Important:**
- Image files are **not deleted** to prevent breaking existing photo references
- Only the pose metadata is removed from `data/challenges.json`

---

## Data Structures

### Pose Object

```typescript
{
  id: string;          // Slugified title (e.g., "romantic-dip")
  title: string;       // Display title (e.g., "The Romantic Dip")
  instruction: string; // Instructions for the pose
  image: string;       // Public URL path (e.g., "/challenges/romantic-dip.png")
  folderId: string | null; // Google Drive folder ID for pose photos
}
```

### ID Generation

Pose IDs are automatically generated from titles using a slugify function:

```javascript
"The Romantic Dip" → "the-romantic-dip"
"Sweet Whisper!" → "sweet-whisper"
"Dance & Spin (Fun)" → "dance-spin-fun"
```

Rules:
- Converted to lowercase
- Spaces replaced with hyphens
- Special characters removed
- Leading/trailing hyphens trimmed

---

## Authentication

All mutating operations (POST, PUT, DELETE) require admin authentication using a Bearer token.

**Get Admin Token:**
```javascript
const response = await fetch('/api/admin/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin-password' })
});

const { token } = await response.json();
```

**Use Token:**
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

Tokens expire after 24 hours.

---

## File Upload Constraints

**Supported Formats:**
- PNG (`image/png`)
- JPEG/JPG (`image/jpeg`)

**Maximum Size:** 5MB

**Storage Location:** `/public/challenges/{pose-id}.{ext}`

**File Naming:** Images are saved as `{pose-id}.png` or `{pose-id}.jpg`

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE" // Optional
}
```

Common error scenarios:
- **Authentication failures** → 401 Unauthorized
- **Validation errors** → 400 Bad Request
- **Resource conflicts** → 409 Conflict
- **Missing resources** → 404 Not Found
- **Server errors** → 500 Internal Server Error

---

## Storage

**Metadata:** `data/challenges.json`
- JSON array of pose objects
- Atomic writes with temporary file strategy
- Pretty-printed for readability

**Images:** `public/challenges/`
- Public directory served by Next.js
- Files persist after pose deletion
- Accessed via `/challenges/{filename}` URL path

---

## Testing

Comprehensive test suite available at `__tests__/api-admin-poses.test.js`

**Run tests:**
```bash
npm test -- api-admin-poses
```

**Test coverage:**
- All CRUD operations
- Authentication validation
- Input validation
- File upload validation
- Error handling
- Slugify function
- Edge cases

All 30 tests passing ✓

---

## Example Workflow

### Creating a New Pose Challenge

1. **Authenticate as admin:**
```javascript
const authRes = await fetch('/api/admin/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
});
const { token } = await authRes.json();
```

2. **Prepare pose data:**
```javascript
const formData = new FormData();
formData.append('title', 'Dance Together');
formData.append('instruction', 'Share a romantic dance move');
formData.append('image', imageFile); // From <input type="file">
formData.append('folderId', 'google-drive-folder-id');
```

3. **Create the pose:**
```javascript
const response = await fetch('/api/admin/poses', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

if (response.ok) {
  const { data } = await response.json();
  console.log('Created pose:', data);
  // data.id: "dance-together"
  // data.image: "/challenges/dance-together.png"
}
```

4. **Update later if needed:**
```javascript
const updateData = new FormData();
updateData.append('id', 'dance-together');
updateData.append('instruction', 'Updated instruction');

await fetch('/api/admin/poses', {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${token}` },
  body: updateData
});
```

---

## Security Considerations

1. **Authentication:** Admin password stored in environment variable
2. **File Validation:** Type and size validation to prevent malicious uploads
3. **Rate Limiting:** Consider implementing rate limiting for production
4. **Input Sanitization:** All text inputs trimmed and validated
5. **Atomic Writes:** Temporary file strategy prevents data corruption
6. **Error Messages:** Detailed but safe error messages

---

## Future Enhancements

Potential improvements:
- [ ] Image optimization/resizing on upload
- [ ] Support for additional image formats (WebP, AVIF)
- [ ] Batch operations (create/update/delete multiple poses)
- [ ] Pose ordering/sorting
- [ ] Image cropping/editing capabilities
- [ ] Audit logging for admin actions
- [ ] Soft delete with restore capability
- [ ] Versioning for pose updates
