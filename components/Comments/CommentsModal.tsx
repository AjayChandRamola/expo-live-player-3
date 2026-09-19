/**
 * components/Comments/CommentsModal.tsx
 * 
 * Main comments modal/overlay
 * - Header with count and close button
 * - Comments list (virtualized)
 * - Sort toggle (Top/Newest)
 * - Sticky composer at bottom
 * - Reply threading
 * - Pull-to-refresh
 * - Smooth slide animations
 * 
 * Production-ready YouTube-style comments
 */

import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
  Animated as RNAnimated,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommentItem } from "./CommentItem";
import { RepliesList } from "./RepliesList";
import { CommentComposer } from "./CommentComposer";
import { useCommentsFeed } from "../../hooks/useCommentsFeed";
import { useCommentMutations } from "../../hooks/useCommentMutations";
import type { Comment, CommentSortOrder } from "../../types/comment";
import Logger from "../../utils/Logger";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CommentsModalProps {
  /**
   * Video ID to fetch comments for
   */
  videoId: string;

  /**
   * Whether modal is visible
   */
  visible: boolean;

  /**
   * Called when modal should close
   */
  onClose: () => void;

  /**
   * Current user ID
   */
  currentUserId?: string;
}

/**
 * CommentsModal Component - YouTube-style comments overlay
 */
export function CommentsModal({
  videoId,
  visible,
  onClose,
  currentUserId = "currentUser",
}: CommentsModalProps) {
  // Animation
  const slideAnim = useRef(new RNAnimated.Value(0)).current;
  
  // State
  const [replyingTo, setReplyingTo] = useState<{
    comment: Comment;
    displayName: string;
    commentId: string;
  } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  
  // Track replies for each comment locally
  const [commentReplies, setCommentReplies] = useState<Record<string, Array<Comment | OptimisticComment>>>({});
  
  // Prevent duplicate submissions
  const isSubmittingRef = useRef(false);
  const lastSubmittedTextRef = useRef<string | null>(null);
  const lastSubmittedTimeRef = useRef<number>(0);

  // Comments feed hook
  const {
    comments,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    totalCount,
    sortOrder,
    refresh,
    loadMore,
    setSortOrder,
    addOptimisticComment,
    removeOptimisticComment,
    replaceOptimisticComment,
    updateComment,
    removeComment,
  } = useCommentsFeed({
    videoId,
    enabled: visible,
  });

  // Comment mutations hook
  const {
    postComment,
    toggleLike,
    deleteCommentById,
    reportCommentById,
    isSubmitting,
  } = useCommentMutations({
    onCommentCreated: (comment) => {
      Logger.info(`[Comments] Comment created: ${comment.id}`);
    },
    onCommentUpdated: (commentId, updates) => {
      updateComment(commentId, updates);
    },
    onCommentDeleted: (commentId) => {
      removeComment(commentId);
    },
    // Only add optimistic comments for top-level comments (not replies)
    onOptimisticAdd: (comment) => {
      // Skip replies - they're managed separately in commentReplies state
      if (comment.parentId) {
        console.log(`[Comments] ⚠️ Skipping optimistic add for reply ${comment.tempId} - managed in commentReplies`);
        return;
      }
      addOptimisticComment(comment);
    },
    onOptimisticRemove: (tempId) => {
      removeOptimisticComment(tempId);
    },
    onOptimisticReplace: (tempId, realComment) => {
      // Only replace if it's a top-level comment (replies are managed separately)
      if (realComment.parentId) {
        console.log(`[Comments] ⚠️ Skipping optimistic replace for reply ${realComment.id} - managed in commentReplies`);
        return;
      }
      replaceOptimisticComment(tempId, realComment);
    },
  });

  /**
   * Slide animation on open/close
   */
  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
      
      Logger.info(`[Comments] Modal opened for video ${videoId}`);
    } else {
      RNAnimated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, videoId]);

  /**
   * Handle submit comment
   */
  const handleSubmitComment = useCallback(async (text: string) => {
    const now = Date.now();
    const sanitizedText = text.trim();
    
    // Prevent duplicate submissions
    if (isSubmittingRef.current || isSubmitting) {
      console.log(`[Comments] ❌ Already submitting, ignoring duplicate submission...`);
      return;
    }
    
    // Prevent duplicate submissions of the same text within 2 seconds
    if (
      lastSubmittedTextRef.current === sanitizedText &&
      now - lastSubmittedTimeRef.current < 2000
    ) {
      console.log(`[Comments] ❌ Duplicate submission detected (same text within 2s), ignoring...`);
      return;
    }

    // Validate videoId
    if (!videoId) {
      Logger.error("[Comments] videoId is required for posting comments");
      throw new Error("Video ID is required");
    }

    console.log(`[Comments] 🚀 Submitting comment/reply, text: "${sanitizedText.substring(0, 30)}...", parentId: ${replyingTo?.commentId || 'null'}`);
    
    // Mark as submitting immediately and track submission
    isSubmittingRef.current = true;
    lastSubmittedTextRef.current = sanitizedText;
    lastSubmittedTimeRef.current = now;
    
    const isReply = !!replyingTo?.commentId;
    const parentId = replyingTo?.commentId || null;
    
    // Only create optimistic item for replies (top-level comments handled by useCommentMutations)
    let tempId: string | null = null;
    let optimisticItem: OptimisticComment | null = null;

    if (isReply && parentId) {
      // Create optimistic reply with unique temp ID
      tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      optimisticItem = {
        id: tempId,
        videoId,
        parentId,
        author: {
          id: currentUserId || "currentUser",
          displayName: "You",
          avatarUrl: "https://picsum.photos/seed/currentuser/100/100",
        },
        text: sanitizedText, // Use sanitizedText instead of text
        likeCount: 0,
        likedByCurrentUser: false,
        replyCount: 0,
        createdAt: new Date().toISOString(),
        status: "pending",
        isOptimistic: true,
        tempId,
      };
      
      // Add optimistic reply to parent's replies
      console.log(`[Comments] 📝 Adding optimistic reply to parent ${parentId}`);
      setCommentReplies((prev) => ({
        ...prev,
        [parentId]: [optimisticItem!, ...(prev[parentId] || [])],
      }));
      
      // Expand parent's replies
      setExpandedReplies((prev) => new Set(prev).add(parentId));
      
      // Increment parent's reply count
      const parentComment = comments.find((c) => c.id === parentId);
      if (parentComment) {
        updateComment(parentId, {
          replyCount: (parentComment.replyCount || 0) + 1,
        });
      }
    } else {
      // For top-level comments, let useCommentMutations handle optimistic creation
      // (via onOptimisticAdd callback) - don't create duplicate here
      console.log(`[Comments] 📝 Top-level comment - useCommentMutations will handle optimistic`);
    }

    // Send to server - use sanitizedText instead of text
    const request = {
      videoId,
      text: sanitizedText, // Use sanitizedText
      parentId,
    };

    try {
      const result = await postComment(request);

      if (result) {
        console.log(`[Comments] ✅ Server confirmed: ${result.id}`);
        
        if (isReply && parentId && tempId) {
          if (!result) {
            throw new Error("Failed to post reply");
          }

          // Replace optimistic reply with real one (only for replies)
          setCommentReplies((prev) => {
            const existing = prev[parentId] || [];
            // Filter out any optimistic version
            const filtered = existing.filter((r) => {
              const opt = r as OptimisticComment;
              return opt.id !== result.id && opt.tempId !== result.tempId && opt.tempId !== tempId;
            });
            return {
              ...prev,
              [parentId]: [...filtered, result],
            };
          });
        } else {
          // For top-level comments, useCommentMutations already handles replacement
          // via onOptimisticReplace callback - no need to do it here
          console.log(`[Comments] ✅ Top-level comment replacement handled by useCommentMutations`);
        }
      } else {
        console.log(`[Comments] ❌ Post failed, removing optimistic`);
        
        if (isReply && parentId && tempId) {
          // Remove failed optimistic reply
          setCommentReplies((prev) => ({
            ...prev,
            [parentId]: (prev[parentId] || []).filter((r) => {
              const opt = r as OptimisticComment;
              return opt.tempId !== tempId;
            }),
          }));
          
          // Decrement parent's reply count
          const parentComment = comments.find((c) => c.id === parentId);
          if (parentComment) {
            updateComment(parentId, {
              replyCount: Math.max(0, (parentComment.replyCount || 1) - 1),
            });
          }
        } else {
          // For top-level comments, useCommentMutations already handles removal
          // via onOptimisticRemove callback - no need to do it here
          console.log(`[Comments] ❌ Top-level comment removal handled by useCommentMutations`);
        }
      }

      // Clear reply context
      setReplyingTo(null);

      Logger.info(`[Comments] Comment posted: "${sanitizedText.substring(0, 30)}..."`);
    } catch (err) {
      console.error(`[Comments] ❌ Error posting comment:`, err);
      
      // Remove failed optimistic reply (top-level handled by useCommentMutations)
      if (isReply && parentId && tempId) {
        setCommentReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).filter((r) => {
            const opt = r as OptimisticComment;
            return opt.tempId !== tempId;
          }),
        }));
        
        // Decrement parent's reply count
        const parentComment = comments.find((c) => c.id === parentId);
        if (parentComment) {
          updateComment(parentId, {
            replyCount: Math.max(0, (parentComment.replyCount || 1) - 1),
          });
        }
      }
      // Top-level comments are handled by useCommentMutations onOptimisticRemove
      
      Logger.error("[Comments] Failed to post comment:", err);
      throw err; // Re-throw so CommentComposer can handle
    } finally {
      // Reset submission flag after a delay
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  }, [videoId, replyingTo, currentUserId, comments, postComment, updateComment, isSubmitting]);

  /**
   * Handle reply to comment
   */
  const handleReply = useCallback((comment: Comment) => {
    setReplyingTo({
      comment,
      displayName: comment.author.displayName,
      commentId: comment.id,
    });
    
    Logger.info(`[Comments] Replying to ${comment.id}`);
  }, []);

  /**
   * Cancel reply
   */
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    Logger.info("[Comments] Cancelled reply");
  }, []);

  /**
   * Toggle replies expanded (and load if needed)
   */
  const handleViewReplies = useCallback(async (commentId: string) => {
    const isCurrentlyExpanded = expandedReplies.has(commentId);
    
    if (isCurrentlyExpanded) {
      // Collapse
      console.log(`[Comments] 📁 Collapsing replies for ${commentId}`);
      setExpandedReplies((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    } else {
      // Expand - load replies if not already loaded
      console.log(`[Comments] 📂 Expanding replies for ${commentId}`);
      setExpandedReplies((prev) => new Set(prev).add(commentId));
      
      // Load replies from server if we don't have any yet
      if (!commentReplies[commentId] || commentReplies[commentId].length === 0) {
        try {
          console.log(`[Comments] 🔄 Loading replies from server for ${commentId}`);
          const { fetchReplies } = await import("../../services/commentsService");
          const response = await fetchReplies(commentId, null, 10);
          
          console.log(`[Comments] ✅ Loaded ${response.data.length} replies`);
          setCommentReplies((prev) => ({
            ...prev,
            [commentId]: response.data,
          }));
        } catch (err) {
          console.error(`[Comments] ❌ Failed to load replies:`, err);
        }
      }
    }
  }, [expandedReplies, commentReplies]);

  /**
   * Handle like comment
   */
  const handleLike = useCallback((
    commentId: string,
    currentlyLiked: boolean,
    currentCount: number
  ) => {
    toggleLike(commentId, currentlyLiked, currentCount);
  }, [toggleLike]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(async (commentId: string) => {
    const success = await deleteCommentById(commentId);
    if (success) {
      Logger.info(`[Comments] Comment ${commentId} deleted`);
    }
  }, [deleteCommentById]);

  /**
   * Handle report
   */
  const handleReport = useCallback(async (commentId: string) => {
    const success = await reportCommentById(commentId, "spam");
    if (success) {
      Logger.info(`[Comments] Comment ${commentId} reported`);
    }
  }, [reportCommentById]);

  /**
   * Handle close modal
   */
  const handleClose = useCallback(() => {
    setReplyingTo(null);
    onClose();
    Logger.info("[Comments] Modal closed");
  }, [onClose]);

  /**
   * Toggle sort order
   */
  const handleToggleSort = useCallback(() => {
    const newSort: CommentSortOrder = sortOrder === "top" ? "newest" : "top";
    setSortOrder(newSort);
    Logger.info(`[Comments] Sort changed to: ${newSort}`);
  }, [sortOrder, setSortOrder]);

  /**
   * Handle like on a reply
   */
  const handleLikeReply = useCallback((
    replyId: string,
    currentlyLiked: boolean,
    currentCount: number,
    parentId: string
  ) => {
    console.log(`[Comments] 👍 Liking reply ${replyId} under parent ${parentId}`);
    
    // Update the reply in local state
    setCommentReplies((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] || []).map((r) => {
        if (r.id === replyId) {
          return {
            ...r,
            likedByCurrentUser: !currentlyLiked,
            likeCount: !currentlyLiked ? currentCount + 1 : currentCount - 1,
          };
        }
        return r;
      }),
    }));
    
    // Also call the main like handler
    handleLike(replyId, currentlyLiked, currentCount);
  }, [handleLike]);

  /**
   * Render comment item
   */
  const renderComment = useCallback(({ item }: { item: Comment | OptimisticComment }) => {
    const isExpanded = expandedReplies.has(item.id);
    const replies = commentReplies[item.id] || [];
    
    console.log(`[Comments] 🎨 Rendering comment ${item.id}, replies: ${replies.length}, expanded: ${isExpanded}`);
    
    return (
      <View>
        <CommentItem
          comment={item}
          onLike={handleLike}
          onReply={handleReply}
          onDelete={handleDelete}
          onReport={handleReport}
          onViewReplies={handleViewReplies}
          repliesExpanded={isExpanded}
          currentUserId={currentUserId}
        />
        
        {/* Replies - render from local state */}
        {isExpanded && (item.replyCount > 0 || replies.length > 0) && (
          <View style={{ marginLeft: 48, backgroundColor: '#FAFAFA' }}>
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onLike={(id, liked, count) => handleLikeReply(id, liked, count, item.id)}
                onReply={handleReply}
                isReply
                currentUserId={currentUserId}
              />
            ))}
          </View>
        )}
      </View>
    );
  }, [
    expandedReplies,
    commentReplies,
    handleLike,
    handleLikeReply,
    handleReply,
    handleDelete,
    handleReport,
    handleViewReplies,
    currentUserId,
  ]);

  const slideAnimatedStyle = {
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [SCREEN_HEIGHT, 0],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        {/* Backdrop tap to close */}
        <Pressable 
          style={styles.backdropTouchable} 
          onPress={handleClose}
          hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
        />

        {/* Comments Panel */}
        <RNAnimated.View style={[styles.panel, slideAnimatedStyle]}>
          <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
            <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Comments</Text>
                <Text style={styles.headerCount}>{totalCount}</Text>
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
                    color="#606060"
                  />
                  <Text style={styles.sortText}>
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
                  <MaterialCommunityIcons name="close" size={24} color="#000000" />
                </Pressable>
              </View>
            </View>

            {/* Comments List */}
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              refreshControl={
                <RefreshControl
                  refreshing={isLoading && comments.length > 0}
                  onRefresh={refresh}
                  tintColor="#065FD4"
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                !isLoading ? (
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="comment-outline" size={48} color="#E0E0E0" />
                    <Text style={styles.emptyTitle}>No comments yet</Text>
                    <Text style={styles.emptyText}>Be the first to comment!</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color="#065FD4" />
                  </View>
                ) : null
              }
            />

            {/* Composer */}
            <CommentComposer
              avatarUrl="https://picsum.photos/seed/currentuser/100/100"
              replyingTo={replyingTo}
              onSubmit={handleSubmitComment}
              onCancelReply={handleCancelReply}
              placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
              isSubmitting={isSubmitting}
            />
            </View>
          </SafeAreaView>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
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
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
    borderBottomColor: "#E0E0E0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
  },
  headerCount: {
    fontSize: 14,
    color: "#606060",
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  sortText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000000",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#606060",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
});

export default CommentsModal;

