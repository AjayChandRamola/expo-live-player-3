// constants/config.ts
/**
 * Player actions with UI but no verified end-to-end implementation.
 * All false for MVP. Flip one to true only when it is verified on device.
 * See HLD section F.5 and M.
 */
export const PLAYER_FEATURE_FLAGS = {
  download: false,
  pictureInPicture: false,
  qualitySelection: false,
  clipEditor: false,
  thanks: false,
  report: false,
  dislike: false,
} as const;
