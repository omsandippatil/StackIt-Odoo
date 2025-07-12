'use client'

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowUp, 
  ArrowDown, 
  MessageSquare, 
  Calendar, 
  User, 
  Tag,
  Share2,
  BookmarkPlus,
  Flag,
  Edit,
  Trash2,
  Reply,
  MoreVertical
} from 'lucide-react';

interface Author {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface Tag {
  id: number;
  name: string;
}

interface Comment {
  id: number;
  body: string;
  author: Author;
  createdAt: string;
  replies?: Comment[];
  parentId?: number;
}

interface Vote {
  id: number;
  value: number;
  userId: string;
  user: {
    id: string;
    name: string;
  };
}

interface Question {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  author: Author;
  authorId: string;
  createdAt: string;
  comments: Comment[];
  votes: Vote[];
  tags: Tag[];
  _count: {
    comments: number;
    votes: number;
  };
}

const QuestionDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const questionId = params?.id as string;
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [userVote, setUserVote] = useState<{ value: number } | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState<Author | null>(null);

  // Fetch question data
  const fetchQuestion = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Question not found');
        }
        if (response.status === 400) {
          throw new Error('Invalid question ID');
        }
        throw new Error('Failed to fetch question');
      }

      const questionData: Question = await response.json();
      setQuestion(questionData);
      
      // Check if current user has voted
      if (currentUser && questionData.votes) {
        const existingVote = questionData.votes.find(vote => vote.userId === currentUser.id);
        setUserVote(existingVote ? { value: existingVote.value } : null);
      }
      
      // Check if current user is the author
      if (currentUser) {
        setIsAuthor(questionData.authorId === currentUser.id);
      }
    } catch (error) {
      console.error('Error fetching question:', error);
      setError(error instanceof Error ? error.message : 'Failed to load question');
    } finally {
      setLoading(false);
    }
  };

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.log('User not authenticated');
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (questionId) {
      fetchQuestion();
    }
  }, [questionId, currentUser]);

  // Vote handling
  const handleVote = async (value: number) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(`/api/questions/${questionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserVote(data.userVote);
        // Refresh question to get updated vote count
        fetchQuestion();
      } else {
        console.error('Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  // Comment submission
  const handleSubmitComment = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await fetch(`/api/questions/${questionId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          body: newComment,
          parentId: replyingTo,
        }),
      });

      if (response.ok) {
        setNewComment('');
        setReplyingTo(null);
        setReplyText('');
        fetchQuestion(); // Refresh to show new comment
      } else {
        console.error('Failed to submit comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async () => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/questions');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  // Helper functions
  const getInitials = (name: string) => {
    return name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const calculateScore = (votes: Vote[]) => {
    return votes.reduce((sum, vote) => sum + vote.value, 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render comment tree
  const renderComments = (comments: Comment[], depth = 0) => {
    return comments.map((comment) => (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-gray-200' : ''}`}>
        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {comment.author.image ? (
                <img
                  src={comment.author.image}
                  alt={comment.author.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-mono text-gray-600">
                  {getInitials(comment.author.name)}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-medium text-gray-900">
                  {comment.author.name}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              
              <div className="text-gray-700 mb-3 whitespace-pre-wrap">
                {comment.body}
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-mono"
                >
                  <Reply size={14} />
                  Reply
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="ml-4">
            {renderComments(comment.replies, depth + 1)}
          </div>
        )}
        
        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="ml-4 mb-4">
            <div className="bg-gray-50 border rounded-lg p-4">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-3 border rounded-lg resize-none font-mono text-sm"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setNewComment(replyText);
                    handleSubmitComment();
                  }}
                  disabled={!replyText.trim() || submittingComment}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 font-mono text-sm"
                >
                  {submittingComment ? 'Replying...' : 'Reply'}
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-mono text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-gray-600 font-mono">Loading question...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 font-mono mb-4">{error}</div>
          <button
            onClick={() => router.push('/questions')}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 font-mono text-sm"
          >
            Back to Questions
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 font-mono">Question not found</div>
      </div>
    );
  }

  const score = calculateScore(question.votes);
  const topLevelComments = question.comments.filter(comment => !comment.parentId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-gray-600 hover:text-gray-900 font-mono text-sm"
        >
          ← Back to Questions
        </button>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6">
            {/* Vote Section */}
            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleVote(1)}
                  className={`p-2 rounded-full transition-colors ${
                    userVote?.value === 1 
                      ? 'bg-green-100 text-green-600' 
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <ArrowUp size={20} />
                </button>
                <span className="text-lg font-bold text-gray-900 font-mono my-2">
                  {score}
                </span>
                <button
                  onClick={() => handleVote(-1)}
                  className={`p-2 rounded-full transition-colors ${
                    userVote?.value === -1 
                      ? 'bg-red-100 text-red-600' 
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <ArrowDown size={20} />
                </button>
              </div>

              {/* Question Content */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-4 font-mono">
                  {question.title}
                </h1>
                
                <div className="text-gray-700 mb-4 whitespace-pre-wrap">
                  {question.content}
                </div>
                
                {question.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={question.imageUrl}
                      alt="Question attachment"
                      className="max-w-full h-auto rounded-lg border"
                    />
                  </div>
                )}
                
                {/* Tags */}
                {question.tags && question.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {question.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-mono"
                      >
                        <Tag size={12} className="inline mr-1" />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Author Info */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-3">
                    {question.author.image ? (
                      <img
                        src={question.author.image}
                        alt={question.author.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-mono text-gray-600">
                        {getInitials(question.author.name)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {question.author.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                        <Calendar size={12} />
                        {formatDate(question.createdAt)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
                      <Share2 size={16} />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
                      <BookmarkPlus size={16} />
                    </button>
                    {isAuthor && (
                      <>
                        <button 
                          onClick={() => router.push(`/questions/${questionId}/edit`)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={handleDeleteQuestion}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 font-mono mb-4 flex items-center gap-2">
              <MessageSquare size={20} />
              Comments ({question._count.comments})
            </h3>
            
            {/* Add Comment */}
            {currentUser && (
              <div className="mb-6">
                <div className="flex items-start gap-3">
                  {currentUser.image ? (
                    <img
                      src={currentUser.image}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-mono text-gray-600">
                      {getInitials(currentUser.name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="w-full p-3 border rounded-lg resize-none font-mono text-sm"
                      rows={3}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || submittingComment}
                        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 font-mono text-sm"
                      >
                        {submittingComment ? 'Posting...' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Comments List */}
            {topLevelComments.length > 0 ? (
              <div className="space-y-4">
                {renderComments(topLevelComments)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 font-mono">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionDetailPage;