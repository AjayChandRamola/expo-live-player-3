/**
 * components/Comments/RepliesList.tsx
 * 
 * Replies list component
 * - Renders threaded replies for a comment
 * - Pagination support
 * - Load more button
 * - Optimistic updates
 * 
 * Production-ready with performance optimization
 */

import React, { memo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { CommentItem } from "./CommentItem";
import { useReplies } from "../../hooks/useReplies";
import type { Comment, OptimisticComment } from "../../types/comment";

interface RepliesListProps {
  commentId: string;
  replyCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onLike: (commentId: string, currentlyLiked: boolean, currentCount: number) => void;
  onReply: (comment: Comment) => void;
  currentUserId?: string;
}

/**
 * RepliesList Component
 */
function RepliesListComponent({
  commentId,
  replyCount,
  isExpanded,
  onToggleExpanded,
  onLike,
  onReply,
  currentUserId,
}: RepliesListProps) {
  const {
    replies,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useReplies({
    commentId,
    initiallyExpanded: isExpanded,
  });

  if (!isExpanded || replyCount === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#065FD4" />
          <Text style={styles.loadingText}>Loading replies...</Text>
        </View>
      )}

      {/* Replies List */}
      {!isLoading && replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onLike={onLike}
          onReply={onReply}
          isReply
          currentUserId={currentUserId}
        />
      ))}

      {/* Load More Replies */}
      {hasMore && !isLoading && (
        <Pressable
          style={styles.loadMoreButton}
          onPress={loadMore}
          disabled={isLoadingMore}
          accessible
          accessibilityLabel="Load more replies"
          accessibilityRole="button"
        >
          {isLoadingMore ? (
            <ActivityIndicator size="small" color="#065FD4" />
          ) : (
            <Text style={styles.loadMoreText}>Load more replies</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 48,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 13,
    color: "#606060",
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "flex-start",
  },
  loadMoreText: {
    fontSize: 13,
    color: "#065FD4",
    fontWeight: "600",
  },
});

export const RepliesList = memo(RepliesListComponent);

export default RepliesList;

