# Admin Authentication Usage Guide

This guide shows how to use the admin authentication system in the United Album application.

## Setup

1. **Set Admin Password**

Add to your `.env` file:
```env
ADMIN_PASSWORD=your-secure-password-here
```

## Client-Side Usage

### 1. Login to Get Admin Token

```javascript
async function loginAsAdmin(password) {
  try {
    const response = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (data.success) {
      // Store token in sessionStorage (expires when browser closes)
      sessionStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('admin_token_expiry', Date.now() + data.expiresIn);

      console.log('Admin login successful');
      return true;
    } else {
      console.error('Login failed:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

// Usage
const isAuthenticated = await loginAsAdmin('your-password');
```

### 2. Making Authenticated API Requests

```javascript
async function makeAdminRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem('admin_token');

  if (!token) {
    throw new Error('No admin token found. Please login first.');
  }

  // Check if token is expired
  const expiry = parseInt(sessionStorage.getItem('admin_token_expiry'), 10);
  if (Date.now() > expiry) {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token_expiry');
    throw new Error('Admin token has expired. Please login again.');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });

  return response;
}

// Usage examples
const response = await makeAdminRequest('/api/admin/delete-photo', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ photoId: '123' }),
});
```

### 3. Logout

```javascript
function logoutAdmin() {
  sessionStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_token_expiry');
  console.log('Admin logged out');
}
```

### 4. Check if Admin is Logged In

```javascript
function isAdminLoggedIn() {
  const token = sessionStorage.getItem('admin_token');
  const expiry = parseInt(sessionStorage.getItem('admin_token_expiry'), 10);

  if (!token) {
    return false;
  }

  // Check if token is expired
  if (Date.now() > expiry) {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token_expiry');
    return false;
  }

  return true;
}
```

## Server-Side Usage (API Routes)

### Protecting Admin API Routes

```javascript
// app/api/admin/some-protected-route/route.js
import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';

export async function DELETE(request) {
  // Check authentication
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized - Admin access required',
      },
      { status: 401 }
    );
  }

  // Proceed with admin operation
  try {
    // Your admin logic here
    return NextResponse.json({
      success: true,
      message: 'Operation completed',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

### Alternative: Manual Token Verification

```javascript
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/adminAuth';

export async function POST(request) {
  // Get token from Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Continue with admin operation...
}
```

## React Component Example

```jsx
// components/AdminPanel.js
'use client';

import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const token = sessionStorage.getItem('admin_token');
    const expiry = parseInt(sessionStorage.getItem('admin_token_expiry'), 10);

    if (token && Date.now() < expiry) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('admin_token', data.token);
        sessionStorage.setItem('admin_token_expiry', Date.now() + data.expiresIn);
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token_expiry');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <h2>Admin Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      <button onClick={handleLogout}>Logout</button>
      {/* Your admin controls here */}
    </div>
  );
}
```

## Security Considerations

1. **Token Storage**: Tokens are stored in `sessionStorage` which:
   - Clears when the browser tab is closed
   - Is not accessible to other tabs/windows
   - Is more secure than `localStorage` for sensitive data

2. **Token Expiry**: Tokens expire after 24 hours
   - Always check expiry before making requests
   - Implement auto-logout on expiry

3. **HTTPS**: Always use HTTPS in production to protect:
   - Password transmission during login
   - Token transmission in API requests

4. **Password Strength**: Use a strong `ADMIN_PASSWORD`:
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, and symbols
   - Never commit the actual password to git

5. **Rate Limiting**: Consider adding rate limiting to the auth endpoint to prevent brute force attacks

## API Response Examples

### Successful Login
```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...hash_1234567890",
  "expiresIn": 86400000,
  "message": "Authentication successful"
}
```

### Failed Login
```json
{
  "success": false,
  "error": "Invalid password"
}
```

### Unauthorized Access
```json
{
  "success": false,
  "error": "Unauthorized - Admin access required"
}
```
