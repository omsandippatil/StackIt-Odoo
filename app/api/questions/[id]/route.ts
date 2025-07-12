import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed

const prisma = new PrismaClient();

// GET /api/questions - Get all questions (with optional filters)
// GET /api/questions/[id] - Get a specific question
export async function GET(
  request: NextRequest,
  { params }: { params?: { id?: string } }
) {
  try {
    // If no ID provided, fetch all questions
    if (!params?.id) {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const sortBy = searchParams.get('sortBy') || 'createdAt';
      const sortOrder = searchParams.get('sortOrder') || 'desc';
      const search = searchParams.get('search');
      const tag = searchParams.get('tag');
      const authorId = searchParams.get('authorId');

      // Validate pagination
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page
      const skip = (validatedPage - 1) * validatedLimit;

      // Build where clause
      const where: any = {};
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      if (tag) {
        where.tags = {
          some: {
            name: { equals: tag, mode: 'insensitive' }
          }
        };
      }
      
      if (authorId) {
        where.authorId = authorId;
      }

      // Build orderBy
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
                email: true,
                image: true,
              }
            },
            tags: true,
            _count: {
              select: {
                comments: true,
                votes: true,
              }
            }
          },
          orderBy,
          skip,
          take: validatedLimit,
        }),
        prisma.question.count({ where })
      ]);

      const totalPages = Math.ceil(totalCount / validatedLimit);
      const hasNextPage = validatedPage < totalPages;
      const hasPreviousPage = validatedPage > 1;

      return NextResponse.json({
        questions,
        pagination: {
          currentPage: validatedPage,
          totalPages,
          totalCount,
          hasNextPage,
          hasPreviousPage,
          limit: validatedLimit
        }
      });
    }

    // Get specific question by ID
    const questionId = parseInt(params.id);
    
    if (isNaN(questionId)) {
      return NextResponse.json(
        { error: 'Invalid question ID' },
        { status: 400 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        tags: true,
        _count: {
          select: {
            comments: true,
            votes: true,
          }
        }
      }
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/questions/[id] - Update a question
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const questionId = parseInt(params.id);
    
    if (isNaN(questionId)) {
      return NextResponse.json(
        { error: 'Invalid question ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, content, imageUrl, tags } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Check if question exists and user owns it
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
      include: { author: true }
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Check if user owns the question or is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (existingQuestion.authorId !== session.user.id && user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - You can only edit your own questions' },
        { status: 403 }
      );
    }

    // Handle tags if provided
    let tagConnections = undefined;
    if (tags && Array.isArray(tags)) {
      // First, disconnect all existing tags
      await prisma.question.update({
        where: { id: questionId },
        data: {
          tags: {
            set: []
          }
        }
      });

      // Create or connect tags
      const tagPromises = tags.map(async (tagName: string) => {
        return prisma.tag.upsert({
          where: { name: tagName },
          create: { name: tagName },
          update: {}
        });
      });

      const createdTags = await Promise.all(tagPromises);
      tagConnections = {
        connect: createdTags.map(tag => ({ id: tag.id }))
      };
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        title,
        content,
        imageUrl,
        ...(tagConnections && { tags: tagConnections })
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        },
        tags: true,
        _count: {
          select: {
            comments: true,
            votes: true,
          }
        }
      }
    });

    return NextResponse.json(updatedQuestion);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/questions/[id] - Delete a question
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const questionId = parseInt(params.id);
    
    if (isNaN(questionId)) {
      return NextResponse.json(
        { error: 'Invalid question ID' },
        { status: 400 }
      );
    }

    // Check if question exists and user owns it
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
      include: { author: true }
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Check if user owns the question or is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (existingQuestion.authorId !== session.user.id && user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own questions' },
        { status: 403 }
      );
    }

    // Delete related data first (due to foreign key constraints)
    await prisma.$transaction([
      // Delete votes
      prisma.vote.deleteMany({
        where: { questionId: questionId }
      }),
      // Delete comments
      prisma.comment.deleteMany({
        where: { questionId: questionId }
      }),
      // Delete notifications related to this question
      prisma.notification.deleteMany({
        where: {
          OR: [
            { message: { contains: `question ${questionId}` } },
            { message: { contains: existingQuestion.title } }
          ]
        }
      }),
      // Finally delete the question
      prisma.question.delete({
        where: { id: questionId }
      })
    ]);

    return NextResponse.json(
      { message: 'Question deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}