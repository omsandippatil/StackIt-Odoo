import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma' // Adjust path as needed
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key'

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

// Helper function to verify JWT and get user
async function verifyTokenAndGetUser(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    return null
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // Check if session exists and is valid
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            emailVerified: true
          }
        }
      }
    })

    if (!session || session.expires < new Date()) {
      // Clean up expired session
      if (session) {
        await prisma.session.delete({
          where: { sessionToken: token }
        })
      }
      return null
    }

    return session.user
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

// GET /api/auth/me
// Return current authenticated user with related data
export async function GET(request: NextRequest) {
  try {
    const user = await verifyTokenAndGetUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
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

    if (!fullUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Return user data with proper structure
    const { password, ...userWithoutPassword } = fullUser
    
    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        customRoles: fullUser.userRoles.map((ur) => ur.role),
        stats: {
          questionsCount: fullUser._count.questions,
          commentsCount: fullUser._count.comments,
          votesCount: fullUser._count.votes,
          unreadNotifications: fullUser._count.notifications,
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
    const user = await verifyTokenAndGetUser(request)
    
    if (!user) {
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
          id: { not: user.id }
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
      where: { id: user.id },
      data: updateData,
      include: {
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

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        ...userWithoutPassword,
        customRoles: updatedUser.userRoles.map((ur) => ur.role),
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
    const user = await verifyTokenAndGetUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    // Get current user with password
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!fullUser || !fullUser.password) {
      return NextResponse.json(
        { error: 'User not found or no password set' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, fullUser.password)
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
      where: { id: user.id },
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
    const user = await verifyTokenAndGetUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const hardDelete = url.searchParams.get('hard') === 'true'

    if (hardDelete) {
      // Hard delete - permanently remove user and all related data
      await prisma.$transaction(async (tx) => {
        // Delete in order to respect foreign key constraints
        await tx.notification.deleteMany({ where: { userId: user.id } })
        await tx.vote.deleteMany({ where: { userId: user.id } })
        await tx.comment.deleteMany({ where: { authorId: user.id } })
        await tx.question.deleteMany({ where: { authorId: user.id } })
        await tx.userRole.deleteMany({ where: { userId: user.id } })
        await tx.account.deleteMany({ where: { userId: user.id } })
        await tx.session.deleteMany({ where: { userId: user.id } })
        await tx.user.delete({ where: { id: user.id } })
      })
    } else {
      // Soft delete - mark user as deleted but keep data
      await prisma.user.update({
        where: { id: user.id },
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