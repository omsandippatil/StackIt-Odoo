/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path as needed

const prisma = new PrismaClient();

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
      where.tags = {
        some: {
          name: { equals: tag, mode: 'insensitive' }
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

    // Calculate vote scores and comment counts
    const questionsWithStats = questions.map((question: { votes: any[]; _count: { comments: any; votes: any; }; }) => ({
      ...question,
      voteScore: question.votes.reduce((sum: any, vote: { value: any; }) => sum + vote.value, 0),
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
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, imageUrl, tags } = body;

    // Validation
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    if (title.length < 10) {
      return NextResponse.json(
        { error: 'Title must be at least 10 characters long' },
        { status: 400 }
      );
    }

    if (content.length < 20) {
      return NextResponse.json(
        { error: 'Content must be at least 20 characters long' },
        { status: 400 }
      );
    }

    // Process tags - create new ones if they don't exist
    const tagConnections = [];
    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        if (typeof tagName === 'string' && tagName.trim()) {
          const tag = await prisma.tag.upsert({
            where: { name: tagName.trim().toLowerCase() },
            update: {},
            create: { name: tagName.trim().toLowerCase() }
          });
          tagConnections.push({ id: tag.id });
        }
      }
    }

    // Create the question
    const question = await prisma.question.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl || null,
        authorId: session.user.id,
        tags: {
          connect: tagConnections
        }
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
      question: {
        ...question,
        voteScore: 0,
        commentCount: 0,
        voteCount: 0
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}