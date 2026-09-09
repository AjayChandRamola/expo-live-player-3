/**
 * components/Comments/index.ts
 * 
 * Barrel export for Comments components
 * Provides clean imports for comments functionality
 */

export { default as CommentsModal } from "./CommentsModal";
export { CommentItem } from "./CommentItem";
export { RepliesList } from "./RepliesList";
export { CommentComposer } from "./CommentComposer";

// Home Page comments (YouTube-style for normal videos)
export * from "./Home";

