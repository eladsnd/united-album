# United Album - Design Brief for Stitch AI

## Project Summary
Wedding photo album app where guests upload photos for pose challenges and browse by AI-detected faces.

**Tech**: Next.js 16 + React 19
**Users**: Wedding guests (ages 20-70, mobile-first)
**Core Feature**: AI face recognition groups photos by person

---

## Pages to Design

### 1. Landing Page (Main Carousel)
**Purpose**: Browse pose challenges, select one to upload photo

**Layout**:
- 3D carousel showing 3 cards: previous (80% size, left), active (100% size, center), next (80% size, right)
- Each card: pose image + title + instruction text
- Navigation: arrow buttons + swipe gestures
- Sidebar: logo + "Challenge" button + "Gallery" button + QR code

**Design Style**: Elegant, wedding-appropriate, gold accents (#D4AF37)

### 2. Upload Page
**Purpose**: Upload photo for selected pose challenge

**States**:
1. **Idle**: Glass-effect card with upload icon, "Upload your [Pose] Photo" text
2. **Uploading**: Spinner + progress bar (0-100%) + status text
3. **Success**: Checkmark + photo preview + "Take Another Photo" button
4. **Error**: Error icon + error message + "Try Again" button

**Key Features**:
- Shows progress stages: "Analyzing Face..." → "Uploading..." → "Success!"
- Toast notification on completion: "[N] faces detected, [M] new!"

### 3. Gallery Page
**Purpose**: Browse all photos, filter by person using face recognition

**Layout**:
- **Top**: Horizontal scrolling face filters
  - "All" button (gold gradient, always first)
  - Person thumbnails (60x60px circles, "Person 1", "Person 2", etc.)
  - Selected face gets gold border + shadow

- **Main**: Photo grid (responsive)
  - Desktop: 3 columns
  - Tablet: 2 columns
  - Mobile: 1 column
  - Each photo card: image + delete button (bottom-left) + download button (bottom-right)
  - Hover: slight scale up + shadow

**Interactions**:
- Click face → filter photos to show only that person
- Click "All" → show all photos
- Click photo → view full-size (future: lightbox)

### 4. Admin Panel (/admin)
**Purpose**: Manage pose challenges (create, edit, delete)

**Layout**:
- **Login screen**: Password input card (glass effect)
- **Dashboard**:
  - Header: Title + admin badge (gold) + "Add New Pose" button + "Sign Out" button
  - Grid: Pose cards (image, title, instruction preview, Edit/Delete buttons)
  - Modal: Add/Edit form (title, instruction, image upload with drag-drop)

---

## Design System

### Colors
```
Primary Gold: #D4AF37 (buttons, accents, borders)
Cream: #FFF8E7 (backgrounds, hover states)
Dark Text: #2C2C2C (headings, body)
Success: #4CAF50 (upload success)
Error: #EF4444 (delete, errors)
Blue: #3B82F6 (download buttons)
```

### Typography
```
Headings: 'Playfair Display', serif (elegant, wedding-style)
Body: System font (-apple-system, Roboto, etc.)

Sizes:
- Hero: 1.875rem (30px)
- Title: 1.5rem (24px)
- Body: 1rem (16px)
- Small: 0.875rem (14px)
```

### Spacing
```
Consistent scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px
```

### Components

**Glass Card**:
```
background: rgba(255, 255, 255, 0.9)
backdrop-filter: blur(10px)
border: 1px solid rgba(255, 255, 255, 0.4)
border-radius: 20px
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1)
```

**Buttons**:
```
Primary: Gold bg, white text, rounded pill (border-radius: 50px)
Secondary: Outlined, transparent, gold border
Hover: scale(1.05) + enhanced shadow
Padding: 0.8rem 1.5rem
```

**Face Thumbnails**:
```
Size: 60x60px
Shape: Circle (border-radius: 50%)
Border: 3px solid transparent
Selected: border-color: #D4AF37 + shadow
Hover: scale(1.1)
```

**Photo Cards**:
```
Border-radius: 12px
Transition: transform 0.3s ease
Hover: translateY(-5px) + shadow
Aspect ratio: 4:3
```

---

## Key Interactions

### Upload Flow
1. User clicks "Upload your [Pose] Photo"
2. Selects file → Auto smart-crop centers on faces
3. Shows toast: "Photo auto-framed for best composition"
4. Progress bar fills (0% → 100%)
5. Success screen: "Photo uploaded! 3 faces, 2 new! 🎉"
6. Click "Take Another Photo" or navigate to gallery

### Gallery Filter Flow
1. User clicks face thumbnail (e.g., "Person 3")
2. Gallery filters instantly to show only photos with Person 3
3. Face thumbnail gets gold border (selected state)
4. Click "All" to return to full gallery

### Delete Flow
1. Hover photo card → delete button appears (red, bottom-left)
2. Click delete → confirmation dialog
3. On confirm → photo fades out with spinner
4. Success toast: "Photo permanently deleted"

---

## Mobile Responsive

### Breakpoints
```
Mobile: 0-767px (1 column, hamburger menu)
Tablet: 768-1023px (2 columns, compact sidebar)
Desktop: 1024px+ (3 columns, full sidebar)
```

### Mobile Optimizations
- Hide sidebar, show hamburger menu
- Face filters: horizontal scroll with snap
- Photo grid: 1 column, full width
- Upload: full-screen experience
- Touch-friendly: min 44px tap targets

---

## Animation Guidelines

### Transitions
Standard: `all 0.3s ease`

### Key Animations
- **Upload Success**: Scale in checkmark + fade in
- **Photo Hover**: `transform: translateY(-5px)` + shadow
- **Face Select**: Border color transition + scale(1.05)
- **Carousel**: Smooth 3D perspective transform
- **Loading**: Rotating spinner (360deg, 1s linear infinite)

---

## Accessibility

- **Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Keyboard**: Tab navigation, Enter/Space activate
- **ARIA**: Labels on all buttons, images have alt text
- **Focus States**: Visible outline on all interactive elements

---

## User Experience Priorities

1. **First Impression**: 3D carousel should be stunning, elegant
2. **Upload Ease**: Clear, delightful upload process with progress
3. **Face Discovery**: Easy to find photos of specific people
4. **Mobile-First**: Most users will upload from phones at wedding
5. **Celebration Mood**: Warm, joyful, sophisticated aesthetics

---

## Don't Do This

❌ Overly corporate/sterile designs
❌ Cluttered layouts
❌ Harsh colors or sharp angles
❌ Tiny text (remember: older guests too)
❌ Complex navigation

## Do This Instead

✅ Warm, elegant, wedding-appropriate
✅ Clean, spacious layouts
✅ Soft curves, smooth animations
✅ Readable text sizes (16px+ body)
✅ Intuitive, obvious actions

---

## Technical Notes

- **Face Detection**: Automatic, client-side (browser)
- **Photo Storage**: Google Drive
- **Face IDs**: Format is "person_1", "person_2", etc.
- **Upload Limit**: 5MB max (auto-compressed)
- **Security**: Rate-limited, input validated

---

## Questions for Stitch AI

1. **Carousel**: Prefer actual 3D transforms or simulated perspective?
2. **Animation Style**: Smooth/subtle or bold/playful?
3. **Photo Grid**: Masonry layout or uniform grid?
4. **Desktop Sidebar**: Always visible or collapsible?
5. **Loading States**: Skeleton placeholders or simple spinners?

---

## File References

If you need to see current implementation:
- Landing: `app/page.js`
- Gallery: `components/FaceGallery.js`
- Upload: `components/UploadSection.js`
- Admin: `components/AdminPoseManager.js`
- Styles: `app/globals.css`
