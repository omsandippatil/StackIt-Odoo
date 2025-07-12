/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const prisma = new PrismaClient()

// GET /api/users - Get all users with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Debug logging
    console.log('GET Session:', session)
    console.log('GET Session user:', session?.user)
    
    // Check if user is authenticated and has admin role
    if (!session?.user) {
      console.log('GET: No session or user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { role: true }
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {}
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (role && (role === 'USER' || role === 'ADMIN')) {
      whereClause.role = role
    }

    // Get users with pagination
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          image: true,
          emailVerified: true,
          _count: {
            select: {
              questions: true,
              comments: true,
              votes: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      }),
      prisma.user.count({ where: whereClause })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Debug logging
    console.log('POST Session:', session)
    console.log('POST Session user:', session?.user)
    
    // Check if user is authenticated and has admin role
    if (!session?.user) {
      console.log('POST: No session or user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { role: true }
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password, role = 'USER' } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Validate role
    if (role && !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be USER or ADMIN' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as 'USER' | 'ADMIN'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        emailVerified: true
      }
    })

    return NextResponse.json({
      message: 'User created successfully',
      user: newUser
    }, { status: 201 })

  } catch (error) {
    console.error('POST /api/users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}