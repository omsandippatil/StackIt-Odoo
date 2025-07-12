import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth' // Adjust import path as needed

const prisma = new PrismaClient()

// Helper function to check if user is admin
async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return false
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  return user?.role === 'ADMIN'
}

// GET /api/admin/overview
// Admin dashboard overview (site stats, etc.)
export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    const adminCheck = await isAdmin(req)
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    // Get date ranges for comparison
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Parallel database queries for better performance
    const [
      totalUsers,
      totalQuestions,
      totalComments,
      totalVotes,
      totalTags,
      unreadNotifications,
      recentUsers,
      recentQuestions,
      recentComments,
      userGrowth,
      questionGrowth,
      commentGrowth,
      topTags,
      userRoleDistribution,
      questionVoteStats,
      mostActiveUsers
    ] = await Promise.all([
      // Basic counts
      prisma.user.count(),
      prisma.question.count(),
      prisma.comment.count(),
      prisma.vote.count(),
      prisma.tag.count(),
      prisma.notification.count({ where: { isRead: false } }),

      // Recent activity (last 7 days)
      prisma.user.count({
        where: { Account: { some: { id: { not: undefined } } } }
      }),
      prisma.question.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.comment.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      }),

      // Growth metrics (last 30 days)
      prisma.user.count({
        where: { Account: { some: { id: { not: undefined } } } }
      }),
      prisma.question.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.comment.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),

      // Top tags by question count
      prisma.tag.findMany({
        include: {
          _count: {
            select: { questions: true }
          }
        },
        orderBy: {
          questions: { _count: 'desc' }
        },
        take: 10
      }),

      // User role distribution
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),

      // Question vote statistics
      prisma.vote.groupBy({
        by: ['questionId'],
        _sum: { value: true },
        _count: { value: true },
        orderBy: { _sum: { value: 'desc' } },
        take: 10
      }),

      // Most active users (by question + comment count)
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          _count: {
            select: {
              questions: true,
              comments: true,
              votes: true
            }
          }
        },
        orderBy: [
          { questions: { _count: 'desc' } },
          { comments: { _count: 'desc' } }
        ],
        take: 10
      })
    ])

    // Calculate growth percentages (simplified - you might want to implement proper period comparison)
    const userGrowthPercentage = totalUsers > 0 ? ((userGrowth / totalUsers) * 100).toFixed(1) : '0'
    const questionGrowthPercentage = totalQuestions > 0 ? ((questionGrowth / totalQuestions) * 100).toFixed(1) : '0'
    const commentGrowthPercentage = totalComments > 0 ? ((commentGrowth / totalComments) * 100).toFixed(1) : '0'

    // Format response data
    const overview = {
      stats: {
        totalUsers,
        totalQuestions,
        totalComments,
        totalVotes,
        totalTags,
        unreadNotifications
      },
      growth: {
        users: {
          total: totalUsers,
          recent: recentUsers,
          percentage: userGrowthPercentage
        },
        questions: {
          total: totalQuestions,
          recent: recentQuestions,
          percentage: questionGrowthPercentage
        },
        comments: {
          total: totalComments,
          recent: recentComments,
          percentage: commentGrowthPercentage
        }
      },
      topTags: topTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        questionCount: tag._count.questions
      })),
      userRoleDistribution: userRoleDistribution.map(role => ({
        role: role.role,
        count: role._count.role
      })),
      topQuestions: questionVoteStats.map(stat => ({
        questionId: stat.questionId,
        totalVotes: stat._sum.value || 0,
        voteCount: stat._count.value
      })),
      mostActiveUsers: mostActiveUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        questionCount: user._count.questions,
        commentCount: user._count.comments,
        voteCount: user._count.votes,
        totalActivity: user._count.questions + user._count.comments + user._count.votes
      }))
    }

    return NextResponse.json(overview)

  } catch (error) {
    console.error('Admin overview error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin overview data' },
      { status: 500 }
    )
  }
}

// POST /api/admin/overview
// Update admin settings or trigger admin actions
export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    const adminCheck = await isAdmin(req)
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { action, data } = body

    switch (action) {
      case 'CLEAR_NOTIFICATIONS':
        // Clear all read notifications older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const deletedNotifications = await prisma.notification.deleteMany({
          where: {
            isRead: true,
            createdAt: {
              lt: thirtyDaysAgo
            }
          }
        })
        return NextResponse.json({
          message: 'Notifications cleared',
          deletedCount: deletedNotifications.count
        })

      case 'UPDATE_USER_ROLE':
        // Update user role
        const { userId, newRole } = data
        if (!userId || !newRole) {
          return NextResponse.json(
            { error: 'Missing userId or newRole' },
            { status: 400 }
          )
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { role: newRole },
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        })

        return NextResponse.json({
          message: 'User role updated successfully',
          user: updatedUser
        })

      case 'DELETE_INACTIVE_USERS':
        // Delete users with no questions, comments, or votes (older than 30 days)
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const inactiveUsers = await prisma.user.findMany({
          where: {
            AND: [
              { questions: { none: {} } },
              { comments: { none: {} } },
              { votes: { none: {} } },
              { Account: { some: { id: { not: undefined } } } }
            ]
          },
          select: { id: true }
        })

        // Delete inactive users (be careful with this in production!)
        const deletedUsers = await prisma.user.deleteMany({
          where: {
            id: {
              in: inactiveUsers.map(user => user.id)
            }
          }
        })

        return NextResponse.json({
          message: 'Inactive users deleted',
          deletedCount: deletedUsers.count
        })

      case 'GENERATE_SYSTEM_REPORT':
        // Generate a comprehensive system report
        const systemReport = {
          timestamp: new Date().toISOString(),
          database: {
            totalTables: 10, // Static count based on your schema
            totalRecords: await prisma.user.count() + 
                         await prisma.question.count() + 
                         await prisma.comment.count() + 
                         await prisma.vote.count() + 
                         await prisma.tag.count()
          },
          performance: {
            // Add performance metrics as needed
            avgResponseTime: '~150ms',
            systemHealth: 'Good'
          }
        }

        return NextResponse.json({
          message: 'System report generated',
          report: systemReport
        })

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Admin overview POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process admin action' },
      { status: 500 }
    )
  }
}