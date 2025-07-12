/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth' // Adjust path as needed
import { prisma } from '@/lib/prisma' // Adjust path as needed
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Validation schemas
const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  image: z.string().url('Invalid image URL').optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
})

// GET /api/auth/me
// Return current authenticated user with related data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        _count: {
          select: {
            questions: true,
            comments: true,
            votes: true,
            notifications: {
              where: {
                isRead: false
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        ...user,
        customRoles: user.userRoles.map((ur: { role: any }) => ur.role),
        stats: {
          questionsCount: user._count.questions,
          commentsCount: user._count.comments,
          votesCount: user._count.votes,
          unreadNotifications: user._count.notifications,
        }
      }
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/auth/me
// Update user profile information
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedData = updateUserSchema.parse(body)
    
    // Check if email is being updated and if it's already taken
    if (validatedData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          id: { not: session.user.id }
        }
      })
      
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        )
      }
    }

    // Hash password if provided
    let updateData: any = { ...validatedData }
    if (validatedData.password) {
      updateData.password = await bcrypt.hash(validatedData.password, 12)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        emailVerified: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        customRoles: updatedUser.userRoles.map((ur: { role: any }) => ur.role),
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/auth/me
// Update specific user fields (alternative to POST)
export async function PUT(request: NextRequest) {
  return POST(request) // Reuse POST logic
}

// PATCH /api/auth/me/password
// Change user password (with current password verification)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true }
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'User not found or no password set' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedNewPassword }
    })

    return NextResponse.json({
      message: 'Password updated successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    
    console.error('Error updating password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/auth/me
// Delete user account (soft delete or hard delete)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const hardDelete = url.searchParams.get('hard') === 'true'

    if (hardDelete) {
      // Hard delete - permanently remove user and all related data
      await prisma.$transaction(async (tx: { notification: { deleteMany: (arg0: { where: { userId: string } }) => any }; vote: { deleteMany: (arg0: { where: { userId: string } }) => any }; comment: { deleteMany: (arg0: { where: { authorId: string } }) => any }; question: { deleteMany: (arg0: { where: { authorId: string } }) => any }; userRole: { deleteMany: (arg0: { where: { userId: string } }) => any }; account: { deleteMany: (arg0: { where: { userId: string } }) => any }; session: { deleteMany: (arg0: { where: { userId: string } }) => any }; user: { delete: (arg0: { where: { id: string } }) => any } }) => {
        // Delete in order to respect foreign key constraints
        await tx.notification.deleteMany({ where: { userId: session.user.id } })
        await tx.vote.deleteMany({ where: { userId: session.user.id } })
        await tx.comment.deleteMany({ where: { authorId: session.user.id } })
        await tx.question.deleteMany({ where: { authorId: session.user.id } })
        await tx.userRole.deleteMany({ where: { userId: session.user.id } })
        await tx.account.deleteMany({ where: { userId: session.user.id } })
        await tx.session.deleteMany({ where: { userId: session.user.id } })
        await tx.user.delete({ where: { id: session.user.id } })
      })
    } else {
      // Soft delete - mark user as deleted but keep data
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          email: null,
          name: 'Deleted User',
          image: null,
          password: null,
          emailVerified: null,
        }
      })
    }

    return NextResponse.json({
      message: hardDelete ? 'Account permanently deleted' : 'Account deactivated'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}