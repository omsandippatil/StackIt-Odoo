/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust import path as needed

const prisma = new PrismaClient();

// Helper function to check if user is admin
async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return false;
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });
  
  return user?.role === 'ADMIN';
}

// GET /api/admin/questions
// Admin list and manage questions
export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    if (!(await isAdmin(req))) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const authorId = searchParams.get('authorId');
    const tagId = searchParams.get('tagId');

    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { author: { name: { contains: search, mode: 'insensitive' } } },
        { author: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (authorId) {
      whereClause.authorId = authorId;
    }

    if (tagId) {
      whereClause.tags = {
        some: { id: parseInt(tagId) }
      };
    }

    // Get questions with related data
    const questions = await prisma.question.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder as 'asc' | 'desc'
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        tags: {
          select: {
            id: true,
            name: true
          }
        },
        comments: {
          select: {
            id: true
          }
        },
        votes: {
          select: {
            value: true
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

    // Get total count for pagination
    const totalCount = await prisma.question.count({
      where: whereClause
    });

    // Calculate vote scores and format response
    const questionsWithStats = questions.map((question: { _count: { comments: any; votes: any; }; votes: any[]; }) => ({
      ...question,
      commentCount: question._count.comments,
      voteCount: question._count.votes,
      voteScore: question.votes.reduce((sum: any, vote: { value: any; }) => sum + vote.value, 0),
      votes: undefined, // Remove votes array from response
      _count: undefined // Remove _count from response
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      questions: questionsWithStats,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/questions
// Admin create a new question
export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    if (!(await isAdmin(req))) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, content, imageUrl, authorId, tagIds } = body;

    // Validate required fields
    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: 'Title, content, and authorId are required' },
        { status: 400 }
      );
    }

    // Verify author exists
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true }
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
    }

    // Verify tags exist if provided
    if (tagIds && tagIds.length > 0) {
      const existingTags = await prisma.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true }
      });

      if (existingTags.length !== tagIds.length) {
        return NextResponse.json(
          { error: 'One or more tags not found' },
          { status: 404 }
        );
      }
    }

    // Create the question
    const question = await prisma.question.create({
      data: {
        title,
        content,
        imageUrl,
        authorId,
        tags: tagIds ? {
          connect: tagIds.map((id: number) => ({ id }))
        } : undefined
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        tags: {
          select: {
            id: true,
            name: true
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

    return NextResponse.json({
      message: 'Question created successfully',
      question: {
        ...question,
        commentCount: question._count.comments,
        voteCount: question._count.votes,
        voteScore: 0,
        _count: undefined
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/questions
// Admin update a question
export async function PUT(req: NextRequest) {
  try {
    // Check admin authorization
    if (!(await isAdmin(req))) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, title, content, imageUrl, tagIds } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Check if question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id: parseInt(id) },
      select: { id: true }
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Verify tags exist if provided
    if (tagIds && tagIds.length > 0) {
      const existingTags = await prisma.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true }
      });

      if (existingTags.length !== tagIds.length) {
        return NextResponse.json(
          { error: 'One or more tags not found' },
          { status: 404 }
        );
      }
    }

    // Update the question
    const question = await prisma.question.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(tagIds && {
          tags: {
            set: [], // Clear existing tags
            connect: tagIds.map((tagId: number) => ({ id: tagId }))
          }
        })
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        tags: {
          select: {
            id: true,
            name: true
          }
        },
        votes: {
          select: {
            value: true
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

    return NextResponse.json({
      message: 'Question updated successfully',
      question: {
        ...question,
        commentCount: question._count.comments,
        voteCount: question._count.votes,
        voteScore: question.votes.reduce((sum: any, vote: { value: any; }) => sum + vote.value, 0),
        votes: undefined,
        _count: undefined
      }
    });

  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/questions
// Admin delete a question
export async function DELETE(req: NextRequest) {
  try {
    // Check admin authorization
    if (!(await isAdmin(req))) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Check if question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, title: true }
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Delete the question (this will cascade to related records)
    await prisma.question.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({
      message: 'Question deleted successfully',
      deletedQuestion: {
        id: parseInt(id),
        title: existingQuestion.title
      }
    });

  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}