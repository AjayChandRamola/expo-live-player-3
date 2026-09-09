/**
 * components/Comments/Home/HomeVideoCommentsModal.tsx
 * 
 * YouTube-style comments modal for Home Page videos
 * - Full-screen modal optimized for normal video layout
 * - Smooth slide-up animation with dim background
 * - Reuses existing comments hooks and services
 * - Single-click submission (already fixed in CommentComposer)
 * 
 * Production-ready, accessible, cross-platform
 */

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  useColorScheme,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CommentComposer } from "../CommentComposer";
import { CommentItem } from "../CommentItem";
import { RepliesList } from "../RepliesList";
import { useCommentsFeed } from "../../../hooks/useCommentsFeed";
import { useCommentMutations } from "../../../hooks/useCommentMutations";
import type { Comment } from "../../../types/comment";
import Logger from "../../../utils/Logger";
import { Colors } from "../../../constants/theme";

interface HomeVideoCommentsModalProps {
  /**
   * Video ID for which to show comments
   */
  videoId: string;

  /**
   * Whether modal is visible
   */
  visible: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Total comment count (if available from parent)
   */
  totalCount?: number;
}

/**
 * HomeVideoCommentsModal Component
 */
export function HomeVideoCommentsModal({
  videoId,
  visible,
  onClose,
  totalCount: externalTotalCount,
}: HomeVideoCommentsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  // Sort order state
  const [sortOrder, setSortOrder] = useState<"top" | "newest">("top");

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{
    displayName: string;
    commentId: string;
  } | null>(null);

  // Expanded replies state (track which comments have replies expanded)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Submission prevention refs
  const isSubmittingRef = useRef(false);
  const lastSubmittedTextRef = useRef<string>("");
  const lastSubmittedTimeRef = useRef<number>(0);

  // Animation values
  const translateY = useSharedValue(1000); // Start off-screen
  const opacity = useSharedValue(0);

  // Comments feed hook (reuses existing logic)
  const {
    comments,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    addOptimisticComment,
    replaceOptimisticComment,
    updateComment,
    removeComment,
  } = useCommentsFeed({
    videoId,
    sort: sortOrder,
  });

  // Comment mutations hook (reuses existing logic)
  const {
    postComment,
    toggleLike,
    reportCommentById,
    isSubmitting: externalIsSubmitting,
  } = useCommentMutations({
    onOptimisticAdd: (newComment) => {
      // Skip replies in main feed
      if (newComment.parentId) {
        Logger.info(`[HomeComments] Skipping reply ${newComment.id} from main feed`);
        return;
      }
      addOptimisticComment(newComment);
      Logger.info(`[HomeComments] Added optimistic comment: ${newComment.tempId || newComment.id}`);
    },
    onOptimisticReplace: (tempId, realComment) => {
      // Skip replies in main feed
      if (realComment.parentId) {
        Logger.info(`[HomeComments] Skipping reply ${realComment.id} from main feed`);
        return;
      }
      // Use replaceOptimisticComment from useCommentsFeed
      replaceOptimisticComment(tempId, realComment);
      Logger.info(`[HomeComments] Replaced optimistic comment ${tempId} with ${realComment.id}`);
    },
    onOptimisticRemove: (tempId) => {
      removeComment(tempId);
      Logger.info(`[HomeComments] Removed failed optimistic comment: ${tempId}`);
    },
  });

  // Track replies locally (replies go under parent comments, not in main feed)
  const [commentReplies, setCommentReplies] = useState<Record<string, Comment[]>>({});

  // Animate in/out
  React.useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      Logger.info(`[HomeComments] Modal opened for video ${videoId}`);
    } else {
      translateY.value = withTiming(1000, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 });
      // Reset state when closing
      setReplyingTo(null);
      setExpandedReplies(new Set());
    }
  }, [visible, videoId, translateY, opacity]);

  // Animated styles
  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  /**
   * Handle close
   */
  const handleClose = useCallback(() => {
    Logger.info("[HomeComments] Modal closing");
    onClose();
  }, [onClose]);

  /**
   * Toggle sort order
   */
  const handleToggleSort = useCallback(() => {
    const newSort = sortOrder === "top" ? "newest" : "top";
    setSortOrder(newSort);
    Logger.info(`[HomeComments] Sort changed to: ${newSort}`);
  }, [sortOrder]);

  /**
   * Handle comment submission
   */
  const handleSubmitComment = useCallback(
    async (text: string) => {
      const now = Date.now();
      const trimmedText = text.trim();

      // Prevent duplicate submissions
      if (
        isSubmittingRef.current ||
        externalIsSubmitting ||
        (trimmedText === lastSubmittedTextRef.current &&
          now - lastSubmittedTimeRef.current < 2000)
      ) {
        Logger.warn("[HomeComments] Duplicate submission prevented");
        return;
      }

      isSubmittingRef.current = true;
      lastSubmittedTextRef.current = trimmedText;
      lastSubmittedTimeRef.current = now;

      try {
        if (!videoId) {
          Logger.error("[HomeComments] videoId is required for posting comments");
          throw new Error("Video ID is required");
        }

        const parentId = replyingTo?.commentId || null;

        // Create request object
        const request = {
          videoId,
          text: trimmedText,
          parentId,
        };

        if (parentId) {
          // Post reply
          const reply = await postComment(request);
          
          if (!reply) {
            throw new Error("Failed to post reply");
          }

          // Add to local replies state
          setCommentReplies((prev) => {
            const existing = prev[parentId] || [];
            // Filter out any optimistic version
            const filtered = existing.filter((r) => {
              const opt = r as any;
              return opt.id !== reply.id && opt.tempId !== reply.tempId;
            });
            return {
              ...prev,
              [parentId]: [...filtered, reply],
            };
          });

          // Update parent comment's reply count
          const parentComment = comments.find((c) => c.id === parentId);
          if (parentComment) {
            updateComment(parentId, {
              replyCount: parentComment.replyCount + 1,
            });
          }

          Logger.info(`[HomeComments] Reply posted: ${reply.id}`);
        } else {
          // Post top-level comment (useCommentMutations handles optimistic updates)
          const result = await postComment(request);
          if (result) {
            Logger.info(`[HomeComments] Comment posted: ${result.id}`);
          }
        }

        // Clear reply context
        setReplyingTo(null);
      } catch (err) {
        Logger.error("[HomeComments] Failed to post comment:", err);
        throw err; // Re-throw so CommentComposer can handle
      } finally {
        // Reset submission flag after a delay
        setTimeout(() => {
          isSubmittingRef.current = false;
        }, 1000);
      }
    },
    [videoId, replyingTo, postComment, comments, updateComment, externalIsSubmitting]
  );

  /**
   * Handle cancel reply
   */
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    Logger.info("[HomeComments] Reply cancelled");
  }, []);

  /**
   * Handle like
   */
  const handleLike = useCallback(
    async (commentId: string, currentlyLiked: boolean, currentCount: number) => {
      try {
        await toggleLike(commentId, currentlyLiked, currentCount);
        Logger.info(`[HomeComments] Comment ${commentId} liked: ${!currentlyLiked}`);
      } catch (err) {
        Logger.error("[HomeComments] Failed to like comment:", err);
      }
    },
    [toggleLike]
  );

  /**
   * Handle reply
   */
  const handleReply = useCallback((comment: Comment) => {
    setReplyingTo({
      displayName: comment.author.displayName,
      commentId: comment.id,
    });
    Logger.info(`[HomeComments] Reply initiated for comment ${comment.id}`);
  }, []);

  /**
   * Handle view replies toggle
   */
  const handleToggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  /**
   * Handle report
   */
  const handleReport = useCallback(
    async (commentId: string) => {
      try {
        await reportCommentById(commentId, "inappropriate");
        Logger.info(`[HomeComments] Comment ${commentId} reported`);
      } catch (err) {
        Logger.error("[HomeComments] Failed to report comment:", err);
      }
    },
    [reportCommentById]
  );

  /**
   * Render comment item
   */
  const renderComment = useCallback(
    ({ item }: { item: Comment }) => {
      const isExpanded = expandedReplies.has(item.id);
      const replies = commentReplies[item.id] || [];

      return (
        <View>
          <CommentItem
            comment={item}
            onLike={handleLike}
            onReply={handleReply}
            onReport={handleReport}
            onViewReplies={() => handleToggleReplies(item.id)}
            repliesExpanded={isExpanded}
            currentUserId="current_user" // TODO: Get from auth context
          />

          {/* Replies List */}
          {isExpanded && item.replyCount > 0 && (
            <RepliesList
              commentId={item.id}
              replyCount={item.replyCount}
              isExpanded={isExpanded}
              onToggleExpanded={() => handleToggleReplies(item.id)}
              onLike={handleLike}
              onReply={handleReply}
              currentUserId="current_user" // TODO: Get from auth context
            />
          )}

          {/* Local replies (optimistic + confirmed) */}
          {replies.length > 0 && (
            <View style={styles.localRepliesContainer}>
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id || reply.tempId}
                  comment={reply}
                  onLike={handleLike}
                  onReply={handleReply}
                  isReply
                  currentUserId="current_user" // TODO: Get from auth context
                />
              ))}
            </View>
          )}
        </View>
      );
    },
    [expandedReplies, commentReplies, handleLike, handleReply, handleReport, handleToggleReplies]
  );

  // Calculate total count
  const totalCount = useMemo(() => {
    if (externalTotalCount !== undefined) return externalTotalCount;
    return comments.reduce((sum, c) => sum + 1 + c.replyCount, 0);
  }, [externalTotalCount, comments]);

  // Loading state
  const isLoadingMore = isLoading && comments.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <Pressable
          style={styles.backdropTouchable}
          onPress={handleClose}
          hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
          accessible
          accessibilityLabel="Close comments"
          accessibilityRole="button"
        />
      </Animated.View>

      {/* Comments Panel */}
      <Animated.View style={[styles.panel, slideAnimatedStyle, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: isDark ? "#333333" : "#E0E0E0" }]}>
              <View style={styles.headerLeft}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Comments</Text>
                <Text style={[styles.headerCount, { color: isDark ? "#AAAAAA" : "#606060" }]}>
                  {totalCount}
                </Text>
              </View>

              <View style={styles.headerRight}>
                {/* Sort Toggle */}
                <Pressable
                  style={styles.sortButton}
                  onPress={handleToggleSort}
                  accessible
                  accessibilityLabel={`Sort by ${sortOrder === "top" ? "Top" : "Newest"}`}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name={sortOrder === "top" ? "fire" : "clock-outline"}
                    size={20}
                    color={isDark ? "#AAAAAA" : "#606060"}
                  />
                  <Text style={[styles.sortText, { color: isDark ? "#AAAAAA" : "#606060" }]}>
                    {sortOrder === "top" ? "Top" : "Newest"}
                  </Text>
                </Pressable>

                {/* Close Button */}
                <Pressable
                  style={styles.closeButton}
                  onPress={handleClose}
                  accessible
                  accessibilityLabel="Close comments"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={isDark ? "#FFFFFF" : "#000000"}
                  />
                </Pressable>
              </View>
            </View>

            {/* Comments List */}
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id || item.tempId || `temp_${item.text.substring(0, 10)}`}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              refreshControl={
                <RefreshControl
                  refreshing={isLoading && comments.length > 0}
                  onRefresh={refresh}
                  tintColor={isDark ? "#FFFFFF" : "#065FD4"}
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                !isLoading ? (
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons
                      name="comment-outline"
                      size={48}
                      color={isDark ? "#444444" : "#E0E0E0"}
                    />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No comments yet</Text>
                    <Text style={[styles.emptyText, { color: isDark ? "#888888" : "#606060" }]}>
                      Be the first to comment!
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={isDark ? "#FFFFFF" : "#065FD4"} />
                  </View>
                ) : null
              }
            />

            {/* Error Banner */}
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: isDark ? "#4A0000" : "#FFEBEE" }]}>
                <Text style={[styles.errorText, { color: isDark ? "#FFAAAA" : "#C62828" }]}>
                  {error}
                </Text>
                <Pressable onPress={refresh} accessible accessibilityLabel="Retry" accessibilityRole="button">
                  <Text style={[styles.retryText, { color: isDark ? "#FFAAAA" : "#C62828" }]}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Composer */}
            <CommentComposer
              avatarUrl="https://picsum.photos/seed/currentuser/100/100"
              replyingTo={replyingTo}
              onSubmit={handleSubmitComment}
              onCancelReply={handleCancelReply}
              placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
              isSubmitting={externalIsSubmitting || isSubmittingRef.current}
            />
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdropTouchable: {
    flex: 1,
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "90%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerCount: {
    fontSize: 14,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  sortText: {
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 12,
  },
  localRepliesContainer: {
    marginLeft: 48,
  },
});

