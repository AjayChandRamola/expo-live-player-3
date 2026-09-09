/**
 * hooks/useCommentMutations.ts
 * 
 * Custom hook for comment mutations with optimistic updates
 * - Create comment/reply
 * - Like/unlike comment
 * - Edit comment
 * - Delete comment
 * - Report comment
 * - Optimistic UI with rollback on error
 * 
 * Production-ready with comprehensive error handling
 */

import { useState, useCallback, useRef } from "react";
import {
  createComment,
  likeComment,
  editComment,
  deleteComment,
  reportComment,
} from "../services/commentsService";
import type {
  Comment,
  OptimisticComment,
  CreateCommentRequest,
  LikeCommentRequest,
  ReportCommentRequest,
  EditCommentRequest,
  DeleteCommentRequest,
} from "../types/comment";
import Logger from "../utils/Logger";

interface UseCommentMutationsProps {
  onCommentCreated?: (comment: Comment) => void;
  onCommentUpdated?: (commentId: string, updates: Partial<Comment>) => void;
  onCommentDeleted?: (commentId: string) => void;
  onOptimisticAdd?: (comment: OptimisticComment) => void;
  onOptimisticRemove?: (tempId: string) => void;
  onOptimisticReplace?: (tempId: string, realComment: Comment) => void;
}

interface UseCommentMutationsReturn {
  postComment: (request: CreateCommentRequest) => Promise<Comment | null>;
  toggleLike: (commentId: string, currentlyLiked: boolean, currentCount: number) => Promise<boolean>;
  editCommentText: (commentId: string, newText: string) => Promise<boolean>;
  deleteCommentById: (commentId: string) => Promise<boolean>;
  reportCommentById: (commentId: string, reason: ReportCommentRequest["reason"], details?: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Hook for comment mutations with optimistic updates
 */
export function useCommentMutations({
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onOptimisticAdd,
  onOptimisticRemove,
  onOptimisticReplace,
}: UseCommentMutationsProps = {}): UseCommentMutationsReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pendingLikesRef = useRef<Set<string>>(new Set());

  /**
   * Post a new comment or reply
   */
  const postComment = useCallback(async (request: CreateCommentRequest): Promise<Comment | null> => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Create optimistic comment
      const tempId = `temp_${Date.now()}`;
      const optimisticComment: OptimisticComment = {
        id: tempId,
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
        status: "pending",
        isOptimistic: true,
        tempId,
      };

      // Add optimistically
      onOptimisticAdd?.(optimisticComment);
      Logger.info(`[CommentMutations] Posting comment optimistically: ${tempId}`);

      // Send to server
      const realComment = await createComment(request);

      // Replace optimistic with real
      onOptimisticReplace?.(tempId, realComment);
      onCommentCreated?.(realComment);

      Logger.info(`[CommentMutations] Comment confirmed: ${realComment.id}`);

      return realComment;
    } catch (err) {
      Logger.error("[CommentMutations] Failed to post comment:", err);
      setError(err instanceof Error ? err.message : "Failed to post comment");
      
      // Remove optimistic comment on error
      const tempId = `temp_${Date.now()}`;
      onOptimisticRemove?.(tempId);
      
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [onOptimisticAdd, onOptimisticReplace, onOptimisticRemove, onCommentCreated]);

  /**
   * Toggle like on a comment
   */
  const toggleLike = useCallback(async (
    commentId: string,
    currentlyLiked: boolean,
    currentCount: number
  ): Promise<boolean> => {
    // Debounce rapid likes
    if (pendingLikesRef.current.has(commentId)) {
      Logger.info(`[CommentMutations] Debouncing like for ${commentId}`);
      return false;
    }

    try {
      pendingLikesRef.current.add(commentId);

      const newLiked = !currentlyLiked;
      const newCount = newLiked ? currentCount + 1 : currentCount - 1;

      // Optimistic update
      onCommentUpdated?.(commentId, {
        likedByCurrentUser: newLiked,
        likeCount: newCount,
      });

      Logger.info(`[CommentMutations] Toggling like for ${commentId}: ${newLiked}`);

      // Send to server
      const result = await likeComment({ commentId, liked: newLiked });

      // Confirm with server values
      onCommentUpdated?.(commentId, {
        likedByCurrentUser: result.likedByCurrentUser,
        likeCount: result.likeCount,
      });

      Logger.info(`[CommentMutations] Like confirmed for ${commentId}`);

      return true;
    } catch (err) {
      Logger.error(`[CommentMutations] Failed to like comment ${commentId}:`, err);
      
      // Rollback optimistic update
      onCommentUpdated?.(commentId, {
        likedByCurrentUser: currentlyLiked,
        likeCount: currentCount,
      });
      
      setError("Failed to update like");
      return false;
    } finally {
      // Remove from pending after 500ms to prevent rapid toggles
      setTimeout(() => {
        pendingLikesRef.current.delete(commentId);
      }, 500);
    }
  }, [onCommentUpdated]);

  /**
   * Edit comment text
   */
  const editCommentText = useCallback(async (commentId: string, newText: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setError(null);

      Logger.info(`[CommentMutations] Editing comment ${commentId}`);

      const updated = await editComment({ commentId, text: newText });

      onCommentUpdated?.(commentId, {
        text: updated.text,
        metadata: updated.metadata,
      });

      Logger.info(`[CommentMutations] Comment edited successfully`);

      return true;
    } catch (err) {
      Logger.error(`[CommentMutations] Failed to edit comment ${commentId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to edit comment");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onCommentUpdated]);

  /**
   * Delete comment
   */
  const deleteCommentById = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setError(null);

      Logger.info(`[CommentMutations] Deleting comment ${commentId}`);

      await deleteComment({ commentId });

      onCommentDeleted?.(commentId);

      Logger.info(`[CommentMutations] Comment deleted successfully`);

      return true;
    } catch (err) {
      Logger.error(`[CommentMutations] Failed to delete comment ${commentId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to delete comment");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onCommentDeleted]);

  /**
   * Report comment
   */
  const reportCommentById = useCallback(async (
    commentId: string,
    reason: ReportCommentRequest["reason"],
    details?: string
  ): Promise<boolean> => {
    try {
      Logger.info(`[CommentMutations] Reporting comment ${commentId}, reason: ${reason}`);

      await reportComment({ commentId, reason, details });

      Logger.info(`[CommentMutations] Comment reported successfully`);

      return true;
    } catch (err) {
      Logger.error(`[CommentMutations] Failed to report comment ${commentId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to report comment");
      return false;
    }
  }, []);

  return {
    postComment,
    toggleLike,
    editCommentText,
    deleteCommentById,
    reportCommentById,
    isSubmitting,
    error,
  };
}

export default useCommentMutations;

