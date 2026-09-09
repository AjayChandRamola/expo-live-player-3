/**
 * types/comment.ts
 * 
 * Type definitions for comments and replies system
 * - Complete type safety for comments data
 * - Backend-agnostic structure
 * - Ready for AWS, REST, GraphQL, Supabase, Firebase, etc.
 * 
 * Production-ready with defensive types
 */

/**
 * Comment author information
 */
export interface CommentAuthor {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isVerified?: boolean;
}

/**
 * Comment status
 */
export type CommentStatus = "active" | "removed" | "hidden" | "pending";

/**
 * Comment sort order
 */
export type CommentSortOrder = "top" | "newest";

/**
 * Comment metadata (extensible for attachments, etc.)
 */
export interface CommentMetadata {
  attachments?: Array<{
    type: "image" | "gif" | "video";
    url: string;
    thumbnailUrl?: string;
  }>;
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
}

/**
 * Main comment type
 */
export interface Comment {
  id: string;
  videoId: string;
  parentId: string | null; // null for top-level, commentId for replies
  author: CommentAuthor;
  text: string;
  likeCount: number;
  likedByCurrentUser: boolean;
  replyCount: number;
  createdAt: string; // ISO date string
  status: CommentStatus;
  metadata?: CommentMetadata;
}

/**
 * Paginated comments response
 */
export interface CommentsResponse {
  data: Comment[];
  nextCursor: string | null;
  totalCount?: number;
}

/**
 * Create comment request
 */
export interface CreateCommentRequest {
  videoId: string;
  text: string;
  parentId?: string | null; // For replies
}

/**
 * Like comment request
 */
export interface LikeCommentRequest {
  commentId: string;
  liked: boolean; // true to like, false to unlike
}

/**
 * Report comment request
 */
export interface ReportCommentRequest {
  commentId: string;
  reason: "spam" | "inappropriate" | "misleading" | "other";
  details?: string;
}

/**
 * Edit comment request
 */
export interface EditCommentRequest {
  commentId: string;
  text: string;
}

/**
 * Delete comment request
 */
export interface DeleteCommentRequest {
  commentId: string;
}

/**
 * Optimistic comment (client-side pending)
 */
export interface OptimisticComment extends Comment {
  isOptimistic: boolean;
  tempId: string;
  error?: string;
}

