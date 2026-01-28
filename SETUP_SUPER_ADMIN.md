# Super Admin Setup Guide

Quick guide to get your super admin dashboard up and running.

## Prerequisites

1. **Database migrated:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

2. **Dependencies installed:**
   ```bash
   npm install
   ```

3. **Environment variables set:**
   ```bash
   # In .env.local
   JWT_SECRET=your-256-bit-random-secret-here
   ```

   Generate a secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Step 1: Create Your Super Admin Account

### Method 1: Interactive Script (Easiest)

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run setup script
node scripts/createSuperAdmin.js
```

Follow the prompts:
- **Email**: your-email@example.com
- **Password**: (min 8 characters)
- **Name**: Your Name

### Method 2: Direct API Call

```bash
curl -X POST http://localhost:3000/api/super-admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123",
    "name": "Admin User"
  }'
```

## Step 2: Log In

1. Visit: **http://localhost:3000/super-admin/login**
2. Enter your email and password
3. Click "Sign In"
4. You'll be redirected to `/super-admin` dashboard

## Step 3: Create Your First Event

1. Go to **Events** tab
2. Click **"+ Create Event"**
3. Fill in:
   - Name: "Sarah & John's Wedding"
   - Dates, color, description
   - Enable features you want (gamification, challenges, etc.)
4. Click **"Create Event"**

## Step 4: Create an Event Admin

1. Go to **Users** tab
2. Click **"+ Create User"**
3. Fill in:
   - Email: sarah@example.com
   - Password: (they'll use this to log in)
   - Role: **Event Admin**
   - Assign to: ✅ Sarah & John's Wedding
4. Click **"Create User"**

Now Sarah can log in at `/super-admin/login` and manage her wedding!

---

## Troubleshooting

### Build Error: "Export prisma doesn't exist"
**Fixed!** Restart your dev server:
```bash
# Kill the dev server (Ctrl+C)
npm run dev
```

### Runtime Error: "useEventContext must be used within EventProvider"
**Fixed!** EventProvider is now wrapped in root layout. Restart dev server.

### Login Page Looks Unstyled
**Solution:** Restart the dev server after pulling latest changes:
```bash
# Kill and restart
npm run dev
```

Tailwind will rebuild and apply all styles.

### "Super admin already exists"
You already created one! Just log in at `/super-admin/login`.

**Forgot password?**
Delete and recreate:
```sql
-- Using Prisma Studio (npx prisma studio) or direct SQL
DELETE FROM User WHERE role = 'SUPER_ADMIN';
```
Then run setup script again.

### "Connection refused" or "ECONNREFUSED"
Make sure dev server is running:
```bash
npm run dev
```

### "Invalid credentials"
- Double-check email and password (case-sensitive)
- Make sure you created the account successfully
- Check the terminal output from setup script

---

## Quick Reference

| Page | URL | Who Can Access |
|------|-----|----------------|
| Super Admin Login | `/super-admin/login` | Everyone (to log in) |
| Super Admin Dashboard | `/super-admin` | SUPER_ADMIN only |
| Event Admin Dashboard | `/admin` | EVENT_ADMIN only |
| Main App | `/` | Everyone |

**Default Credentials:** You create these yourself using the setup script!

---

## What You Can Do as Super Admin

✅ Create unlimited events
✅ Create event admin users
✅ Assign admins to events
✅ Configure features per event
✅ View all events and photos
✅ Archive events

**Event Admins** can only see/manage their assigned events.

---

## Next Steps After Setup

1. Create your first event
2. Create an event admin
3. Test logging in as the event admin
4. Verify data isolation (event admin sees only their event)
5. Upload some test photos
6. Configure feature flags per event

---

## Need Help?

- **Full Guide**: `MULTI_TENANCY.md`
- **Code Documentation**: `CLAUDE.md`
- **Architecture Plan**: `.claude/plans/tranquil-conjuring-piglet.md`

**Created:** 2026-01-28
**Version:** 1.0
