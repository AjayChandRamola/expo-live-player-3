/**
 * hooks/useCommentsFeed.ts
 * 
 * Custom hook for managing comments feed
 * - Fetch top-level comments
 * - Pagination with cursor
 * - Sorting (top/newest)
 * - Refresh and retry
 * - Optimistic updates
 * 
 * Production-ready with comprehensive error handling
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { fetchComments } from "../services/commentsService";
import type { Comment, CommentSortOrder, OptimisticComment } from "../types/comment";
import Logger from "../utils/Logger";

interface UseCommentsFeedProps {
  videoId: string;
  initialSort?: CommentSortOrder;
  enabled?: boolean;
}

interface UseCommentsFeedReturn {
  comments: Array<Comment | OptimisticComment>;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  sortOrder: CommentSortOrder;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setSortOrder: (order: CommentSortOrder) => void;
  addOptimisticComment: (comment: OptimisticComment) => void;
  removeOptimisticComment: (tempId: string) => void;
  replaceOptimisticComment: (tempId: string, realComment: Comment) => void;
  updateComment: (commentId: string, updates: Partial<Comment>) => void;
  removeComment: (commentId: string) => void;
}

/**
 * Hook to manage comments feed with pagination and optimistic updates
 */
export function useCommentsFeed({
  videoId,
  initialSort = "top",
  enabled = true,
}: UseCommentsFeedProps): UseCommentsFeedReturn {
  const [comments, setComments] = useState<Array<Comment | OptimisticComment>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [sortOrder, setSortOrder] = useState<CommentSortOrder>(initialSort);
  
  const cursorRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  /**
   * Load initial comments
   */
  const loadInitial = useCallback(async () => {
    if (!enabled || isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      Logger.info(`[CommentsFeed] Loading comments for ${videoId}, sort: ${sortOrder}`);

      const response = await fetchComments(videoId, null, 20, sortOrder);

      setComments(response.data);
      cursorRef.current = response.nextCursor;
      setHasMore(response.nextCursor !== null);
      setTotalCount(response.totalCount || response.data.length);

      Logger.info(`[CommentsFeed] Loaded ${response.data.length} comments`);
    } catch (err) {
      Logger.error("[CommentsFeed] Failed to load comments:", err);
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [videoId, sortOrder, enabled]);

  /**
   * Load more comments (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingRef.current || !hasMore) return;

    try {
      isLoadingRef.current = true;
      setIsLoadingMore(true);

      Logger.info(`[CommentsFeed] Loading more comments, cursor: ${cursorRef.current}`);

      const response = await fetchComments(videoId, cursorRef.current, 20, sortOrder);

      setComments((prev) => [...prev, ...response.data]);
      cursorRef.current = response.nextCursor;
      setHasMore(response.nextCursor !== null);

      Logger.info(`[CommentsFeed] Loaded ${response.data.length} more comments`);
    } catch (err) {
      Logger.error("[CommentsFeed] Failed to load more comments:", err);
    } finally {
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [videoId, sortOrder, hasMore, enabled]);

  /**
   * Refresh comments (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    cursorRef.current = null;
    setComments([]);
    await loadInitial();
  }, [loadInitial]);

  /**
   * Change sort order
   */
  const handleSetSortOrder = useCallback((order: CommentSortOrder) => {
    setSortOrder(order);
    cursorRef.current = null;
    setComments([]);
    
    Logger.info(`[CommentsFeed] Sort order changed to: ${order}`);
  }, []);

  /**
   * Add optimistic comment (shows immediately before server confirms)
   */
  const addOptimisticComment = useCallback((comment: OptimisticComment) => {
    setComments((prev) => {
      // Check if this optimistic comment already exists (prevent duplicates)
      const exists = prev.some((c) => {
        const optimistic = c as OptimisticComment;
        return optimistic.tempId === comment.tempId || optimistic.id === comment.id;
      });
      
      if (exists) {
        console.log(`[CommentsFeed] ⚠️ Optimistic comment ${comment.tempId} already exists, skipping duplicate`);
        Logger.warn(`[CommentsFeed] Duplicate optimistic comment detected: ${comment.tempId}`);
        return prev;
      }
      
      Logger.info(`[CommentsFeed] Added optimistic comment: ${comment.tempId}`);
      
      // Increment count when adding
      setTotalCount((prevTotal) => prevTotal + 1);
      
      return [comment, ...prev];
    });
  }, []);

  /**
   * Remove optimistic comment (on error)
   */
  const removeOptimisticComment = useCallback((tempId: string) => {
    setComments((prev) => prev.filter((c) => {
      const optimistic = c as OptimisticComment;
      return optimistic.tempId !== tempId;
    }));
    setTotalCount((prev) => Math.max(0, prev - 1));
    
    Logger.info(`[CommentsFeed] Removed optimistic comment: ${tempId}`);
  }, []);

  /**
   * Replace optimistic comment with real one from server
   */
  const replaceOptimisticComment = useCallback((tempId: string, realComment: Comment) => {
    setComments((prev) => {
      let replaced = false;
      const result = prev.filter((c) => {
        // Skip if this is the optimistic comment we're replacing
        const optimistic = c as OptimisticComment;
        if (optimistic.tempId === tempId) {
          // Only replace the first match
          if (!replaced) {
            replaced = true;
            return false; // Don't include the optimistic comment
          }
          // Skip any duplicate optimistic comments
          return false;
        }
        
        // Skip if this is already the real comment (prevent duplicates)
        if (c.id === realComment.id && !optimistic.isOptimistic) {
          console.log(`[CommentsFeed] ⚠️ Real comment ${realComment.id} already exists, skipping duplicate`);
          return false;
        }
        
        return true;
      });
      
      // Add the real comment at the top if we replaced an optimistic one
      if (replaced) {
        Logger.info(`[CommentsFeed] Replaced optimistic ${tempId} with real ${realComment.id}`);
        return [realComment, ...result];
      } else {
        // If no optimistic comment found, just add the real one (shouldn't happen)
        Logger.warn(`[CommentsFeed] No optimistic comment ${tempId} found to replace`);
        return [realComment, ...result];
      }
    });
  }, []);

  /**
   * Update comment (for like count, etc.)
   */
  const updateComment = useCallback((commentId: string, updates: Partial<Comment>) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, ...updates } : c))
    );
    
    Logger.info(`[CommentsFeed] Updated comment ${commentId}`);
  }, []);

  /**
   * Remove comment (after delete)
   */
  const removeComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setTotalCount((prev) => Math.max(0, prev - 1));
    
    Logger.info(`[CommentsFeed] Removed comment ${commentId}`);
  }, []);

  /**
   * Load initial comments on mount or when videoId/sort changes
   */
  useEffect(() => {
    if (enabled) {
      loadInitial();
    }
  }, [enabled, videoId, sortOrder]);

  return {
    comments,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    totalCount,
    sortOrder,
    refresh,
    loadMore,
    setSortOrder: handleSetSortOrder,
    addOptimisticComment,
    removeOptimisticComment,
    replaceOptimisticComment,
    updateComment,
    removeComment,
  };
}

export default useCommentsFeed;

