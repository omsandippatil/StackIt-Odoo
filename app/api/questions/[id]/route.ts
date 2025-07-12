/* eslint-disable @typescript-eslint/no-explicit-any */
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
        where.questionTags = {
          some: {
            tag: {
              name: { equals: tag, mode: 'insensitive' }
            }
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
            questionTags: {
              include: {
                tag: true
              }
            },
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

      // Transform the response to match expected format
      const transformedQuestions = questions.map(question => ({
        ...question,
        tags: question.questionTags.map((qt: any) => qt.tag),
        questionTags: undefined // Remove from response
      }));

      const totalPages = Math.ceil(totalCount / validatedLimit);
      const hasNextPage = validatedPage < totalPages;
      const hasPreviousPage = validatedPage > 1;

      return NextResponse.json({
        questions: transformedQuestions,
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
        questionTags: {
          include: {
            tag: true
          }
        },
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

    // Transform the response to match expected format
    const transformedQuestion = {
      ...question,
      tags: question.questionTags.map((qt: any) => qt.tag),
      questionTags: undefined // Remove from response
    };

    return NextResponse.json(transformedQuestion);
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

    // Use transaction to update question and handle tags
    const updatedQuestion = await prisma.$transaction(async (tx) => {
      // Update the question
      const updated = await tx.question.update({
        where: { id: questionId },
        data: {
          title,
          content,
          imageUrl,
        }
      });

      // Handle tags if provided
      if (tags && Array.isArray(tags)) {
        // Delete existing question tags
        await tx.questionTag.deleteMany({
          where: { questionId: questionId }
        });

        // Create or find tags and create question tags
        if (tags.length > 0) {
          const tagPromises = tags.map(async (tagName: string) => {
            const tag = await tx.tag.upsert({
              where: { name: tagName },
              create: { name: tagName },
              update: {}
            });
            
            return tx.questionTag.create({
              data: {
                questionId: questionId,
                tagId: tag.id
              }
            });
          });

          await Promise.all(tagPromises);
        }
      }

      return updated;
    });

    // Fetch the updated question with all relations
    const questionWithRelations = await prisma.question.findUnique({
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
        questionTags: {
          include: {
            tag: true
          }
        },
        _count: {
          select: {
            comments: true,
            votes: true,
          }
        }
      }
    });

    // Transform the response to match expected format
    const transformedQuestion = {
      ...questionWithRelations,
      tags: questionWithRelations?.questionTags.map((qt: any) => qt.tag) || [],
      questionTags: undefined // Remove from response
    };

    return NextResponse.json(transformedQuestion);
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
      // Delete question tags
      prisma.questionTag.deleteMany({
        where: { questionId: questionId }
      }),
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