/**
 * utils/commentValidation.ts
 * 
 * Comment input validation and sanitization
 * - Length limits
 * - Content sanitization
 * - XSS prevention
 * - Rate limiting helpers
 * 
 * Production-ready with Zero Trust principles
 */

import Logger from "./Logger";

/**
 * Configuration for comment validation
 */
export const COMMENT_CONFIG = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 500,
  MAX_REPLIES_DEPTH: 1, // Only 1 level of replies (YouTube style)
  RATE_LIMIT_MS: 1000, // Min 1 second between posts
};

/**
 * Sanitize comment text without truncating to MAX_LENGTH.
 * - Remove control characters (preserving \t \n \r so whitespace
 *   normalization below can collapse them, instead of silently deleting them)
 * - Strip <script>...</script> blocks entirely (tag + content), then any
 *   remaining HTML tags
 * - Normalize whitespace
 */
function sanitizeCommentTextUnbounded(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // Remove control chars, keep \t \n \r
    .replace(/<script[\s\S]*?<\/script>/gi, "") // Remove script tags and their content
    .replace(/<[^>]*>/g, "") // Remove remaining HTML tags
    .replace(/[<>\"'`]/g, "") // Remove dangerous chars
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Sanitize comment text
 * - Remove control characters
 * - Strip HTML/script tags
 * - Normalize whitespace
 * - Limit length
 */
export function sanitizeCommentText(text: unknown): string {
  if (typeof text !== "string") return "";

  return sanitizeCommentTextUnbounded(text).slice(0, COMMENT_CONFIG.MAX_LENGTH);
}

/**
 * Validate comment text
 */
export function validateCommentText(text: string): {
  isValid: boolean;
  error?: string;
} {
  const sanitized = sanitizeCommentTextUnbounded(text);

  if (!sanitized || sanitized.length < COMMENT_CONFIG.MIN_LENGTH) {
    return {
      isValid: false,
      error: "Comment cannot be empty",
    };
  }

  if (sanitized.length > COMMENT_CONFIG.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Comment must be less than ${COMMENT_CONFIG.MAX_LENGTH} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Check if user can post (rate limiting)
 */
export function canUserPost(lastPostTime: number): boolean {
  const now = Date.now();
  const timeSinceLastPost = now - lastPostTime;
  
  if (timeSinceLastPost < COMMENT_CONFIG.RATE_LIMIT_MS) {
    Logger.warn(`[CommentValidation] Rate limit: ${COMMENT_CONFIG.RATE_LIMIT_MS - timeSinceLastPost}ms remaining`);
    return false;
  }

  return true;
}

/**
 * Format time ago (1m, 1h, 1d, etc.)
 */
export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  } catch (err) {
    Logger.error("[CommentValidation] Failed to format time:", err);
    return "";
  }
}

/**
 * Format like count (1.2K, 3.4M)
 */
export function formatLikeCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Detect and linkify URLs in comment text
 */
export function detectLinks(text: string): Array<{ type: "text" | "link"; content: string }> {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts: Array<{ type: "text" | "link"; content: string }> = [];
  
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before link
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add link
    parts.push({
      type: "link",
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

export default {
  COMMENT_CONFIG,
  sanitizeCommentText,
  validateCommentText,
  canUserPost,
  formatTimeAgo,
  formatLikeCount,
  detectLinks,
};

