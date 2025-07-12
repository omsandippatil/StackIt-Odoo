import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const questionId = parseInt(params.id);

    // Validate question ID
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

    // Fetch comments with nested replies
    const comments = await prisma.comment.findMany({
      where: {
        questionId: questionId,
        parentId: null, // Only get top-level comments
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
                replies: {
                  include: {
                    author: {
                      select: {
                        id: true,
                        name: true,
                        image: true,
                      },
                    },
                    replies: true, // Add more levels if needed
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Alternative recursive approach for unlimited nesting
    // Uncomment this if you need unlimited nesting depth
    /*
    const getAllComments = async (questionId: number) => {
      const allComments = await prisma.comment.findMany({
        where: { questionId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Build nested structure
      const commentMap = new Map();
      const rootComments: any[] = [];

      allComments.forEach(comment => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      allComments.forEach(comment => {
        const commentWithReplies = commentMap.get(comment.id);
        if (comment.parentId) {
          const parent = commentMap.get(comment.parentId);
          if (parent) {
            parent.replies.push(commentWithReplies);
          }
        } else {
          rootComments.push(commentWithReplies);
        }
      });

      return rootComments.reverse(); // Most recent first
    };

    const comments = await getAllComments(questionId);
    */

    return NextResponse.json({
      success: true,
      data: {
        questionId,
        comments,
        totalComments: await prisma.comment.count({
          where: { questionId },
        }),
      },
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Add POST method to create new comments
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const questionId = parseInt(params.id);
    const body = await request.json();
    const { content, authorId, parentId } = body;

    // Validate required fields
    if (!content || !authorId) {
      return NextResponse.json(
        { error: 'Content and authorId are required' },
        { status: 400 }
      );
    }

    // Validate question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // If parentId is provided, validate parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment || parentComment.questionId !== questionId) {
        return NextResponse.json(
          { error: 'Parent comment not found or does not belong to this question' },
          { status: 400 }
        );
      }
    }

    // Create the comment and notifications in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the comment
      const comment = await tx.comment.create({
        data: {
          body: content,
          authorId,
          questionId,
          parentId: parentId || null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      // Create notifications
      const notifications = [];

      if (parentId) {
        // This is a reply to another comment
        const parentComment = await tx.comment.findUnique({
          where: { id: parentId },
          include: { author: true },
        });

        if (parentComment && parentComment.authorId !== authorId) {
          // Notify the parent comment author
          notifications.push({
            type: 'COMMENT_REPLY',
            message: `${comment.author.name || 'Someone'} replied to your comment`,
            userId: parentComment.authorId,
          });
        }
      } else {
        // This is a comment on the question
        const question = await tx.question.findUnique({
          where: { id: questionId },
          include: { author: true },
        });

        if (question && question.authorId !== authorId) {
          // Notify the question author
          notifications.push({
            type: 'QUESTION_COMMENT',
            message: `${comment.author.name || 'Someone'} commented on your question`,
            userId: question.authorId,
          });
        }
      }

      // Create all notifications
      if (notifications.length > 0) {
        await tx.notification.createMany({
          data: notifications,
        });
      }

      return comment;
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}