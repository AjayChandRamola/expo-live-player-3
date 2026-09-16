// components/VideoPlayer/platform/types.ts
// Interfaces for device capabilities. One .native.ts and one .web.ts per adapter.
// Spec: docs/player/05-platform-adapters-spec.md §1

export type AdapterResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };
export const ok: AdapterResult = Object.freeze({ ok: true }) as AdapterResult;
export const fail = (reason: string): AdapterResult => ({ ok: false, reason });
export const reasonOf = (error: unknown): string => (error instanceof Error ? error.name : "unknown");

export type Unsubscribe = () => void;

/** Web needs a DOM element to act on; native ignores the target. */
export interface ElementTarget {
  readonly getElement: () => unknown;
}

export interface FullscreenAdapter {
  enter(target?: ElementTarget): Promise<AdapterResult>;
  exit(): Promise<AdapterResult>;
  isActive(): boolean;
  subscribe(listener: (active: boolean) => void): Unsubscribe;
}

export type OrientationMode = "landscape" | "portrait";
export interface OrientationAdapter {
  lock(mode: OrientationMode): Promise<AdapterResult>;
  unlock(): Promise<AdapterResult>;
  subscribe(listener: (isPortrait: boolean) => void): Unsubscribe;
}

export interface SystemChromeAdapter {
  hide(): Promise<AdapterResult>;
  show(): Promise<AdapterResult>;
}

export type PlayerKey =
  | "togglePlay" | "fullscreen" | "mute" | "exit"
  | "seekBack5" | "seekForward5" | "seekBack10" | "seekForward10"
  | "seekPercent0" | "seekPercent1" | "seekPercent2" | "seekPercent3" | "seekPercent4"
  | "seekPercent5" | "seekPercent6" | "seekPercent7" | "seekPercent8" | "seekPercent9"
  | "rateDown" | "rateUp" | "captions";

export interface KeyboardAdapter {
  subscribe(handler: (key: PlayerKey) => void): Unsubscribe;
  subscribeHover(target: ElementTarget, onHover: () => void): Unsubscribe;
}

/** Native: the expo-video VideoView ref. Web: a getter for the surface element. */
export interface PictureInPictureTarget extends Partial<ElementTarget> {
  readonly startPictureInPicture?: () => Promise<void>;
  readonly stopPictureInPicture?: () => Promise<void>;
}
export interface PictureInPictureAdapter {
  isSupported(): boolean;
  start(target: PictureInPictureTarget): Promise<AdapterResult>;
  stop(target: PictureInPictureTarget): Promise<AdapterResult>;
  /** Web: listens to the <video> element's PiP events. Native: no-op (VideoView props carry them). */
  subscribe(target: PictureInPictureTarget, listener: (active: boolean) => void): Unsubscribe;
}

export interface BrightnessAdapter {
  /** Web only: registers the element that receives the CSS filter. Native: no-op. */
  attach(target: ElementTarget): void;
  get(): Promise<number>;
  set(level: number): Promise<AdapterResult>;
  restore(): Promise<AdapterResult>;
}

export interface HapticsAdapter {
  light(): void;
}
