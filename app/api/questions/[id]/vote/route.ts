import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path as needed

const prisma = new PrismaClient();

interface VoteRequestBody {
  value: number; // 1 for upvote, -1 for downvote
}

// GET /api/questions/[id]/vote
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const questionId = parseInt(params.id);
    
    if (isNaN(questionId)) {
      return NextResponse.json(
        { error: 'Invalid question ID' },
        { status: 400 }
      );
    }

    // Check if question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Get vote statistics
    const voteStats = await prisma.vote.groupBy({
      by: ['value'],
      where: { questionId },
      _count: {
        value: true,
      },
    });

    // Calculate total score and vote counts
    let upvotes = 0;
    let downvotes = 0;
    let totalScore = 0;

    voteStats.forEach((stat) => {
      if (stat.value === 1) {
        upvotes = stat._count.value;
        totalScore += stat._count.value;
      } else if (stat.value === -1) {
        downvotes = stat._count.value;
        totalScore -= stat._count.value;
      }
    });

    // Get user's vote if authenticated
    const session = await getServerSession(authOptions);
    let userVote = null;
    
    if (session?.user?.id) {
      const vote = await prisma.vote.findUnique({
        where: {
          questionId_userId: {
            questionId,
            userId: session.user.id,
          },
        },
      });
      userVote = vote?.value || null;
    }

    return NextResponse.json({
      questionId,
      totalScore,
      upvotes,
      downvotes,
      userVote,
    });

  } catch (error) {
    console.error('Error fetching vote data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/questions/[id]/vote
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
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

    const body: VoteRequestBody = await request.json();
    
    // Validate vote value
    if (body.value !== 1 && body.value !== -1) {
      return NextResponse.json(
        { error: 'Vote value must be 1 (upvote) or -1 (downvote)' },
        { status: 400 }
      );
    }

    // Check if question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Prevent users from voting on their own questions
    if (question.authorId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot vote on your own question' },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Check if user has already voted
    const existingVote = await prisma.vote.findUnique({
      where: {
        questionId_userId: {
          questionId,
          userId,
        },
      },
    });

    let updatedVote;

    if (existingVote) {
      if (existingVote.value === body.value) {
        // Same vote - remove it (toggle behavior)
        await prisma.vote.delete({
          where: {
            questionId_userId: {
              questionId,
              userId,
            },
          },
        });
        updatedVote = null;
      } else {
        // Different vote - update it
        updatedVote = await prisma.vote.update({
          where: {
            questionId_userId: {
              questionId,
              userId,
            },
          },
          data: {
            value: body.value,
          },
        });
      }
    } else {
      // No existing vote - create new one
      updatedVote = await prisma.vote.create({
        data: {
          questionId,
          userId,
          value: body.value,
        },
      });
    }

    // Get updated vote statistics
    const voteStats = await prisma.vote.groupBy({
      by: ['value'],
      where: { questionId },
      _count: {
        value: true,
      },
    });

    let upvotes = 0;
    let downvotes = 0;
    let totalScore = 0;

    voteStats.forEach((stat) => {
      if (stat.value === 1) {
        upvotes = stat._count.value;
        totalScore += stat._count.value;
      } else if (stat.value === -1) {
        downvotes = stat._count.value;
        totalScore -= stat._count.value;
      }
    });

    return NextResponse.json({
      questionId,
      totalScore,
      upvotes,
      downvotes,
      userVote: updatedVote?.value || null,
      message: updatedVote 
        ? `Question ${body.value === 1 ? 'upvoted' : 'downvoted'} successfully`
        : 'Vote removed successfully',
    });

  } catch (error) {
    console.error('Error processing vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}