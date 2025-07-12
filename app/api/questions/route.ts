/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Validation schemas
const createQuestionSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters long').max(200, 'Title too long'),
  content: z.string().min(20, 'Content must be at least 20 characters long'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  tags: z.array(z.string().min(1, 'Tag cannot be empty')).optional(),
});

// Helper function to verify JWT and get user - Fixed to match signin API pattern
async function verifyTokenAndGetUser(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return null;
    }

    // Verify JWT token first
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as any;
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return null;
    }

    // Check if session exists in database using the token
    // This matches exactly how signin API stores and retrieves sessions
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
      return null;
    }

    // Return user data with custom roles - matches signin API structure
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      image: session.user.image,
      emailVerified: session.user.emailVerified,
      customRoles: session.user.userRoles.map(ur => ur.role.name)
    };

  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// GET /api/questions - List questions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (tag) {
      where.questionTags = {
        some: {
          tag: {
            name: { equals: tag, mode: 'insensitive' }
          }
        }
      };
    }

    // Build orderBy clause
    let orderBy: any = {};
    
    if (sortBy === 'votes') {
      // For vote sorting, we'll sort by the aggregated vote count
      orderBy = [
        { votes: { _count: sortOrder } },
        { createdAt: 'desc' } // Secondary sort
      ];
    } else if (sortBy === 'comments') {
      // For comment sorting, we'll sort by the aggregated comment count
      orderBy = [
        { comments: { _count: sortOrder } },
        { createdAt: 'desc' } // Secondary sort
      ];
    } else {
      // For other fields like createdAt, title
      orderBy = { [sortBy]: sortOrder };
    }

    const [questions, totalCount] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true
            }
          },
          questionTags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          comments: {
            select: {
              id: true
            }
          },
          votes: {
            select: {
              id: true,
              value: true
            }
          },
          _count: {
            select: {
              comments: true,
              votes: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.question.count({ where })
    ]);

    // Transform the data to match frontend expectations
    const transformedQuestions = questions.map((question: any) => ({
      id: question.id,
      title: question.title,
      content: question.content,
      votes: question.votes.reduce((sum: number, vote: any) => sum + vote.value, 0), // Calculate vote score
      comments: question._count.comments, // Use comment count from _count
      tags: question.questionTags?.map((qt: any) => qt.tag.name) || [], // Extract tag names from questionTags
      author: {
        id: question.author.id,
        name: question.author.name,
        avatar: question.author.image // Map image to avatar
      },
      createdAt: question.createdAt.toISOString() // Ensure it's a string
    }));

    const totalPages = Math.ceil(totalCount / limit);

    // Return data in the format expected by frontend
    return NextResponse.json({
      questions: transformedQuestions,
      total: totalCount,
      page,
      totalPages
    });

  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/questions - Create a new question
export async function POST(request: NextRequest) {
  try {
    const user = await verifyTokenAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate input using Zod schema
    const validationResult = createQuestionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { title, content, imageUrl, tags } = validationResult.data;

    // Create the question first
    const question = await prisma.question.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl || null,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true
          }
        },
        questionTags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            votes: true
          }
        }
      }
    });

    // Process tags - create new ones if they don't exist and create QuestionTag relations
    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        if (typeof tagName === 'string' && tagName.trim()) {
          // Create or get existing tag
          const tag = await prisma.tag.upsert({
            where: { name: tagName.trim().toLowerCase() },
            update: {},
            create: { name: tagName.trim().toLowerCase() }
          });
          
          // Create QuestionTag relation
          await prisma.questionTag.create({
            data: {
              questionId: question.id,
              tagId: tag.id
            }
          });
        }
      }
    }

    // Fetch the question again with all relations to get the tags
    const questionWithTags = await prisma.question.findUnique({
      where: { id: question.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true
          }
        },
        questionTags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            votes: true
          }
        }
      }
    });

    // Transform the created question to match frontend expectations
    const transformedQuestion = {
      id: questionWithTags!.id,
      title: questionWithTags!.title,
      content: questionWithTags!.content,
      votes: 0, // New question starts with 0 votes
      comments: 0, // New question starts with 0 comments
      tags: questionWithTags!.questionTags?.map((qt: any) => qt.tag.name) || [],
      author: {
        id: questionWithTags!.author.id,
        name: questionWithTags!.author.name,
        avatar: questionWithTags!.author.image
      },
      createdAt: questionWithTags!.createdAt.toISOString()
    };

    return NextResponse.json({
      message: 'Question created successfully',
      question: transformedQuestion
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/questions/[id] - Update a question
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyTokenAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For now, return method not implemented
    return NextResponse.json(
      { error: 'Method not implemented yet' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/questions/[id] - Delete a question
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyTokenAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For now, return method not implemented
    return NextResponse.json(
      { error: 'Method not implemented yet' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}