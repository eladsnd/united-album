import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '../../../../../lib/adminAuth';
import prisma from '../../../../../lib/prisma';

/**
 * PUT /api/admin/poses/reorder
 * Reorder pose challenges
 *
 * Body: { poses: [{ id: string, order: number }] }
 */
export async function PUT(request) {
    // Check admin authentication
    const authResult = await isAdminAuthenticated(request);
    if (!authResult.authenticated) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { poses } = body;

        if (!poses || !Array.isArray(poses)) {
            return NextResponse.json(
                { success: false, error: 'Invalid poses array' },
                { status: 400 }
            );
        }

        // Update each pose's order in a transaction
        await prisma.$transaction(
            poses.map((pose) =>
                prisma.challenge.update({
                    where: { id: pose.id },
                    data: { order: pose.order },
                })
            )
        );

        console.log('[Reorder API] Successfully reordered', poses.length, 'poses');

        return NextResponse.json({
            success: true,
            message: `Reordered ${poses.length} poses`,
        });
    } catch (error) {
        console.error('[Reorder API] Error reordering poses:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
