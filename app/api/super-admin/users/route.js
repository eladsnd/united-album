/**
 * Super Admin User Management API Route
 *
 * Create and manage users (event admins, guests).
 * Super admin only.
 *
 * Endpoints:
 * - GET /api/super-admin/users - List all users
 * - POST /api/super-admin/users - Create new user (event admin or guest)
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { ValidationError } from '@/lib/api/errors';
import { AuthService } from '@/lib/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/super-admin/users
 *
 * List all users with their assigned events
 *
 * Query params:
 * - role: Optional - Filter by role (SUPER_ADMIN, EVENT_ADMIN, GUEST)
 *
 * Response:
 * {
 *   success: true,
 *   users: [{
 *     id, email, name, role, createdAt,
 *     adminOfEvents: [{ eventId, eventName }],
 *     photoCount: 0
 *   }, ...]
 * }
 */
async function handleGetUsers(request) {
  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get('role');

  const where = roleFilter ? { role: roleFilter } : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      adminOfEvents: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      _count: {
        select: {
          photos: true,
        },
      },
    },
  });

  const usersWithStats = users.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    adminOfEvents: user.adminOfEvents.map(ea => ({
      eventId: ea.event.id,
      eventName: ea.event.name,
      eventSlug: ea.event.slug,
      assignedAt: ea.createdAt,
    })),
    photoCount: user._count.photos,
  }));

  console.log(`[SuperAdmin] Listed ${usersWithStats.length} users`);

  return NextResponse.json({
    success: true,
    users: usersWithStats,
  });
}

/**
 * POST /api/super-admin/users
 *
 * Create a new user (event admin or guest)
 *
 * Request body:
 * {
 *   email: "admin@example.com",
 *   password: "securePassword123",
 *   role: "EVENT_ADMIN",              // SUPER_ADMIN, EVENT_ADMIN, or GUEST
 *   name: "John Doe",                 // Optional
 *   assignToEvents: ["event-id-1", "event-id-2"]  // Optional - auto-assign to events
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "User created successfully",
 *   user: {
 *     id, email, name, role, createdAt
 *   },
 *   assignedEvents: [{ eventId, eventName }]
 * }
 */
async function handleCreateUser(request) {
  const body = await request.json();
  const {
    email,
    password,
    role = 'GUEST',
    name,
    assignToEvents = [],
  } = body;

  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Validate role
  const validRoles = ['SUPER_ADMIN', 'EVENT_ADMIN', 'GUEST'];
  if (!validRoles.includes(role)) {
    throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Prevent creating multiple super admins (use /setup route instead)
  if (role === 'SUPER_ADMIN') {
    const existingSuperAdmins = await prisma.user.count({
      where: { role: 'SUPER_ADMIN' },
    });

    if (existingSuperAdmins > 0) {
      throw new ValidationError(
        'Super admin already exists. Use /api/super-admin/setup for first-time setup only.'
      );
    }
  }

  console.log(`[SuperAdmin] Creating user: ${email} (${role})`);

  const authService = new AuthService();
  const userRepo = new UserRepository();

  try {
    // Create user
    const { user } = await authService.createUser(email, password, role, name);
    console.log(`[SuperAdmin] User created: ${user.email} (${user.id})`);

    // Assign to events if provided
    const assignedEvents = [];
    if (assignToEvents.length > 0 && role === 'EVENT_ADMIN') {
      for (const eventId of assignToEvents) {
        // Verify event exists
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, name: true },
        });

        if (!event) {
          console.warn(`[SuperAdmin] Event not found: ${eventId}, skipping assignment`);
          continue;
        }

        // Assign user to event
        await userRepo.assignToEvent(user.id, eventId);
        assignedEvents.push({
          eventId: event.id,
          eventName: event.name,
        });
        console.log(`[SuperAdmin] Assigned ${user.email} to event ${event.name}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user,
      assignedEvents,
    });
  } catch (error) {
    // Handle duplicate email
    if (error.message.includes('Email already exists')) {
      throw new ValidationError('Email already exists');
    }

    throw error;
  }
}

// Apply decorators - super admin only
export const GET = withApi(handleGetUsers, { adminOnly: true });
export const POST = withApi(handleCreateUser, { adminOnly: true });
