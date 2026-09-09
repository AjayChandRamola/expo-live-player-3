/**
 * services/commentsService.ts
 * 
 * Backend-agnostic comments service
 * - Abstract interface for all comment operations
 * - Currently uses mock data
 * - Ready to swap with AWS, REST, GraphQL, Supabase, Firebase, etc.
 * 
 * API Contract Examples:
 * - GET /api/videos/{videoId}/comments?cursor=X&limit=20&sort=top
 * - GET /api/comments/{commentId}/replies?cursor=X&limit=10
 * - POST /api/videos/{videoId}/comments { text, parentId }
 * - POST /api/comments/{id}/like
 * - POST /api/comments/{id}/report
 * - PATCH /api/comments/{id} { text }
 * - DELETE /api/comments/{id}
 * 
 * Production-ready with defensive programming
 */

import type {
  Comment,
  CommentsResponse,
  CreateCommentRequest,
  LikeCommentRequest,
  ReportCommentRequest,
  EditCommentRequest,
  DeleteCommentRequest,
  CommentSortOrder,
} from "../types/comment";
import Logger from "../utils/Logger";

/**
 * Mock comments data for demonstration
 * In production, replace with actual API calls
 */
const MOCK_COMMENTS: Record<string, Comment[]> = {
  // Comments for short1
  short1: [
    {
      id: "c1",
      videoId: "short1",
      parentId: null,
      author: {
        id: "u1",
        displayName: "Spiritual Seeker",
        avatarUrl: "https://picsum.photos/seed/user1/100/100",
      },
      text: "This morning mantra is perfect! Really helps me start the day with positive energy. Thank you for sharing! 🙏",
      likeCount: 245,
      likedByCurrentUser: false,
      replyCount: 12,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    },
    {
      id: "c2",
      videoId: "short1",
      parentId: null,
      author: {
        id: "u2",
        displayName: "Meditation Master",
        avatarUrl: "https://picsum.photos/seed/user2/100/100",
        isVerified: true,
      },
      text: "Beautiful practice! I've been doing this for 5 years and it never gets old.",
      likeCount: 89,
      likedByCurrentUser: true,
      replyCount: 5,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    },
  ],
};

// Mock replies
const MOCK_REPLIES: Record<string, Comment[]> = {
  c1: [
    {
      id: "r1",
      videoId: "short1",
      parentId: "c1",
      author: {
        id: "u3",
        displayName: "Yoga Enthusiast",
        avatarUrl: "https://picsum.photos/seed/user3/100/100",
      },
      text: "I agree! This has transformed my mornings!",
      likeCount: 34,
      likedByCurrentUser: false,
      replyCount: 0,
      createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    },
    {
      id: "r2",
      videoId: "short1",
      parentId: "c1",
      author: {
        id: "u4",
        displayName: "Morning Person",
        avatarUrl: "https://picsum.photos/seed/user4/100/100",
      },
      text: "Same here! Best way to start the day 🌅",
      likeCount: 18,
      likedByCurrentUser: false,
      replyCount: 0,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    },
  ],
  c2: [
    {
      id: "r3",
      videoId: "short1",
      parentId: "c2",
      author: {
        id: "u5",
        displayName: "Meditation Newbie",
        avatarUrl: "https://picsum.photos/seed/user5/100/100",
      },
      text: "Any tips for beginners?",
      likeCount: 8,
      likedByCurrentUser: false,
      replyCount: 0,
      createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      status: "active",
    },
  ],
};

/**
 * Fetch comments for a video
 * 
 * Backend Integration:
 * - Replace with: fetch(`/api/videos/${videoId}/comments?cursor=${cursor}&limit=${limit}&sort=${sort}`)
 * - Or GraphQL: client.query({ query: GET_COMMENTS, variables: { videoId, cursor, limit, sort }})
 * - Or Supabase: supabase.from('comments').select().eq('videoId', videoId).order(...)
 * - Or Firebase: firestore.collection('comments').where('videoId', '==', videoId).orderBy(...)
 */
export async function fetchComments(
  videoId: string,
  cursor: string | null = null,
  limit: number = 20,
  sort: CommentSortOrder = "top"
): Promise<CommentsResponse> {
  try {
    Logger.info(`[CommentsService] Fetching comments for ${videoId}, sort: ${sort}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get mock comments
    const comments = MOCK_COMMENTS[videoId] || [];

    // Sort
    const sorted = sort === "newest" 
      ? [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [...comments].sort((a, b) => b.likeCount - a.likeCount);

    Logger.info(`[CommentsService] Returning ${sorted.length} comments`);

    return {
      data: sorted,
      nextCursor: null, // No more pages in mock
      totalCount: sorted.length,
    };
  } catch (error) {
    Logger.error("[CommentsService] Failed to fetch comments:", error);
    throw new Error("Failed to load comments");
  }
}

/**
 * Fetch replies for a comment
 */
export async function fetchReplies(
  commentId: string,
  cursor: string | null = null,
  limit: number = 10
): Promise<CommentsResponse> {
  try {
    Logger.info(`[CommentsService] Fetching replies for ${commentId}`);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const replies = MOCK_REPLIES[commentId] || [];

    Logger.info(`[CommentsService] Returning ${replies.length} replies`);

    return {
      data: replies,
      nextCursor: null,
      totalCount: replies.length,
    };
  } catch (error) {
    Logger.error("[CommentsService] Failed to fetch replies:", error);
    throw new Error("Failed to load replies");
  }
}

/**
 * Create a new comment or reply
 */
export async function createComment(request: CreateCommentRequest): Promise<Comment> {
  try {
    Logger.info(`[CommentsService] Creating ${request.parentId ? 'reply' : 'comment'} for ${request.videoId}`);

    await new Promise((resolve) => setTimeout(resolve, 800));

    // Generate new comment/reply
    const newComment: Comment = {
      id: `${request.parentId ? 'r' : 'c'}${Date.now()}`,
      videoId: request.videoId,
      parentId: request.parentId || null,
      author: {
        id: "currentUser",
        displayName: "You",
        avatarUrl: "https://picsum.photos/seed/currentuser/100/100",
      },
      text: request.text,
      likeCount: 0,
      likedByCurrentUser: false,
      replyCount: 0,
      createdAt: new Date().toISOString(),
      status: "active",
    };

    // Store in mock data (for demo purposes)
    if (request.parentId) {
      // It's a reply - add to MOCK_REPLIES
      if (!MOCK_REPLIES[request.parentId]) {
        MOCK_REPLIES[request.parentId] = [];
      }
      MOCK_REPLIES[request.parentId].unshift(newComment);
      Logger.info(`[CommentsService] Reply created and stored: ${newComment.id}`);
    } else {
      // It's a top-level comment - add to MOCK_COMMENTS
      if (!MOCK_COMMENTS[request.videoId]) {
        MOCK_COMMENTS[request.videoId] = [];
      }
      MOCK_COMMENTS[request.videoId].unshift(newComment);
      Logger.info(`[CommentsService] Comment created and stored: ${newComment.id}`);
    }

    return newComment;
  } catch (error) {
    Logger.error("[CommentsService] Failed to create comment:", error);
    throw new Error("Failed to post comment");
  }
}

/**
 * Like or unlike a comment
 */
export async function likeComment(request: LikeCommentRequest): Promise<{ likeCount: number; likedByCurrentUser: boolean }> {
  try {
    Logger.info(`[CommentsService] ${request.liked ? "Liking" : "Unliking"} comment ${request.commentId}`);

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return updated like state (mock)
    return {
      likeCount: request.liked ? 1 : 0, // Placeholder
      likedByCurrentUser: request.liked,
    };
  } catch (error) {
    Logger.error("[CommentsService] Failed to like comment:", error);
    throw new Error("Failed to update like");
  }
}

/**
 * Report a comment
 */
export async function reportComment(request: ReportCommentRequest): Promise<void> {
  try {
    Logger.info(`[CommentsService] Reporting comment ${request.commentId}, reason: ${request.reason}`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    Logger.info(`[CommentsService] Comment reported successfully`);
  } catch (error) {
    Logger.error("[CommentsService] Failed to report comment:", error);
    throw new Error("Failed to report comment");
  }
}

/**
 * Edit a comment
 */
export async function editComment(request: EditCommentRequest): Promise<Comment> {
  try {
    Logger.info(`[CommentsService] Editing comment ${request.commentId}`);

    await new Promise((resolve) => setTimeout(resolve, 600));

    // Return updated comment (mock)
    const updated: Comment = {
      id: request.commentId,
      videoId: "mock",
      parentId: null,
      author: {
        id: "currentUser",
        displayName: "You",
      },
      text: request.text,
      likeCount: 0,
      likedByCurrentUser: false,
      replyCount: 0,
      createdAt: new Date().toISOString(),
      status: "active",
      metadata: {
        isEdited: true,
        editedAt: new Date().toISOString(),
      },
    };

    Logger.info(`[CommentsService] Comment edited successfully`);

    return updated;
  } catch (error) {
    Logger.error("[CommentsService] Failed to edit comment:", error);
    throw new Error("Failed to edit comment");
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(request: DeleteCommentRequest): Promise<void> {
  try {
    Logger.info(`[CommentsService] Deleting comment ${request.commentId}`);

    await new Promise((resolve) => setTimeout(resolve, 400));

    Logger.info(`[CommentsService] Comment deleted successfully`);
  } catch (error) {
    Logger.error("[CommentsService] Failed to delete comment:", error);
    throw new Error("Failed to delete comment");
  }
}

export default {
  fetchComments,
  fetchReplies,
  createComment,
  likeComment,
  reportComment,
  editComment,
  deleteComment,
};

