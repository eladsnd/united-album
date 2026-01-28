# Multi-Tenancy Architecture Guide

This guide explains how to use the multi-tenant event management system in United Album.

## Overview

United Album now supports multiple isolated events, each with its own:
- Photos and uploads
- Feature flag configuration (gamification, challenges, etc.)
- Admin users
- Settings and branding

### User Roles

1. **Super Admin (You)**
   - Creates and manages events
   - Creates event admin users
   - Assigns admins to events
   - Has access to all events and data
   - Login: `/super-admin/login`
   - Dashboard: `/super-admin`

2. **Event Admin**
   - Manages only assigned events
   - Can upload photos, manage challenges, moderate content
   - Cannot create events or access other events
   - Login: `/super-admin/login`
   - Dashboard: `/admin`

3. **Guest**
   - Views and uploads photos to events
   - No admin access
   - Public access to event galleries

---

## Getting Started

### 1. Database Setup

Run the migration to create the multi-tenancy tables:

```bash
npx prisma generate
npx prisma db push

# Or run the migration script to preserve existing data
node scripts/migrateToMultiTenancy.js
```

This creates:
- `User` table (super admin, event admins, guests)
- `Event` table (enhanced with multi-tenancy fields)
- `EventAdmin` table (user-to-event assignments)
- `EventSettings` table (per-event feature flags)

### 2. Create Your Super Admin Account

**Option A: Using the setup script (recommended)**

```bash
# Make sure dev server is running first
npm run dev

# In another terminal
node scripts/createSuperAdmin.js
```

Follow the prompts to create your account.

**Option B: Using the API directly**

```bash
curl -X POST http://localhost:3000/api/super-admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "YourSecurePassword123",
    "name": "Your Name"
  }'
```

### 3. Log In as Super Admin

Visit `http://localhost:3000/super-admin/login` and log in with your credentials.

---

## Super Admin Workflow

### Creating an Event

1. Go to **Super Admin Dashboard** → **Events** tab
2. Click **"+ Create Event"**
3. Fill in event details:
   - **Name**: e.g., "Sarah & John's Wedding"
   - **Slug**: Auto-generated (e.g., `sarah-john-wedding`)
   - **Description**: Optional event description
   - **Type**: Wedding, Party, Corporate, Birthday, Other
   - **Start/End Time**: Event duration
   - **Color**: Theme color for branding
4. Configure features (optional):
   - ✅ Gamification & Points
   - ✅ Photo Challenges
   - ✅ Face Detection
   - ✅ Photo Likes
   - ✅ Bulk Upload
   - ✅ Event Timeline
5. Click **"Create Event"**

**Result:**
- Event created in database
- EventSettings created with your feature flags
- Event is now active and ready for photos

### Creating an Event Admin

1. Go to **Super Admin Dashboard** → **Users** tab
2. Click **"+ Create User"**
3. Fill in user details:
   - **Email**: Event admin's email
   - **Password**: Initial password (min 8 characters)
   - **Role**: Select "Event Admin"
   - **Name**: Optional full name
4. Assign to events:
   - Check the events this admin should manage
   - You can assign one admin to multiple events
5. Click **"Create User"**

**Result:**
- User account created
- User assigned as admin of selected events
- User can now log in at `/super-admin/login`

### Managing Events

**Edit Event:**
- Click **"Edit"** on event card
- Update details, dates, color, feature flags
- Click **"Update Event"**

**Archive Event:**
- Click **"Archive"** on event card
- Confirm archival
- Event becomes inactive (photos preserved)
- Show archived events: Check "Include archived"

**View Event Stats:**
Each event card shows:
- Photo count
- Admin count
- Event type
- Start date
- Status (Active/Inactive/Archived)

---

## Event Admin Workflow

### As Event Admin

1. **Log in** at `/super-admin/login`
2. **Dashboard** redirects to `/admin`
3. **Manage your event(s):**
   - Upload photos
   - Create pose challenges
   - Configure event settings
   - View analytics

### Permissions

Event admins can:
- ✅ View only assigned events
- ✅ Upload photos to their events
- ✅ Create/manage challenges for their events
- ✅ View event analytics
- ❌ Cannot create new events
- ❌ Cannot access other events' data
- ❌ Cannot create users

---

## Data Isolation

### How It Works

All data is scoped to `eventId`:

```javascript
// Photos are filtered by eventId
const photos = await prisma.photo.findMany({
  where: { eventId: 'sarah-wedding' }
});

// Feature flags are per-event
const flags = await flagService.getFlags('sarah-wedding');
```

### Event Detection

The app auto-detects the current event from:
1. URL slug: `/events/sarah-wedding`
2. User's assigned events (if event admin)
3. Default event (fallback)

### Storage Organization

Photos are organized by event:
- Cloudinary: `/events/{eventId}/photos/`
- Database: `photo.eventId = 'event-id'`

---

## API Endpoints

### Super Admin Routes

```bash
# Events
GET    /api/super-admin/events                # List all events
POST   /api/super-admin/events                # Create event
GET    /api/super-admin/events/[eventId]      # Get event details
PUT    /api/super-admin/events/[eventId]      # Update event
DELETE /api/super-admin/events/[eventId]      # Archive event

# Users
GET    /api/super-admin/users                 # List all users
POST   /api/super-admin/users                 # Create user

# Event Admins
GET    /api/events/[eventId]/admins           # List event admins
POST   /api/events/[eventId]/admins           # Assign admin to event
DELETE /api/events/[eventId]/admins           # Remove admin from event
```

### Event-Scoped Routes

```bash
# Feature Flags
GET /api/events/[eventId]/features            # Get event feature flags
PUT /api/events/[eventId]/features            # Update feature flags

# User Events
GET /api/events/user                          # Get events for logged-in user

# Event Info
GET /api/events/default                       # Get default event
GET /api/events?slug=sarah-wedding            # Get event by slug
```

### Authentication

All admin routes require JWT authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/super-admin/events
```

---

## Environment Variables

Required for multi-tenancy:

```bash
# JWT Secret (REQUIRED)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-256-bit-random-secret-here

# JWT Expiry (optional, defaults to 7d)
JWT_EXPIRY=7d

# Super Admin Setup Secret (optional additional protection)
SETUP_SECRET=your-setup-secret-here
```

---

## Migration Guide

### Migrating from Single-Tenant

If you have existing photos:

1. **Backup database** before migration
2. **Run migration script:**
   ```bash
   node scripts/migrateToMultiTenancy.js
   ```
3. **What happens:**
   - Creates "Main Event" (id: `default-event`)
   - Assigns all existing photos to Main Event
   - Copies AppSettings → EventSettings for Main Event
   - All existing data preserved

4. **After migration:**
   - Create your super admin account
   - Your existing photos are in "Main Event"
   - Create new events as needed
   - Optionally move photos to correct events

---

## Example Workflows

### Use Case: Wedding Photographer

You manage photos for multiple weddings:

**Setup:**
1. Create events: "Sarah & John", "Mike & Lisa", "Tom & Emma"
2. Create event admins: sarah@email.com, mike@email.com, tom@email.com
3. Assign each admin to their wedding event
4. Configure features per event:
   - Sarah's wedding: Gamification ON, Challenges ON
   - Mike's wedding: Just photo sharing (all features OFF)
   - Tom's wedding: Face detection ON, Likes ON

**Result:**
- Sarah sees only her wedding photos
- Mike sees only his wedding photos
- Each wedding has independent settings
- You (super admin) can see and manage all events

### Use Case: Corporate Event Company

You manage multiple corporate events:

**Setup:**
1. Create events: "Tech Corp Holiday Party 2026", "Sales Kickoff 2026"
2. Create event admins for HR team
3. Enable different features:
   - Holiday Party: Photo challenges, gamification
   - Sales Kickoff: Just photo sharing, moderation required

**Result:**
- Each event is completely isolated
- Different branding (colors) per event
- Different feature sets per event

---

## Troubleshooting

### "Super admin already exists"

- Only one super admin allowed
- Use login page: `/super-admin/login`
- If you forgot password, delete user from database and re-run setup

### "Cannot access event"

- Check user role: Must be SUPER_ADMIN or EVENT_ADMIN
- Check event assignment: Event admin must be assigned to event
- Verify JWT token is valid (check localStorage)

### Photos not showing

- Check `eventId` filter in API queries
- Verify EventContext is providing correct `currentEventId`
- Check browser console for errors

### Feature flags not working

- Verify EventSettings exists for event
- Check `/api/events/[eventId]/features` endpoint
- Clear cache: Feature flags cached for 30 seconds

---

## Security Best Practices

1. **Strong JWT Secret**
   - Use 256+ bit random secret
   - Never commit to git
   - Rotate periodically

2. **Password Requirements**
   - Minimum 8 characters
   - Encourage strong passwords
   - Consider password reset flow (future)

3. **Event Data Isolation**
   - Always filter by `eventId`
   - Verify `canAccessEvent()` before queries
   - Never trust client-side event selection

4. **Admin Permissions**
   - Use `adminOnly: true` decorator for admin routes
   - Check role in API handlers
   - Log admin actions for audit trail (future)

---

## Future Enhancements

Potential additions:

- [ ] Event-specific storage buckets (Cloudinary folders)
- [ ] Custom domains per event (e.g., sarahandjohn.wedding)
- [ ] Email invitations for event admins
- [ ] Password reset flow
- [ ] Event templates (copy settings from existing event)
- [ ] Bulk photo transfer between events
- [ ] Event analytics dashboard
- [ ] Multi-language support per event
- [ ] White-label branding per event

---

## Support

For issues or questions:
- Check CLAUDE.md for development info
- Review plan: `.claude/plans/tranquil-conjuring-piglet.md`
- GitHub issues: (if applicable)

**Last Updated:** 2026-01-28
**Version:** 1.0 (Multi-Tenancy Release)
