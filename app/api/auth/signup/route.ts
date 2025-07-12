// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// POST /api/auth/signup - Public signup endpoint
export async function POST(request: NextRequest) {
  try {
    console.log('Signup request received')
    
    let body
    try {
      body = await request.json()
      console.log('Request body:', body)
    } catch (error) {
      console.error('JSON parsing error:', error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { name, email, password } = body

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

    console.log('Checking if user exists...')
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

    console.log('Hashing password...')
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    console.log('Creating user...')
    // Create user (always as USER role for public signup)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER' // Public signup always creates regular users
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

    console.log('User created successfully:', newUser.id)
    return NextResponse.json({
      message: 'User created successfully',
      user: newUser
    }, { status: 201 })

  } catch (error) {
    console.error('POST /api/auth/signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}