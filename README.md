# United Album - Wedding Photo Sharing App

A Next.js wedding photo-sharing application that combines pose challenges with AI-powered face recognition. Guests can view pose challenges, upload photos, and browse an intelligent face-organized gallery.

> **🚀 Production Ready**: Deployed on Vercel with PostgreSQL database.
> **📅 Last Updated**: January 21, 2026

## Features

- **3D Pose Carousel**: Interactive 3D carousel showcasing wedding pose challenges with Hebrew RTL support
- **AI Face Recognition**: Automatic face detection and grouping using face-api.js
- **Smart Photo Gallery**: Filter photos by person or pose challenge
- **Photo Likes**: Like your favorite photos with persistent database storage
- **Infinite Scroll**: Smooth progressive loading for large photo collections (20 photos/page)
- **Bulk Upload**: Upload multiple photos/videos at once without pose challenges
- **Google Drive Storage**: All photos securely stored in Google Drive with organized folder structure
- **Admin Panel**: Manage pose challenges with drag-drop reordering at `/admin`
- **Mobile Responsive**: Optimized for all devices with QR code access and touch gestures

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 18, face-api.js
- **Backend**: Next.js API Routes, Prisma ORM 6.19
- **Database**: PostgreSQL (Vercel Postgres) / SQLite (local dev)
- **Storage**: Google Drive API (OAuth 2.0)
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Styling**: CSS3 with glass morphism effects
- **Testing**: Jest, React Testing Library (143 tests passing)

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Google Cloud Platform account
- Google Drive folder for photo storage

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd united-album
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Drive API**
4. Create **OAuth 2.0 Client ID** credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000` (for dev)
5. Download the credentials JSON
6. Generate a **refresh token** using OAuth Playground or the script below

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Google Drive OAuth 2.0 Credentials
GOOGLE_CLIENT_ID='your-client-id.apps.googleusercontent.com'
GOOGLE_CLIENT_SECRET='your-client-secret'
GOOGLE_REFRESH_TOKEN='your-refresh-token'

# Google Drive Folder ID (create a folder in Drive, get ID from URL)
GOOGLE_DRIVE_FOLDER_ID='your-drive-folder-id'

# Admin Password (set your own strong password)
ADMIN_PASSWORD='your-secure-admin-password'
```

**Getting the Folder ID:**
1. Create a folder in Google Drive
2. Open the folder
3. Copy the ID from URL: `https://drive.google.com/drive/folders/YOUR_FOLDER_ID_HERE`

### 5. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates SQLite database)
npx prisma migrate dev

# (Optional) View database with Prisma Studio
npx prisma studio
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
united-album/
├── app/                          # Next.js 14 App Router
│   ├── api/                      # API Routes
│   │   ├── admin/               # Admin endpoints (auth, poses)
│   │   ├── photos/              # Photo management + likes
│   │   ├── faces/               # Face recognition
│   │   ├── upload/              # Photo upload
│   │   └── download/            # Download photos/albums
│   ├── admin/                   # Admin panel UI
│   ├── page.js                  # Main page (pose carousel)
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── FaceGallery.js           # Photo gallery with face filters
│   ├── UploadSection.js         # Photo upload with face detection
│   ├── AdminPoseManager.js      # Pose challenge management
│   ├── Sidebar.js               # Navigation sidebar
│   └── Toast.js                 # Notification system
├── lib/                         # Core utilities
│   ├── repositories/            # Data access layer (Repository Pattern)
│   ├── services/                # Business logic (Service Layer)
│   ├── api/                     # API decorators & error classes
│   ├── googleDrive.js           # Google Drive integration
│   ├── prisma.js                # Prisma client singleton
│   └── adminAuth.js             # Admin authentication
├── utils/                       # Helper functions
│   ├── clientFaceDetection.js   # Browser-based face detection
│   └── smartCrop.js             # Intelligent face cropping
├── prisma/                      # Database schema & migrations
│   └── schema.prisma            # Database models
├── public/                      # Static assets
│   ├── models/                  # Face detection ML models
│   └── challenges/              # Pose challenge images
├── __tests__/                   # Test suites
│   ├── repositories/            # Repository tests
│   ├── lib/services/            # Service layer tests
│   └── api/                     # API endpoint tests
└── data/                        # JSON storage (legacy)
```

## Available Scripts

### Development

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Testing

```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Database

```bash
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Run migrations (dev)
npx prisma generate      # Regenerate Prisma client
```

### Utilities

```bash
node scripts/cleanDatabase.js    # Clean test data from database
```

## Usage Guide

### For Guests

1. **View Pose Challenges**: Browse the 3D carousel to see pose ideas
2. **Upload Photos**: Click a pose, take a photo, upload (face detection runs automatically)
3. **Browse Gallery**: Filter by person or pose to find specific photos
4. **Like Photos**: Click the heart icon to like your favorite photos
5. **Download**: Download individual photos or entire albums as ZIP

### For Admins

1. Navigate to `/admin`
2. Enter admin password (from `.env.local`)
3. **Manage Poses**: Create, edit, or delete pose challenges
4. **Moderate Content**: Delete inappropriate photos (admin can delete any photo)

## Architecture

### Design Patterns

- **Repository Pattern**: Data access abstraction (PhotoRepository, FaceRepository, ChallengeRepository)
- **Service Layer**: Business logic separation (PhotoService, FaceService, UploadService)
- **Decorator Pattern**: Composable API middleware (withErrorHandler, withRateLimit, withAdminAuth)
- **Template Method**: BaseRepository with specialized implementations

### Data Flow

1. **Photo Upload**:
   - Client-side face detection (face-api.js)
   - Upload to Google Drive
   - Save metadata to database (Prisma)
   - Store face descriptors for matching

2. **Face Recognition**:
   - TinyFaceDetector + SSD MobileNet (dual-model strategy)
   - 128-dimensional face descriptors
   - Euclidean distance matching (threshold: 0.45-0.55)
   - Rolling window of 5 samples per person

3. **Image Serving**:
   - Proxy API for Google Drive images
   - 1-year browser cache (immutable)
   - Smart face cropping for thumbnails

## Environment Variables

See `.env.example` for all available configuration options:

```bash
# Required
GOOGLE_CLIENT_ID              # OAuth client ID
GOOGLE_CLIENT_SECRET          # OAuth client secret
GOOGLE_REFRESH_TOKEN          # OAuth refresh token
GOOGLE_DRIVE_FOLDER_ID        # Default upload folder
ADMIN_PASSWORD                # Admin panel password

# Optional
DATABASE_URL                  # Database connection string
LOG_LEVEL                     # Logging level (ERROR, WARN, INFO, DEBUG)
FACE_MATCH_THRESHOLD          # Face matching sensitivity (default: 0.50)
MAX_FILE_SIZE                 # Max upload size in bytes (default: 10MB)
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables (`.env.local` values)
4. Enable **Vercel Postgres** addon
5. Update `DATABASE_URL` in environment variables
6. Deploy

### Manual Deployment

```bash
# Build production bundle
npm run build

# Start production server
npm run start
```

## Testing

The project has comprehensive test coverage:

- **143 tests** (100% pass rate)
- **Repository tests**: 79 tests
- **Service layer tests**: 64 tests
- **API endpoint tests**: Integration tests for all routes

Run specific test suites:

```bash
npm test -- repositories/PhotoRepository.test.js
npm test -- lib/services/PhotoService.test.js
```

## Face Detection Models

Client-side face detection requires ML models in `public/models/`:

- `tiny_face_detector_model-*` (primary, fast)
- `ssd_mobilenetv1_model-*` (fallback, accurate)
- `face_landmark_68_model-*` (landmarks)
- `face_recognition_model-*` (128D descriptors)

Models are loaded automatically on first use.

## Troubleshooting

### Google Drive 401 Errors

**Problem**: "No access, refresh token, API key or refresh handler callback is set"

**Solution**:
1. Check `.env.local` exists with correct credentials
2. Verify refresh token hasn't expired
3. Regenerate refresh token if needed

### Face Detection Not Working

**Problem**: Faces not being detected

**Solution**:
1. Check browser console for model loading errors
2. Verify `public/models/` directory has all model files
3. Try uploading a well-lit, front-facing photo
4. Check face detection sensitivity threshold in `.env.local`

### Photos Not Appearing in Gallery

**Problem**: Uploaded photos don't show up

**Solution**:
1. Check Google Drive API quota
2. Verify `GOOGLE_DRIVE_FOLDER_ID` is correct
3. Check database with `npx prisma studio`
4. Look for errors in server console

## Performance

- **Initial load**: 20 photos (< 1s)
- **Infinite scroll**: Loads 20 more photos at 80% scroll
- **Image caching**: 1-year browser cache
- **Face thumbnails**: 120x120px @ 90% quality
- **Database queries**: Optimized with Prisma skip/take

## Security

- **OAuth 2.0**: Secure Google Drive authentication
- **Admin authentication**: HMAC-SHA256 session tokens
- **Input validation**: All API inputs validated
- **Rate limiting**: Prevents abuse
- **Path traversal protection**: File operations sanitized
- **Cascade deletion**: Automatic cleanup of related records

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Face detection powered by [face-api.js](https://github.com/justadudewhohacks/face-api.js)
- Icons from [Lucide React](https://lucide.dev/)
- Deployed on [Vercel](https://vercel.com)

---

Built with ❤️ for wedding celebrations
