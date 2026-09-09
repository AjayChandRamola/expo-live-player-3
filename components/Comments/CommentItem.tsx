/**
 * components/Comments/CommentItem.tsx
 * 
 * Individual comment component
 * - Avatar, author, time, text
 * - Like button with count
 * - Reply button
 * - More menu (report, edit, delete)
 * - Expandable long text
 * - Reply count and expand toggle
 * - Optimistic state handling
 * 
 * Production-ready, accessible, YouTube-style
 */

import React, { memo, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import type { Comment, OptimisticComment } from "../../types/comment";
import { formatTimeAgo, formatLikeCount } from "../../utils/commentValidation";
import Logger from "../../utils/Logger";

interface CommentItemProps {
  comment: Comment | OptimisticComment;
  onLike: (commentId: string, currentlyLiked: boolean, currentCount: number) => void;
  onReply: (comment: Comment) => void;
  onEdit?: (commentId: string, newText: string) => void;
  onDelete?: (commentId: string) => void;
  onReport?: (commentId: string) => void;
  onViewReplies?: (commentId: string) => void;
  isReply?: boolean;
  repliesExpanded?: boolean;
  currentUserId?: string;
}

/**
 * CommentItem Component
 */
function CommentItemComponent({
  comment,
  onLike,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onViewReplies,
  isReply = false,
  repliesExpanded = false,
  currentUserId,
}: CommentItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const likeScale = useSharedValue(1);
  const isOptimistic = "isOptimistic" in comment && comment.isOptimistic;
  const isOwnComment = comment.author.id === currentUserId;

  // Check if comment is long (needs expansion)
  // Safety check for undefined text
  const commentText = comment.text || "";
  const isLongComment = commentText.length > 150;
  const displayText = isLongComment && !isExpanded
    ? commentText.substring(0, 150) + "..."
    : commentText;

  /**
   * Handle like button
   */
  const handleLike = useCallback(() => {
    // Animate like button
    likeScale.value = withSequence(
      withSpring(1.3, { damping: 2 }),
      withSpring(1, { damping: 2 })
    );

    onLike(comment.id, comment.likedByCurrentUser, comment.likeCount);
    
    Logger.info(`[CommentItem] Like toggled for ${comment.id}`);
  }, [comment.id, comment.likedByCurrentUser, comment.likeCount, onLike, likeScale]);

  /**
   * Handle reply button
   */
  const handleReply = useCallback(() => {
    onReply(comment);
    Logger.info(`[CommentItem] Reply initiated for ${comment.id}`);
  }, [comment, onReply]);

  /**
   * Handle view replies
   */
  const handleViewReplies = useCallback(() => {
    onViewReplies?.(comment.id);
    Logger.info(`[CommentItem] View replies for ${comment.id}`);
  }, [comment.id, onViewReplies]);

  /**
   * Handle edit
   */
  const handleEdit = useCallback(() => {
    if (!onEdit) return;

    Alert.prompt(
      "Edit Comment",
      "Enter your new comment text:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: (newText) => {
            if (newText) {
              onEdit(comment.id, newText);
            }
          },
        },
      ],
      "plain-text",
      comment.text
    );

    setShowMenu(false);
  }, [comment.id, comment.text, onEdit]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(() => {
    if (!onDelete) return;

    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(comment.id),
        },
      ]
    );

    setShowMenu(false);
  }, [comment.id, onDelete]);

  /**
   * Handle report
   */
  const handleReport = useCallback(() => {
    if (!onReport) return;

    Alert.alert(
      "Report Comment",
      "Why are you reporting this comment?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Spam", onPress: () => onReport(comment.id) },
        { text: "Inappropriate", onPress: () => onReport(comment.id) },
        { text: "Misleading", onPress: () => onReport(comment.id) },
      ]
    );

    setShowMenu(false);
  }, [comment.id, onReport]);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  // Removed/hidden comment
  if (comment.status === "removed") {
    return (
      <View style={[styles.container, isReply && styles.replyContainer]}>
        <View style={styles.removedContainer}>
          <Text style={styles.removedText}>Comment removed</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isReply && styles.replyContainer]}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{comment.author.displayName.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Author and Time */}
        <View style={styles.header}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{comment.author.displayName}</Text>
            {comment.author.isVerified && (
              <MaterialCommunityIcons name="check-decagram" size={14} color="#065FD4" />
            )}
            <Text style={styles.timeAgo}>{formatTimeAgo(comment.createdAt)}</Text>
          </View>

          {/* More Menu */}
          <Pressable
            onPress={() => setShowMenu(!showMenu)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="dots-vertical" size={20} color="#606060" />
          </Pressable>
        </View>

        {/* Menu Options */}
        {showMenu && (
          <View style={styles.menu}>
            {isOwnComment && onEdit && (
              <Pressable style={styles.menuItem} onPress={handleEdit}>
                <Text style={styles.menuText}>Edit</Text>
              </Pressable>
            )}
            {isOwnComment && onDelete && (
              <Pressable style={styles.menuItem} onPress={handleDelete}>
                <Text style={[styles.menuText, styles.menuTextDanger]}>Delete</Text>
              </Pressable>
            )}
            {!isOwnComment && onReport && (
              <Pressable style={styles.menuItem} onPress={handleReport}>
                <Text style={styles.menuText}>Report</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Comment Text */}
        <Pressable onPress={() => isLongComment && setIsExpanded(!isExpanded)}>
          <Text style={styles.commentText}>
            {displayText}
            {isLongComment && !isExpanded && (
              <Text style={styles.readMore}> Read more</Text>
            )}
          </Text>
        </Pressable>

        {/* Edited Indicator */}
        {comment.metadata?.isEdited && (
          <Text style={styles.edited}>(edited)</Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Like Button */}
          <Pressable
            style={styles.actionButton}
            onPress={handleLike}
            disabled={isOptimistic}
            accessible
            accessibilityLabel={comment.likedByCurrentUser ? "Unlike comment" : "Like comment"}
            accessibilityRole="button"
          >
            <Animated.View style={likeAnimatedStyle}>
              <MaterialCommunityIcons
                name={comment.likedByCurrentUser ? "thumb-up" : "thumb-up-outline"}
                size={16}
                color={comment.likedByCurrentUser ? "#065FD4" : "#606060"}
              />
            </Animated.View>
            {comment.likeCount > 0 && (
              <Text style={styles.actionText}>{formatLikeCount(comment.likeCount)}</Text>
            )}
          </Pressable>

          {/* Reply Button */}
          {!isReply && (
            <Pressable
              style={styles.actionButton}
              onPress={handleReply}
              disabled={isOptimistic}
              accessible
              accessibilityLabel="Reply to comment"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="reply-outline" size={16} color="#606060" />
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
          )}

          {/* Optimistic Indicator */}
          {isOptimistic && (
            <View style={styles.pendingIndicator}>
              <ActivityIndicator size="small" color="#999999" />
              <Text style={styles.pendingText}>Posting...</Text>
            </View>
          )}
        </View>

        {/* View Replies Toggle */}
        {!isReply && comment.replyCount > 0 && (
          <Pressable
            style={styles.viewRepliesButton}
            onPress={handleViewReplies}
            accessible
            accessibilityLabel={`View ${comment.replyCount} replies`}
            accessibilityRole="button"
          >
            <View style={styles.replyLine} />
            <MaterialCommunityIcons
              name={repliesExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#065FD4"
            />
            <Text style={styles.viewRepliesText}>
              {repliesExpanded ? "Hide" : "View"} {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  replyContainer: {
    paddingLeft: 64,
    backgroundColor: "#FAFAFA",
  },
  avatar: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#606060",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000000",
  },
  timeAgo: {
    fontSize: 12,
    color: "#606060",
  },
  menu: {
    position: "absolute",
    top: 24,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
  },
  menuText: {
    fontSize: 14,
    color: "#000000",
  },
  menuTextDanger: {
    color: "#FF0000",
  },
  commentText: {
    fontSize: 14,
    color: "#000000",
    lineHeight: 20,
    marginBottom: 8,
  },
  readMore: {
    color: "#606060",
    fontWeight: "600",
  },
  edited: {
    fontSize: 11,
    color: "#606060",
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    color: "#606060",
    fontWeight: "600",
  },
  pendingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pendingText: {
    fontSize: 11,
    color: "#999999",
  },
  viewRepliesButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  replyLine: {
    width: 24,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  viewRepliesText: {
    fontSize: 13,
    color: "#065FD4",
    fontWeight: "600",
  },
  removedContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  removedText: {
    fontSize: 13,
    color: "#999999",
    fontStyle: "italic",
  },
});

export const CommentItem = memo(CommentItemComponent);

export default CommentItem;

