/**
 * hooks/useReplies.ts
 * 
 * Custom hook for managing replies to a comment
 * - Fetch replies for a specific comment
 * - Pagination
 * - Optimistic updates for new replies
 * - Lazy loading
 * 
 * Production-ready with defensive programming
 */

import { useState, useCallback, useRef } from "react";
import { fetchReplies } from "../services/commentsService";
import type { Comment, OptimisticComment } from "../types/comment";
import Logger from "../utils/Logger";

interface UseRepliesProps {
  commentId: string;
  initiallyExpanded?: boolean;
}

interface UseRepliesReturn {
  replies: Array<Comment | OptimisticComment>;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  isExpanded: boolean;
  loadReplies: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleExpanded: () => void;
  addOptimisticReply: (reply: OptimisticComment) => void;
  removeOptimisticReply: (tempId: string) => void;
  replaceOptimisticReply: (tempId: string, realReply: Comment) => void;
  updateReply: (replyId: string, updates: Partial<Comment>) => void;
  removeReply: (replyId: string) => void;
}

/**
 * Hook to manage replies for a specific comment
 */
export function useReplies({
  commentId,
  initiallyExpanded = false,
}: UseRepliesProps): UseRepliesReturn {
  const [replies, setReplies] = useState<Array<Comment | OptimisticComment>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  
  const cursorRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  /**
   * Load replies
   */
  const loadReplies = useCallback(async () => {
    if (isLoadingRef.current || hasLoadedRef.current) return;

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      Logger.info(`[Replies] Loading replies for comment ${commentId}`);

      const response = await fetchReplies(commentId, null, 10);

      setReplies(response.data);
      cursorRef.current = response.nextCursor;
      setHasMore(response.nextCursor !== null);
      hasLoadedRef.current = true;

      Logger.info(`[Replies] Loaded ${response.data.length} replies`);
    } catch (err) {
      Logger.error(`[Replies] Failed to load replies for ${commentId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to load replies");
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [commentId]);

  /**
   * Load more replies
   */
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return;

    try {
      isLoadingRef.current = true;
      setIsLoadingMore(true);

      Logger.info(`[Replies] Loading more replies for ${commentId}`);

      const response = await fetchReplies(commentId, cursorRef.current, 10);

      setReplies((prev) => [...prev, ...response.data]);
      cursorRef.current = response.nextCursor;
      setHasMore(response.nextCursor !== null);

      Logger.info(`[Replies] Loaded ${response.data.length} more replies`);
    } catch (err) {
      Logger.error(`[Replies] Failed to load more replies:`, err);
    } finally {
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [commentId, hasMore]);

  /**
   * Toggle expanded state (lazy load on first expand)
   */
  const toggleExpanded = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    // Load replies on first expand
    if (newExpanded && !hasLoadedRef.current) {
      loadReplies();
    }

    Logger.info(`[Replies] Toggled expanded for ${commentId}: ${newExpanded}`);
  }, [isExpanded, commentId, loadReplies]);

  /**
   * Add optimistic reply
   */
  const addOptimisticReply = useCallback((reply: OptimisticComment) => {
    setReplies((prev) => [reply, ...prev]);
    Logger.info(`[Replies] Added optimistic reply: ${reply.tempId}`);
  }, []);

  /**
   * Remove optimistic reply
   */
  const removeOptimisticReply = useCallback((tempId: string) => {
    setReplies((prev) => prev.filter((r) => {
      const opt = r as OptimisticComment;
      return opt.tempId !== tempId;
    }));
    Logger.info(`[Replies] Removed optimistic reply: ${tempId}`);
  }, []);

  /**
   * Replace optimistic reply with real one
   */
  const replaceOptimisticReply = useCallback((tempId: string, realReply: Comment) => {
    setReplies((prev) =>
      prev.map((r) => {
        const opt = r as OptimisticComment;
        return opt.tempId === tempId ? realReply : r;
      })
    );
    Logger.info(`[Replies] Replaced optimistic reply ${tempId} with ${realReply.id}`);
  }, []);

  /**
   * Update reply
   */
  const updateReply = useCallback((replyId: string, updates: Partial<Comment>) => {
    setReplies((prev) =>
      prev.map((r) => (r.id === replyId ? { ...r, ...updates } : r))
    );
    Logger.info(`[Replies] Updated reply ${replyId}`);
  }, []);

  /**
   * Remove reply
   */
  const removeReply = useCallback((replyId: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    Logger.info(`[Replies] Removed reply ${replyId}`);
  }, []);

  return {
    replies,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    isExpanded,
    loadReplies,
    loadMore,
    toggleExpanded,
    addOptimisticReply,
    removeOptimisticReply,
    replaceOptimisticReply,
    updateReply,
    removeReply,
  };
}

export default useReplies;

