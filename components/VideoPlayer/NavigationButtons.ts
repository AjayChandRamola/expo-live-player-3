/**
 * components/VideoPlayer/NavigationButtons.ts
 *
 * Centralized exports for YouTube-style navigation buttons
 * Import from this file for cleaner code organization
 */

export { PreviousVideoButton } from './PreviousVideoButton';
export type { PreviousVideoButtonProps } from './PreviousVideoButton';

export { NextVideoButton } from './NextVideoButton';
export type { NextVideoButtonProps } from './NextVideoButton';

export { MinimizeButton } from './MinimizeButton';
export type { MinimizeButtonProps } from './MinimizeButton';

export { YouTubeControlsDemo } from './YouTubeControlsDemo';
export { AutoplayToggleDemo } from './AutoplayToggleDemo';
export { default as AutoplayToggle } from './AutoplayToggle';
export { default as AutoplayNotification } from './AutoplayNotification';
export { default as FullscreenButton } from './FullscreenButton';
export type { FullscreenButtonProps } from './FullscreenButton';

// Convenience re-export of existing PlayPauseButton
export { PlayPauseButton } from './PlayPauseButton';
export type { PlayPauseButtonProps } from './PlayPauseButton';

