# Admin Auth Quick Reference

## Setup
```env
# .env
ADMIN_PASSWORD=your-secure-password
```

## Client Login
```javascript
const res = await fetch('/api/admin/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password })
});
const { token } = await res.json();
sessionStorage.setItem('admin_token', token);
```

## Protected API Route
```javascript
import { isAdminAuthenticated } from '@/lib/adminAuth';

export async function DELETE(request) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // Your admin code here
}
```

## Authenticated Request
```javascript
const token = sessionStorage.getItem('admin_token');
await fetch('/api/admin/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Available Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `verifyAdminPassword(password)` | Check if password matches env var | `boolean` |
| `generateAdminToken()` | Create new session token | `string` |
| `verifyAdminToken(token)` | Validate token (checks expiry) | `boolean` |
| `isAdminAuthenticated(request)` | Extract & verify token from request | `boolean` |
| `getTokenExpiryMs()` | Get expiry time (24h) | `number` |

## Token Details
- **Format**: `{hash}_{timestamp}`
- **Expiry**: 24 hours
- **Storage**: sessionStorage (client-side)
- **Header**: `Authorization: Bearer {token}`

## Security Notes
- Token auto-expires after 24 hours
- Uses HMAC-SHA256 for integrity
- Timing-safe comparisons prevent attacks
- sessionStorage clears on tab close
- Always use HTTPS in production
