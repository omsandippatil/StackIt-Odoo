import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema for signin
const signinSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper function to get JWT expiration as number (seconds)
function getJwtExpirationSeconds(): number {
  const expiration = JWT_EXPIRES_IN;
  
  // If it's already a number string, convert to number
  if (/^\d+$/.test(expiration)) {
    return parseInt(expiration, 10);
  }
  
  // Convert common time formats to seconds
  const timeMap: { [key: string]: number } = {
    's': 1,
    'm': 60,
    'h': 3600,
    'd': 86400,
    'w': 604800,
    'y': 31536000
  };
  
  const match = expiration.match(/^(\d+)([smhdwy])$/);
  if (match) {
    const [, value, unit] = match;
    return parseInt(value, 10) * timeMap[unit];
  }
  
  // Default to 7 days if format is invalid
  return 604800; // 7 days in seconds
}

// POST /api/auth/signin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = signinSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        image: true,
        emailVerified: true,
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user has a password (for OAuth users)
    if (!user.password) {
      return NextResponse.json(
        { error: 'Please sign in with your social account' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create JWT token
    const payload = { 
      userId: user.id,
      email: user.email,
      role: user.role,
      customRoles: user.userRoles.map(ur => ur.role.name)
    };
    
    // Get expiration time in seconds
    const expirationInSeconds = getJwtExpirationSeconds();
    
    const token = jwt.sign(payload, JWT_SECRET as string, { 
      expiresIn: expirationInSeconds
    });

    // Create session in database
    const session = await prisma.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires: new Date(Date.now() + expirationInSeconds * 1000), // Convert to milliseconds
      }
    });

    // Prepare user data for response (exclude password)
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
      emailVerified: user.emailVerified,
      customRoles: user.userRoles.map(ur => ur.role.name)
    };

    // Create response with HTTP-only cookie
    const response = NextResponse.json(
      {
        success: true,
        message: 'Sign in successful',
        user: userData,
        token // Optional: remove if using only HTTP-only cookies
      },
      { status: 200 }
    );

    // Set HTTP-only cookie for session
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expirationInSeconds, // Use the same expiration time
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/auth/signin
export async function GET(request: NextRequest) {
  try {
    // Check if user is already authenticated
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { 
          authenticated: false,
          message: 'No authentication token found'
        },
        { status: 401 }
      );
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { 
          authenticated: false,
          error: 'Invalid or expired token'
        },
        { status: 401 }
      );
    }

    // Check if session exists in database
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
            emailVerified: true,
            userRoles: {
              include: {
                role: true
              }
            }
          }
        }
      }
    });

    if (!session || session.expires < new Date()) {
      // Clean up expired session
      if (session) {
        await prisma.session.delete({
          where: { sessionToken: token }
        });
      }

      const response = NextResponse.json(
        { 
          authenticated: false,
          error: 'Session expired'
        },
        { status: 401 }
      );

      // Clear the cookie
      response.cookies.delete('auth-token');
      return response;
    }

    // Return user data
    const userData = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      image: session.user.image,
      emailVerified: session.user.emailVerified,
      customRoles: session.user.userRoles.map(ur => ur.role.name)
    };

    return NextResponse.json(
      {
        authenticated: true,
        user: userData,
        sessionId: session.id,
        expiresAt: session.expires
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}