// components/VideoPlayer/platform/index.ts
// The only import path consumers use. Metro resolves the platform file per target.
export { fullscreenAdapter } from "./fullscreen";
export { orientationAdapter } from "./orientation";
export { systemChromeAdapter } from "./systemChrome";
export { keyboardAdapter } from "./keyboard";
export { pictureInPictureAdapter } from "./pictureInPicture";
export { brightnessAdapter } from "./brightness";
export { hapticsAdapter } from "./haptics";
export * from "./types";
