import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path as needed
import { prisma } from '@/lib/prisma'; // Adjust path as needed
import { z } from 'zod';

// Validation schemas
const createNotificationSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  message: z.string().min(1, 'Message is required'),
  userId: z.string().optional(), // Optional - if not provided, uses current user
});

const markAsReadSchema = z.object({
  notificationIds: z.array(z.number()).optional(),
  markAllAsRead: z.boolean().optional(),
});

// GET /api/notifications
// Get current user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause = {
      userId: session.user.id,
      ...(unreadOnly && { isRead: false }),
    };

    // Get notifications with pagination
    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: skip + limit < totalCount,
        hasPreviousPage: page > 1,
      },
      unreadCount,
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/notifications
// Create a new notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createNotificationSchema.parse(body);

    // If userId is not provided, use current user
    const targetUserId = validatedData.userId || session.user.id;

    // Check if user has permission to create notifications for other users
    if (targetUserId !== session.user.id) {
      // Get current user's role
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (currentUser?.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Cannot create notifications for other users' },
          { status: 403 }
        );
      }
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        type: validatedData.type,
        message: validatedData.message,
        userId: targetUserId,
      },
    });

    return NextResponse.json(notification, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications
// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = markAsReadSchema.parse(body);

    let updateResult;

    if (validatedData.markAllAsRead) {
      // Mark all notifications as read for the current user
      updateResult = await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
    } else if (validatedData.notificationIds && validatedData.notificationIds.length > 0) {
      // Mark specific notifications as read
      // First, verify all notifications belong to the current user
      const notificationCount = await prisma.notification.count({
        where: {
          id: { in: validatedData.notificationIds },
          userId: session.user.id,
        },
      });

      if (notificationCount !== validatedData.notificationIds.length) {
        return NextResponse.json(
          { error: 'Some notifications not found or do not belong to you' },
          { status: 404 }
        );
      }

      updateResult = await prisma.notification.updateMany({
        where: {
          id: { in: validatedData.notificationIds },
          userId: session.user.id,
        },
        data: {
          isRead: true,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Either provide notificationIds or set markAllAsRead to true' },
        { status: 400 }
      );
    }

    // Get updated unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: updateResult.count,
      unreadCount,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications
// Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const notificationIds = searchParams.get('ids')?.split(',').map(Number) || [];
    const deleteAll = searchParams.get('deleteAll') === 'true';

    let deleteResult;

    if (deleteAll) {
      // Delete all notifications for the current user
      deleteResult = await prisma.notification.deleteMany({
        where: {
          userId: session.user.id,
        },
      });
    } else if (notificationIds.length > 0) {
      // Delete specific notifications
      // First, verify all notifications belong to the current user
      const notificationCount = await prisma.notification.count({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
      });

      if (notificationCount !== notificationIds.length) {
        return NextResponse.json(
          { error: 'Some notifications not found or do not belong to you' },
          { status: 404 }
        );
      }

      deleteResult = await prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Either provide notification ids or set deleteAll to true' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
    });

  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}