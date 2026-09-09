// components/VideoPlayer/types.ts
/* Shared types used across the VideoPlayer component library */
import * as RN from "react-native";
import { useVideoPlayer } from "expo-video";

export type CaptionItem = {
  start: number;
  end?: number | null;
  text: string;
};

export type ChapterItem = {
  title: string;
  startMs: number;
};

export type VideoPlayerProps = {
  sourceUrl: string;
  autoplay?: boolean;
  hideControlsTimeout?: number;
  theme?: "dark" | "light" | "system";
  onFullscreenChange?: (isFullscreen: boolean) => void;
  captions?: CaptionItem[];
  chapters?: ChapterItem[];
  showLike?: boolean;
};

export type VideoViewProps = {
  player?: ReturnType<typeof useVideoPlayer> | null;
  sourceUrl?: string;
  onPlaybackStatusUpdate?: (s: any) => void;
  onFullscreenUpdate?: (e: any) => void;
  onLoad?: () => void;
  onError?: (e: any) => void;
  onVideoAreaPress?: (e: RN.GestureResponderEvent) => void;
  resizeMode?: "cover" | "contain" | "stretch" | "fill";
};

export type ControlsProps = {
	captionsEnabled: boolean;
  anim: RN.Animated.Value | any;
  controlsVisible: boolean;
  isLive: boolean;
  isPlaying: boolean;
  didJustFinish: boolean;
  isMuted: boolean;
  looping: boolean;
  autoplayEnabled: boolean;
  playbackRate: number;
  captionsLength: number;
  chapters: ChapterItem[];
  positionMillis: number;
  durationMillis: number | null;
  playableMillis: number | null;
  colors: { background: string; overlay: string; text: string; muted: string; controlSurface?: string; scheme?: RN.ColorSchemeName };
  handlers: any; // carries many handlers and style refs; kept generic for brevity
  tokens: any;
  textColor: string;
};
