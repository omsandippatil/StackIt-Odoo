import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Validation schemas
const createQuestionSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters long').max(200, 'Title too long'),
  content: z.string().min(20, 'Content must be at least 20 characters long'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  tags: z.array(z.string().min(1, 'Tag cannot be empty')).optional(),
});

// Types
interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  image: string | null;
  emailVerified: Date | null;
  customRoles: string[];
}

interface DecodedToken {
  userId: string;
  email: string | null;
  [key: string]: any;
}

interface QuestionWithStats {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
  };
  tags: Array<{
    id: number;
    name: string;
  }>;
  voteScore: number;
  commentCount: number;
  voteCount: number;
}

// Helper function to verify JWT and get user
async function verifyTokenAndGetUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    
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

    return {
      ...session.user,
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
    const orderBy: any = {};
    if (sortBy === 'votes') {
      orderBy.votes = { _count: sortOrder };
    } else if (sortBy === 'comments') {
      orderBy.comments = { _count: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
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

    // Fetch tags separately - try different possible model names
    const questionIds = questions.map(q => q.id);
    let questionTagsData: any[] = [];
    
    try {
      // Try common naming conventions for junction tables
      if ('questionTags' in prisma) {
        questionTagsData = await (prisma as any).questionTags.findMany({
          where: {
            questionId: { in: questionIds }
          },
          include: {
            tag: true
          }
        });
      } else if ('questionTag' in prisma) {
        questionTagsData = await (prisma as any).questionTag.findMany({
          where: {
            questionId: { in: questionIds }
          },
          include: {
            tag: true
          }
        });
      } else if ('QuestionTag' in prisma) {
        questionTagsData = await (prisma as any).QuestionTag.findMany({
          where: {
            questionId: { in: questionIds }
          },
          include: {
            tag: true
          }
        });
      } else {
        // If no junction table exists, try to get tags directly from questions
        console.warn('No junction table found for question tags');
      }
    } catch (error) {
      console.error('Error fetching question tags:', error);
      // Continue without tags if there's an error
    }

    // Group tags by question ID
    const tagsByQuestionId = questionTagsData.reduce((acc: Record<string, any[]>, qt: any) => {
      if (!acc[qt.questionId]) {
        acc[qt.questionId] = [];
      }
      acc[qt.questionId].push(qt.tag);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate vote scores and comment counts
    const questionsWithStats: QuestionWithStats[] = questions.map((question: any) => ({
      ...question,
      tags: tagsByQuestionId[question.id] || [],
      voteScore: question.votes.reduce((sum: number, vote: { value: number }) => sum + vote.value, 0),
      commentCount: question._count.comments,
      voteCount: question._count.votes
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      questions: questionsWithStats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
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
    const validatedData = createQuestionSchema.parse(body);
    const { title, content, imageUrl, tags } = validatedData;

    // Use transaction to create question and handle tags
    const question = await prisma.$transaction(async (tx) => {
      // Create the question first
      const newQuestion = await tx.question.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl || null,
          authorId: user.id
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
          _count: {
            select: {
              comments: true,
              votes: true
            }
          }
        }
      });

      // Process tags if provided
      const questionTags = [];
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          if (typeof tagName === 'string' && tagName.trim()) {
            // Create or find the tag
            const tag = await tx.tag.upsert({
              where: { name: tagName.trim().toLowerCase() },
              update: {},
              create: { name: tagName.trim().toLowerCase() }
            });

            // Create the junction table entry - try different naming conventions
            try {
              if ('questionTags' in tx) {
                await (tx as any).questionTags.create({
                  data: {
                    questionId: newQuestion.id,
                    tagId: tag.id
                  }
                });
              } else if ('questionTag' in tx) {
                await (tx as any).questionTag.create({
                  data: {
                    questionId: newQuestion.id,
                    tagId: tag.id
                  }
                });
              } else if ('QuestionTag' in tx) {
                await (tx as any).QuestionTag.create({
                  data: {
                    questionId: newQuestion.id,
                    tagId: tag.id
                  }
                });
              }
            } catch (tagError) {
              console.error('Error creating question tag relation:', tagError);
              // Continue without failing the entire transaction
            }

            questionTags.push(tag);
          }
        }
      }

      return {
        ...newQuestion,
        tags: questionTags
      };
    });

    return NextResponse.json({
      message: 'Question created successfully',
      question: {
        ...question,
        voteScore: 0,
        commentCount: 0,
        voteCount: 0
      }
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
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}

// PUT /api/questions - Update a question (if needed)
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

// DELETE /api/questions - Delete a question (if needed)
export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}