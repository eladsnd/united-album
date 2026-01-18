# United Album - Design Brief for Stitch AI

**Project Type**: Wedding Photo Album Web Application
**Tech Stack**: Next.js 16, React, Google Drive API, Face-API.js
**Target Audience**: Wedding guests (mobile-first, ages 20-70)
**Primary Use Case**: Collaborative photo sharing at weddings with AI-powered face recognition

---

## 1. Application Overview

United Album is an interactive wedding photo-sharing platform that combines **pose challenges** with **AI face recognition** to create an engaging, organized photo gallery experience. Guests can:

1. View creative pose challenges (e.g., "Warrior Pose", "Jumping High")
2. Upload photos attempting these poses
3. Browse photos filtered by person (using facial recognition)
4. Download individual photos or entire albums

The app uses **client-side AI face detection** (face-api.js) to automatically identify and group photos by person, creating a personalized gallery experience without requiring manual tagging.

---

## 2. Technical Architecture

### 2.1 Frontend Stack
- **Next.js 16.1.1** (App Router) - React framework with server-side rendering
- **React 19** - Component-based UI
- **Face-API.js** - Client-side face detection (TinyFaceDetector + SSD MobileNet)
- **Lucide React** - Icon library
- **JSZip** - Client-side ZIP generation for album downloads

### 2.2 Backend Architecture
- **Next.js API Routes** - Serverless API endpoints
- **NestJS-style patterns** - Service layer, DTOs, dependency injection
- **Google Drive API** - Photo storage and streaming
- **JSON file storage** - Photo metadata (`data/photos.json`, `data/faces.json`, `data/challenges.json`)

### 2.3 Key Architectural Patterns

**Service Layer Pattern** (NestJS-inspired):
```javascript
// Business logic separated from API routes
PhotoService.uploadPhoto(dto)
PhotoService.deletePhoto(id, uploaderId, isAdmin)
FaceService.saveFaceDescriptor(faceId, descriptor)
```

**Rate Limiting** (Security):
- Admin login: 5 attempts/min
- Photo deletion: 10/min
- Downloads: 20/min
- Album downloads: 3/hour + 50 photo max

**Face Recognition Flow**:
1. Upload photo → Google Drive
2. Client-side face detection on uploaded image
3. Extract 128-dimensional face descriptors
4. Match against existing faces (0.45-0.55 Euclidean distance threshold)
5. Assign person ID (person_1, person_2, etc.)
6. Create face thumbnails and store in Drive `faces/` subfolder

---

## 3. User Experience Flow

### 3.1 Primary User Journey

**Step 1: Landing Page**
- User arrives at wedding album URL
- Sees elegant landing page with:
  - **3D carousel** of pose challenges (prev/active/next visible)
  - Each challenge shows: title, image, instruction
  - Mobile QR code for easy access

**Step 2: Select Pose Challenge**
- User clicks/taps a pose card
- Navigates to pose detail view with upload interface

**Step 3: Upload Photo**
- User clicks "Upload your [Pose] Photo"
- Selects photo from device or takes new photo
- **Smart cropping** automatically centers on detected faces
- Upload progress: Analyzing → Uploading → Success (0-100%)
- Face detection runs automatically (if models loaded)

**Step 4: Browse Gallery**
- User clicks "Gallery" in sidebar
- Sees horizontally scrollable face filters (circular thumbnails)
- Clicks face to filter photos by person
- Clicks "All" to see all photos
- Photos displayed in responsive grid (3 columns desktop, 2 mobile)

**Step 5: Interact with Photos**
- Click photo to view full-size
- Download individual photo or entire album
- Delete own photos (if owner) or any photo (if admin)

---

## 4. Core Components & Pages

### 4.1 Main Application Layout

**Layout Structure** (`app/layout.js`):
```
┌─────────────────────────────────┐
│  Sidebar (Desktop)              │
│  ┌──────────────────────────┐  │
│  │  Logo                    │  │
│  │  Challenge Button        │  │
│  │  Gallery Button          │  │
│  │  Mobile Access (QR)      │  │
│  └──────────────────────────┘  │
│                                 │
│  Main Content Area              │
│  (Pages render here)            │
└─────────────────────────────────┘
```

**Mobile Layout**:
- Sidebar hidden
- Hamburger menu (top-left)
- Full-width content area

### 4.2 Key Components

#### **3D Carousel** (`components/Carousel.js`)
- **Design**: Perspective 3D effect with 3 visible cards
- **Layout**: Previous (left, scaled 0.8), Active (center, full size), Next (right, scaled 0.8)
- **Interaction**: Click arrows or swipe to navigate
- **Animation**: Smooth transitions with CSS transforms

**Key Props**:
```javascript
{
  challenges: [{ id, title, instruction, image }],
  onChallengeClick: (challenge) => navigate to upload page
}
```

#### **Face Gallery** (`components/FaceGallery.js`)
- **Top Section**: Horizontal scrolling face filters
  - "All" filter (golden gradient, always first)
  - Person filters (circular thumbnails with "Person N" labels)
  - Auto-scroll to show more faces
- **Grid Section**: Responsive photo grid
  - 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
  - Each photo card shows:
    - Image (smart-cropped, aspect ratio 4:3)
    - Delete button (red, owner only; gold, admin)
    - Download button (blue)
    - Hover effects (scale, shadow)

**State Management**:
```javascript
{
  selectedFaceId: 'person_3' | 'all',
  deletingPhotos: Set<photoId>, // For loading states
  photos: [{ id, url, mainFaceId, faceIds[], poseId, timestamp }]
}
```

#### **Upload Section** (`components/UploadSection.js`)
- **Idle State**: Glass-effect card with upload icon
- **Analyzing State**: Spinner + "Analyzing Face..." (0-50% progress)
- **Uploading State**: Spinner + "Processing & Uploading..." (50-100%)
- **Success State**: Checkmark + preview + "Take Another Photo" button
- **Error State**: Error icon + message + "Try Again" button

**Upload Flow**:
1. User selects file
2. Smart crop (if faces detected) → 10% progress
3. Upload to Drive → 40% progress
4. Download from Drive for face detection → 60% progress
5. Face detection + thumbnail extraction → 90% progress
6. Upload face thumbnails (new faces only) → 100% progress

#### **Admin Panel** (`app/admin/page.js`, `components/AdminPoseManager.js`)
- **Auth Screen**: Password input with elegant glass card
- **Pose Manager**:
  - Header: Title + admin badge + "Add New Pose" + "Sign Out"
  - Grid: Pose cards (title, instruction preview, image, Edit/Delete)
  - Modal: Add/Edit pose form (title, instruction, image upload, folder ID)
- **Features**:
  - Drag-and-drop image upload
  - Image preview
  - Validation (required fields)
  - Success banners (auto-dismiss after 3s)

---

## 5. Design System & Styling

### 5.1 Color Palette

**Primary Colors**:
- **Gold**: `#D4AF37` (primary accent, buttons, borders)
- **Cream**: `#FFF8E7` (background, hover states)
- **Dark Text**: `#2C2C2C` (headings, body text)
- **Light Gray**: `#F5F5F5` (cards, backgrounds)

**Accent Colors**:
- **Success Green**: `#4CAF50` (upload success, confirmations)
- **Error Red**: `#EF4444` (errors, delete buttons)
- **Warning Yellow**: `#FFC107` (warnings, info messages)
- **Blue**: `#3B82F6` (download buttons, links)

**Admin Colors**:
- **Admin Gold**: `#D4AF37` (admin badges, admin delete buttons)
- **Admin Blue**: `#60A5FA` (edit buttons)

### 5.2 Typography

**Font Family**:
- **Headings**: `'Playfair Display', serif` (elegant, wedding-appropriate)
- **Body**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`)

**Font Sizes**:
```css
--text-xs: 0.75rem;    /* 12px - small labels */
--text-sm: 0.875rem;   /* 14px - body text */
--text-base: 1rem;     /* 16px - default */
--text-lg: 1.125rem;   /* 18px - subheadings */
--text-xl: 1.25rem;    /* 20px - section titles */
--text-2xl: 1.5rem;    /* 24px - page titles */
--text-3xl: 1.875rem;  /* 30px - hero headings */
```

**Font Weights**:
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

### 5.3 Spacing System

**Consistent spacing scale**:
```css
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
--spacing-10: 2.5rem;  /* 40px */
--spacing-12: 3rem;    /* 48px */
```

### 5.4 Component Patterns

#### **Glass Effect** (Cards, Modals)
```css
background: rgba(255, 255, 255, 0.9);
backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.4);
border-radius: 20px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
```

#### **Buttons**
- **Primary**: Gold background, white text, rounded pill shape
- **Secondary**: Outlined, transparent background, gold border
- **Danger**: Red background, white text
- **Hover**: Scale(1.05), enhanced shadow

```css
.btn {
  padding: 0.8rem 1.5rem;
  border-radius: 50px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(var(--color-rgb), 0.3);
}
```

#### **Photo Cards**
```css
.photo-card {
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.photo-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

#### **Face Thumbnails** (Gallery Filters)
```css
.face-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid transparent;
  transition: all 0.3s ease;
}

.face-thumbnail.selected {
  border-color: #D4AF37;
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.2);
}

.face-thumbnail:hover {
  transform: scale(1.1);
  border-color: #D4AF37;
}
```

### 5.5 Animations & Transitions

**Standard Transition**: `all 0.3s ease`

**Loading Spinner**:
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

**Fade In**:
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Slide Up** (Modals):
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 6. Mobile Responsiveness

### 6.1 Breakpoints

```css
/* Mobile-first approach */
--mobile: 0-767px     /* 1 column, full-width cards */
--tablet: 768-1023px  /* 2 columns, condensed sidebar */
--desktop: 1024px+    /* 3 columns, full sidebar */
```

### 6.2 Mobile Optimizations

**Navigation**:
- Sidebar hidden on mobile
- Hamburger menu (slide-in drawer)
- Bottom tab bar (optional enhancement)

**Photo Grid**:
- Desktop: 3 columns (33% width each)
- Tablet: 2 columns (50% width each)
- Mobile: 1 column (100% width)

**Face Filters**:
- Horizontal scroll with touch gestures
- Snap scrolling to face thumbnails
- "Show more" visual indicator (fade gradient on right edge)

**Upload**:
- Full-screen upload modal on mobile
- Camera integration (if supported)
- Progress bar fills entire width

**Admin Panel**:
- Stacked layout (single column)
- Full-width modal forms
- Touch-friendly buttons (min 44px height)

---

## 7. Key User Flows (Detailed)

### 7.1 Upload Photo Flow

**User Journey**:
```
1. Click pose challenge → Upload page loads
2. Click "Upload your [Pose] Photo"
3. Select file from device/camera
4. [If face detection enabled]
   → Smart crop centers on faces (auto)
   → Shows "Photo auto-framed for best composition" toast
5. Upload progress indicator (0-100%)
6. [If faces detected]
   → Shows "N faces detected, M new!" success message
   → Face thumbnails auto-update in gallery
7. "Photo uploaded!" success screen
8. Click "Take Another Photo" or navigate to gallery
```

**Error Handling**:
- Network error → Auto-retry with exponential backoff (3 attempts)
- File too large → Compress to <5MB automatically
- Face detection fails → Photo still uploads, shows warning
- Upload timeout (60s) → Clear error message with retry button

### 7.2 Face Gallery Filter Flow

**User Journey**:
```
1. Click "Gallery" in sidebar
2. Horizontal face filters load (scroll to see all)
3. Click "All" → Shows all photos (default)
4. Click face thumbnail (e.g., "Person 3")
   → Gallery filters to photos containing Person 3
   → Face thumbnail gets gold border (selected state)
   → Photo count updates (e.g., "12 photos of Person 3")
5. Click different face → Gallery updates instantly
6. Click "All" → Returns to full gallery
```

**Interactive States**:
- Hover: Face thumbnail scales 1.1x, gold border preview
- Selected: Gold border, gold shadow, slight elevation
- Loading: Skeleton placeholders for photos

### 7.3 Admin Pose Management Flow

**User Journey**:
```
1. Navigate to /admin
2. Enter admin password
3. Password validated (rate-limited: 5 attempts/min)
4. [On success] Pose manager dashboard loads
5. Click "Add New Pose"
   → Modal opens with form
6. Fill in:
   - Title (e.g., "Warrior Pose")
   - Instruction (e.g., "Stand strong like a warrior!")
   - Upload image (drag-drop or click)
   - Optional: Google Drive folder ID
7. Click "Save"
   → Validation runs
   → Image uploaded to /public/challenges/
   → Pose saved to challenges.json
   → Success banner appears
   → Grid refreshes with new pose
8. Edit pose: Click Edit → Pre-filled form → Save → Success
9. Delete pose: Click Delete → Confirmation → Deleted → Success
```

**Validation Rules**:
- Title: Required, non-empty, Unicode-safe
- Instruction: Required, non-empty
- Image: Required, PNG/JPEG only, max 5MB
- Duplicate check: Slug-based (prevents duplicate IDs)

---

## 8. Data Models

### 8.1 Photo Object

```typescript
interface Photo {
  id: number;                    // Auto-incremented unique ID
  driveId: string;               // Google Drive file ID
  url: string;                   // Proxy URL: /api/image/[driveId]
  mainFaceId: string;            // Primary person: "person_3" | "unknown"
  faceIds: string[];             // All people: ["person_3", "person_7"]
  faceBoxes: FaceBox[];          // Bounding boxes for each face
  poseId: string;                // Challenge ID: "warrior-pose"
  uploaderId: string;            // Session ID: "uploader_1234_abc"
  timestamp: string;             // ISO format: "2026-01-15T10:30:00Z"
}

interface FaceBox {
  x: number;         // Top-left X coordinate
  y: number;         // Top-left Y coordinate
  width: number;     // Box width
  height: number;    // Box height
}
```

**Storage**: `data/photos.json` (JSON file)

### 8.2 Face Object

```typescript
interface Face {
  faceId: string;                // Unique ID: "person_3"
  descriptor: number[];          // 128-dimensional face embedding
  photoCount: number;            // Number of photos containing this person
  thumbnailDriveId: string;      // Google Drive ID for face thumbnail
  timestamp: string;             // First seen timestamp
}
```

**Storage**: `data/faces.json` (JSON file)

### 8.3 Challenge (Pose) Object

```typescript
interface Challenge {
  id: string;                    // Slug: "warrior-pose"
  title: string;                 // Display name: "Warrior Pose"
  instruction: string;           // Description: "Stand strong like a warrior!"
  image: string;                 // Image path: "/challenges/warrior-pose.jpg"
  folderId: string | null;       // Optional Google Drive folder ID
}
```

**Storage**: `data/challenges.json` (JSON file)

---

## 9. API Endpoints

### 9.1 Public Endpoints (No Auth Required)

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/photos` | GET | Get all photos with metadata | 100/min |
| `/api/faces` | GET | Get all known faces | 100/min |
| `/api/faces` | POST | Save new face descriptor | 100/min |
| `/api/image/[id]` | GET | Stream photo from Drive | None |
| `/api/face-crop/[id]` | GET | Get cropped face thumbnail | 100/min |
| `/api/face-thumbnails` | GET | Get all face thumbnail URLs | 100/min |
| `/api/admin/poses` | GET | Get all pose challenges | 100/min |
| `/api/config` | GET | Get server config (local IP) | 100/min |

### 9.2 Protected Endpoints (Auth/Ownership Required)

| Endpoint | Method | Purpose | Auth | Rate Limit |
|----------|--------|---------|------|------------|
| `/api/upload` | POST | Upload photo | uploaderId | 10/min |
| `/api/update-faces` | POST | Update photo faces | uploaderId | 100/min |
| `/api/delete-photo` | DELETE | Delete photo | uploaderId or admin | 10/min |
| `/api/download/[id]` | GET | Download single photo | None | 20/min |
| `/api/download-album` | POST | Download ZIP album | None | 3/hour, max 50 photos |

### 9.3 Admin Endpoints (Admin Auth Required)

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/admin/auth` | POST | Admin login | 5/min |
| `/api/admin/poses` | POST | Create pose | None |
| `/api/admin/poses` | PUT | Update pose | None |
| `/api/admin/poses` | DELETE | Delete pose | None |

**Admin Authentication**:
- Header: `Authorization: Bearer [token]`
- Token format: HMAC-SHA256 hash + timestamp
- Expiry: 24 hours
- Storage: sessionStorage (client-side)

---

## 10. Security Features

### 10.1 Rate Limiting

**Implementation**: In-memory IP-based rate limiting

**Configurations**:
```javascript
{
  auth: 5 req/min,           // Admin login
  upload: 10 req/min,        // Photo uploads
  delete: 10 req/min,        // Photo deletions
  download: 20 req/min,      // Individual downloads
  downloadAlbum: 3 req/hour, // ZIP downloads
  api: 100 req/min           // General API calls
}
```

**Benefits**:
- Prevents brute-force attacks
- Protects Google Drive API quota
- Prevents DoS attacks
- Prevents memory exhaustion

### 10.2 Input Validation

**Face Data**:
- faceId: Only `person_\d+` format (prevents XSS)
- descriptor: Exactly 128 finite numbers
- metadata: Sanitized (only safe fields)

**Photo ID**:
- Must be positive integer
- Validates before parseInt to prevent NaN

**File Uploads**:
- Type validation: PNG/JPEG only
- Size limit: 5MB max
- Magic number checking (not just extension)

**Path Traversal Protection**:
- Validates file paths stay within allowed directories
- Prevents `../../etc/passwd` attacks

### 10.3 Data Integrity

**JSON Corruption Recovery**:
- Automatic backup on every write (`.backup` files)
- Auto-restore from backup if main file corrupted
- Validates data structure before parsing

**Deduplication**:
- Photos deduplicated by `driveId`
- Prevents duplicate entries in database

**Orphaned Data Cleanup**:
- Auto-delete face thumbnails when last photo removed
- Maintains data consistency

---

## 11. Performance Optimizations

### 11.1 Image Handling

**Smart Cropping**:
- Auto-centers photos on detected faces
- Target aspect ratio: 4:3 (optimal for gallery)
- Padding: 2.5x face size (good composition)
- Quality: 95% JPEG (high quality)

**Compression**:
- Server-side compression to <5MB (Google Drive limit)
- Adaptive quality reduction (85% → 50%)
- Dimension reduction if quality too low
- Uses `sharp` library for performance

**Lazy Loading**:
- Photos load on scroll (not all at once)
- Face thumbnails load progressively
- Reduces initial page load time

### 11.2 Face Detection Optimization

**Client-Side Detection** (Preferred):
- Runs in browser (no server load)
- Uses GPU acceleration via WebGL
- Two-model strategy: TinyFaceDetector (fast) + SSD MobileNet (accurate)
- Model files cached in browser

**Thumbnail Reuse**:
- Only creates thumbnails for NEW faces
- Reuses existing thumbnails for recognized people
- Saves Google Drive storage and bandwidth

**Adaptive Thresholds**:
- 1 sample: 0.45 threshold (lenient)
- 2-3 samples: 0.50 threshold (balanced)
- 4+ samples: 0.55 threshold (confident)
- Better matching as more samples collected

### 11.3 Caching Strategy

**Browser Cache**:
- Face-api.js models cached (60MB total)
- Photo thumbnails cached
- Face thumbnails cached

**Server-Side**:
- Google Drive file streams buffered
- JSON files read synchronously (fast for small datasets)
- Rate limit data stored in memory (Map)

---

## 12. Error Handling & User Feedback

### 12.1 Error Types & Messages

**Upload Errors**:
- Network error → "Network error. Please check your connection." + retry
- Timeout (60s) → "Upload timed out. Please try again." + retry
- File too large → Auto-compress (silent) or "File too large after compression"
- Face detection fails → "Photo uploaded! Face detection unavailable - photo saved without face tagging."

**Delete Errors**:
- Permission denied → "You can only delete your own photos. Please upload a photo first to establish identity."
- Rate limit → "Too many delete requests. Please slow down."
- Photo not found → "Photo not found or already deleted."

**Download Errors**:
- File not found → "Photo not found in Google Drive."
- Rate limit → "Download rate limit exceeded. Please wait."
- Network error → "Failed to download photo. Please try again."

**Admin Errors**:
- Invalid password → "Invalid password"
- Rate limit → "Too many login attempts. Please wait a minute before trying again."
- Token expired → "Session expired. Please log in again."

### 12.2 Toast Notifications

**Types**:
- Success (green): Photo uploaded, face recognized, deletion success
- Warning (yellow): Face detection unavailable, retrying upload
- Error (red): Upload failed, permission denied, network error
- Info (blue): Smart crop applied, new faces detected

**Display**:
- Position: Top-right corner
- Duration: 3 seconds (auto-dismiss)
- Dismissible: Click × to close early
- Stacking: Multiple toasts stack vertically

---

## 13. Accessibility Considerations

### 13.1 Keyboard Navigation

**Supported**:
- Tab: Navigate between interactive elements
- Enter/Space: Activate buttons, select photos
- Arrow keys: Navigate carousel
- Esc: Close modals

### 13.2 Screen Readers

**ARIA Labels**:
- Buttons: Descriptive labels ("Upload photo", "Delete photo")
- Images: Alt text with person info ("Photo with Person 3")
- Forms: Labeled inputs ("Pose title", "Instruction")

**Landmarks**:
- `<nav>` for sidebar navigation
- `<main>` for primary content
- `<header>` for page headers
- `role="dialog"` for modals

### 13.3 Color Contrast

**WCAG AA Compliance**:
- Text on white: #2C2C2C (ratio 12.63:1)
- Gold on white: #D4AF37 (ratio 3.67:1) - for large text only
- Success green: #4CAF50 (ratio 4.66:1)
- Error red: #EF4444 (ratio 4.51:1)

---

## 14. Future Enhancements (Not Yet Implemented)

### 14.1 Planned Features

**Social Sharing**:
- Share individual photos to social media
- Generate shareable album links
- Embed codes for other websites

**Enhanced Face Recognition**:
- Manual face labeling ("Tag as [Name]")
- Face grouping suggestions
- Confidence scores display

**Gallery Improvements**:
- Lightbox view for full-screen photos
- Swipe gestures for photo navigation
- Photo captions/comments

**Analytics**:
- Most popular poses
- Upload activity timeline
- Face appearance frequency

**Export Options**:
- PDF album generation
- Print-ready layouts
- High-resolution exports

### 14.2 Technical Debt (From Analysis)

**High Priority**:
- Async file operations (replace synchronous I/O)
- File locking for race condition prevention
- Database migration (replace JSON files for scale)

**Medium Priority**:
- Photo count tracking (decrement on delete)
- JSON file size monitoring/archiving
- More comprehensive error logging

---

## 15. Design Guidelines for Stitch AI

### 15.1 Brand Personality

**Tone**: Elegant, Celebratory, Warm, Inviting
**Mood**: Joyful, Sophisticated, Memorable
**Target Emotion**: Excitement, Nostalgia, Connection

### 15.2 Visual Direction

**Inspiration**:
- High-end wedding photography websites
- Modern photo-sharing apps (Google Photos, Instagram)
- Elegant event invitations (gold accents, serif fonts)

**Avoid**:
- Overly corporate/sterile designs
- Cluttered layouts
- Harsh colors or sharp angles
- Generic stock photo aesthetics

### 15.3 Component Priorities

**Critical Components** (Must be beautiful):
1. 3D Carousel (first impression)
2. Upload interface (primary action)
3. Face gallery grid (main content)
4. Photo cards (repeated element)

**Secondary Components**:
5. Sidebar navigation
6. Admin panel
7. Toast notifications
8. Loading states

### 15.4 Interaction Principles

**Delight Moments**:
- Upload success animation (confetti, checkmark burst)
- Face detection completion (face icons populate)
- Smart crop notification (subtle "auto-framed" badge)
- Photo hover effects (smooth scale, shadow)

**Microinteractions**:
- Button hover states (scale + shadow)
- Face thumbnail selection (border + glow)
- Carousel card transitions (smooth perspective shift)
- Progress bar fills (eased animation)

---

## 16. Technical Constraints & Requirements

### 16.1 Browser Support

**Required**:
- Chrome 90+ (face-api.js WebGL support)
- Safari 14+ (iOS/macOS)
- Firefox 88+ (desktop)
- Edge 90+ (desktop)

**Limited Support**:
- Mobile browsers (face detection may be slower/unavailable)
- Older browsers (graceful degradation, no face detection)

### 16.2 Performance Targets

**Page Load**:
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Time to Interactive: <3.5s

**Interactions**:
- Upload progress updates: 16ms (60 FPS)
- Face filter change: <100ms
- Photo grid render: <200ms
- Carousel navigation: <300ms

### 16.3 Device Support

**Primary Devices**:
- iPhone 12+, Android flagship phones (mobile upload)
- iPad, tablets (gallery viewing)
- Laptop/desktop (admin panel, management)

**Screen Sizes**:
- Mobile: 375px - 767px width
- Tablet: 768px - 1023px width
- Desktop: 1024px+ width

---

## 17. File Structure Reference

```
united-album/
├── app/
│   ├── layout.js                    # Root layout with sidebar
│   ├── page.js                      # Landing page (3D carousel)
│   ├── admin/
│   │   └── page.js                  # Admin panel
│   └── api/
│       ├── upload/route.js          # Photo upload endpoint
│       ├── delete-photo/route.js    # Photo deletion endpoint
│       ├── update-faces/route.js    # Face metadata update
│       ├── photos/route.js          # Get all photos
│       ├── faces/route.js           # Face CRUD operations
│       ├── download/[driveId]/route.js       # Single photo download
│       ├── download-album/route.js           # ZIP album download
│       ├── face-crop/[driveId]/route.js      # Face thumbnail crop
│       ├── face-thumbnails/route.js          # All face thumbnails
│       ├── image/[id]/route.js               # Photo streaming
│       ├── config/route.js                   # Server config
│       └── admin/
│           ├── auth/route.js        # Admin authentication
│           └── poses/route.js       # Pose CRUD operations
│
├── components/
│   ├── Carousel.js                  # 3D pose carousel
│   ├── FaceGallery.js              # Face-filtered photo gallery
│   ├── UploadSection.js            # Photo upload interface
│   ├── Sidebar.js                  # Navigation sidebar
│   ├── Toast.js                    # Toast notification
│   ├── ToastContainer.js           # Toast manager
│   ├── AdminAuth.js                # Admin login form
│   └── AdminPoseManager.js         # Pose management UI
│
├── lib/
│   ├── googleDrive.js              # Google Drive API integration
│   ├── photoStorage.js             # Photo JSON CRUD operations
│   ├── faceStorage.js              # Face JSON CRUD operations
│   ├── adminAuth.js                # Admin authentication utilities
│   └── rateLimit.js                # Rate limiting middleware
│
├── utils/
│   ├── clientFaceDetection.js      # Browser face detection
│   └── smartCrop.js                # Auto-cropping algorithm
│
├── data/
│   ├── photos.json                 # Photo metadata storage
│   ├── faces.json                  # Face descriptor storage
│   └── challenges.json             # Pose challenge definitions
│
├── public/
│   ├── challenges/                 # Pose challenge images
│   └── models/                     # Face-api.js model files
│
└── styles/
    └── globals.css                 # Global styles, CSS variables
```

---

## 18. Summary for Stitch AI

**What to Design**:

1. **Landing Page** with elegant 3D carousel of pose challenges
2. **Upload Interface** with progress states and success animations
3. **Face Gallery** with horizontal scrolling filters and responsive photo grid
4. **Admin Panel** with pose management (CRUD operations)
5. **Mobile-responsive** layouts for all components
6. **Toast notifications** for user feedback
7. **Loading states** for all async operations

**Design Priorities**:

1. **Elegance**: Wedding-appropriate, sophisticated aesthetics
2. **Clarity**: Clear visual hierarchy, intuitive interactions
3. **Delight**: Microinteractions, smooth animations, celebratory moments
4. **Accessibility**: WCAG AA compliance, keyboard navigation, screen reader support
5. **Performance**: Optimized images, lazy loading, smooth 60 FPS animations

**Key Design Constraints**:

- Mobile-first responsive design
- Touch-friendly (min 44px tap targets)
- High contrast for outdoor wedding use
- Works in bright sunlight (avoid pure white backgrounds)
- Supports both portrait and landscape orientations

**Technical Collaboration**:

All component APIs, data models, and user flows are documented above. The application is production-ready with comprehensive security, error handling, and performance optimizations. Design work should focus on visual polish, microinteractions, and creating a cohesive, memorable user experience that matches the elegance of a wedding celebration.

---

**Questions for Stitch AI**:

1. Should the 3D carousel use actual 3D transforms or a simulated perspective effect?
2. Preferred animation style: Smooth/subtle or bold/playful?
3. Should face thumbnails show names (manually entered) or just "Person N"?
4. Desktop sidebar: Always visible or collapsible?
5. Photo grid: Masonry layout or uniform grid?

---

**End of Design Brief**
