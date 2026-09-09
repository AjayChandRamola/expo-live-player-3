// components/VideoPlayer/hooks/useVideoPlayer.ts
/* 
  Dependencies:
    - react
    - react-native
    - expo-av
    - expo-screen-orientation
  Encapsulates all logic and state. Exposes refs, state, derived, handlers, and utilities for UI.
*/
import React from "react";
import * as RN from "react-native";
import { Video, AVPlaybackStatus, VideoFullscreenUpdate } from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import { TOKENS } from "../tokens";
import { formatTime } from "../utils";
import type { VideoPlayerProps, CaptionItem, ChapterItem } from "../types";
import { styles } from "../styles";

export default function useVideoPlayer(props: VideoPlayerProps) {
  const { sourceUrl, autoplay = true, captions = [], chapters = [], theme = "system", onFullscreenChange } = props;

  // Refs
  const videoRef = React.useRef<Video | null>(null);
  const lastTapRef = React.useRef<number>(0);
  const anim = React.useRef(new RN.Animated.Value(1)).current;

  // Core state
  const [status, setStatus] = React.useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = React.useState<boolean>(true);
  const [playerKey, setPlayerKey] = React.useState<number>(0);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = React.useState<boolean>(false);
  const [displayMode, setDisplayMode] = React.useState<"cover" | "contain" | "stretch">("cover");
  const [playbackRate, setPlaybackRate] = React.useState<number>(1.0);
  const [captionsEnabled, setCaptionsEnabled] = React.useState<boolean>(!!captions.length);
  const [liked, setLiked] = React.useState<boolean>(false);
  const [saved, setSaved] = React.useState<boolean>(false);
  const [looping, setLooping] = React.useState<boolean>(false);
  const [autoplayEnabled, setAutoplayEnabled] = React.useState<boolean>(true); // autoplay next video
  const [menuVisible, setMenuVisible] = React.useState<boolean>(false);
  const [speedMenuVisible, setSpeedMenuVisible] = React.useState<boolean>(false);
  const [qualityMenuVisible, setQualityMenuVisible] = React.useState<boolean>(false);
  const [title, setTitle] = React.useState<string>(""); // editable title

  // Layout detection
  const window = RN.useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = React.useState<number>(window.width);
  const [layoutHeight, setLayoutHeight] = React.useState<number>(window.height);
  React.useEffect(() => {
    setLayoutWidth(window.width);
    setLayoutHeight(window.height);
  }, [window.width, window.height]);

  // Derived values
  const positionMillis = (status?.positionMillis ?? 0) as number;
  const durationMillis = (status?.durationMillis ?? null) as number | null;
  const playableMillis = (status as any)?.playableDurationMillis ?? null;
  const isLoaded = status?.isLoaded ?? false;
  const isBuffering = status?.isBuffering ?? false;
  const isPlaying = status?.isPlaying ?? false;
  const isMuted = status?.isMuted ?? false;
  const didJustFinish = status?.didJustFinish ?? false;
  const isLive = durationMillis == null || durationMillis === 0;

  // Theme colors (light/dark)
  const [systemScheme, setSystemScheme] = React.useState<RN.ColorSchemeName>(RN.Appearance.getColorScheme());
  React.useEffect(() => {
    const sub = RN.Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove?.();
  }, []);
  const colorScheme = theme === "system" ? systemScheme : (theme as RN.ColorSchemeName);
  const colors = colorScheme === "light" ? TOKENS.light : TOKENS.dark;
  const inputBackground = colorScheme === "light" ? "#fff" : "rgba(255,255,255,0.03)";

  // Helpers
  const clearHideTimer = React.useCallback(() => {
    // placeholder — no auto hide by design
  }, []);

  const showControls = React.useCallback(() => {
    setControlsVisible(true);
    RN.Animated.timing(anim, {
      toValue: 1,
      duration: TOKENS.animation.duration,
      easing: RN.Easing.inOut(RN.Easing.ease),
      useNativeDriver: true,
    }).start();
    clearHideTimer();
    console.debug("[Player][Controls] showControls invoked (auto-hide disabled)");
  }, [anim, clearHideTimer]);

  const hideControls = React.useCallback(() => {
    RN.Animated.timing(anim, {
      toValue: 0,
      duration: TOKENS.animation.duration,
      easing: RN.Easing.inOut(RN.Easing.ease),
      useNativeDriver: true,
    }).start(() => setControlsVisible(false));
    clearHideTimer();
    console.debug("[Player][Controls] hideControls invoked");
  }, [anim, clearHideTimer]);

  const toggleControls = React.useCallback(() => {
    if (controlsVisible) hideControls();
    else showControls();
    console.debug("[Player][Controls] toggleControls ->", !controlsVisible);
  }, [controlsVisible, hideControls, showControls]);

  const safeCall = React.useCallback(async (fn: (v: Video) => Promise<void> | void) => {
    const ref = videoRef.current;
    if (!ref) {
      console.warn("[Player][safeCall] videoRef is null");
      return;
    }
    try {
      await fn(ref);
    } catch (e) {
      console.error("[Player][safeCall] error:", e);
    }
  }, []);

  // playback status update
  const onPlaybackStatusUpdate = React.useCallback((s: AVPlaybackStatus) => {
    setStatus(s);
    setLoading(!s.isLoaded || s.isBuffering);
    if (s.isLoaded && (s as any).error) {
      const err = (s as any).error;
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      setError(msg);
      console.error("[Player][Playback] playback error:", msg);
    }
  }, []);

  const onLoad = React.useCallback(() => {
    setLoading(false);
    console.debug("[Player] onLoad fired");
  }, []);

  const onError = React.useCallback((e: unknown) => {
    setError("Playback error");
    console.error("[Player][expo-av] error:", e);
  }, []);

  const cycleDisplayMode = React.useCallback(() => {
    setDisplayMode((prev) => (prev === "cover" ? "contain" : prev === "contain" ? "stretch" : "cover"));
    showControls();
    console.debug("[Player][Action] cycleDisplayMode");
  }, [showControls]);

  const setRate = React.useCallback(
    async (rate: number) => {
      await safeCall(async (ref) => {
        try {
          await (ref as any).setRateAsync?.(rate, true);
          setPlaybackRate(rate);
        } catch (e) {
          console.warn("[Player][setRate] failed:", e);
        }
      });
      showControls();
    },
    [safeCall, showControls]
  );

  const togglePlay = React.useCallback(async () => {
    await safeCall(async (ref) => {
      const s = await ref.getStatusAsync();
      if (!s.isLoaded) return;
      if (s.isPlaying) await ref.pauseAsync();
      else {
        if (s.didJustFinish) await ref.setPositionAsync(0);
        await ref.playAsync();
      }
    });
    showControls();
    console.debug("[Player][Action] togglePlay");
  }, [safeCall, showControls]);

  const toggleMute = React.useCallback(async () => {
    await safeCall(async (ref) => {
      const s = await ref.getStatusAsync();
      if (!s.isLoaded) return;
      await ref.setIsMutedAsync(!s.isMuted);
    });
    showControls();
    console.debug("[Player][Action] toggleMute");
  }, [safeCall, showControls]);

  const toggleLoop = React.useCallback(async () => {
    await safeCall(async (ref) => {
      const s = await ref.getStatusAsync();
      if (!s.isLoaded) return;
      await ref.setIsLoopingAsync(!s.isLooping);
      setLooping((v) => !v);
    });
    showControls();
    console.debug("[Player][Action] toggleLoop");
  }, [safeCall, showControls]);

  const toggleFullscreen = React.useCallback(async () => {
    if (RN.Platform.OS === "ios") {
      try {
        if (videoRef.current && typeof (videoRef.current as any).presentFullscreenPlayer === "function") {
          await (videoRef.current as any).presentFullscreenPlayer();
          setIsFullscreen(true);
          setIsNativeFullscreen(true);
        }
      } catch (e) {
        console.warn("[Player][fullscreen ios] error:", e);
      }
    } else {
      if (!isFullscreen) {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        } catch (e) {
          console.warn("[Player][Orientation] lock landscape failed:", e);
        }
        setIsFullscreen(true);
      } else {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch (e) {
          console.warn("[Player][Orientation] unlock/portrait failed:", e);
        }
        setIsFullscreen(false);
      }
    }
    showControls();
    console.debug("[Player][Action] toggleFullscreen -> isFullscreen:", !isFullscreen);
  }, [isFullscreen, showControls]);

  const onFullscreenUpdate = React.useCallback(
    (event: { fullscreenUpdate?: VideoFullscreenUpdate }) => {
      try {
        if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_PRESENT) {
          setIsNativeFullscreen(true);
        } else if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
          setIsNativeFullscreen(false);
          setIsFullscreen(false);
          (async () => {
            try {
              await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            } catch (e) {
              console.warn("[Player][Orientation] lock portrait failed:", e);
            }
            try {
              RN.StatusBar.setHidden(false, "fade");
            } catch {}
          })();
          showControls();
        }
      } catch (e) {
        console.warn("[Player][Fullscreen] update handler error:", e);
      }
    },
    [showControls]
  );

  const onSeekComplete = React.useCallback(
    async (value: number) => {
      await safeCall(async (ref) => {
        const s = await ref.getStatusAsync();
        if (!s.isLoaded || s.durationMillis == null) return;
        const target = Math.max(0, Math.min(value * s.durationMillis, s.durationMillis));
        await ref.setPositionAsync(Math.floor(target), {
          toleranceMillisBefore: 200,
          toleranceMillisAfter: 200,
        });
      });
      showControls();
    },
    [safeCall, showControls]
  );

  const QUICK_MS = 10000;
  const quickSeek = React.useCallback(
    async (offsetMs: number) => {
      await safeCall(async (ref) => {
        const s = await ref.getStatusAsync();
        if (!s.isLoaded || s.durationMillis == null) return;
        const pos = Math.max(0, Math.min((s.positionMillis ?? 0) + offsetMs, s.durationMillis));
        await ref.setPositionAsync(Math.floor(pos));
      });
      showControls();
    },
    [safeCall, showControls]
  );

  const onVideoAreaPress = React.useCallback(
    (evt: RN.GestureResponderEvent) => {
      const now = Date.now();
      const last = lastTapRef.current;
      lastTapRef.current = now;
      if (now - last < 300) {
        const { width: screenWidth } = RN.Dimensions.get("window");
        const pageX = evt.nativeEvent.pageX ?? evt.nativeEvent.locationX ?? 0;
        pageX < screenWidth / 2 ? quickSeek(-QUICK_MS) : quickSeek(QUICK_MS);
        console.debug("[Player][Gesture] double-tap seek");
      } else {
        toggleControls();
      }
    },
    [quickSeek, toggleControls]
  );

  const handleRetry = React.useCallback(() => {
    setError(null);
    setLoading(true);
    setPlayerKey((p) => p + 1);
    setTimeout(() => RN.AccessibilityInfo.announceForAccessibility("Retrying video"), 100);
    console.info("[Player] retry requested");
  }, []);

  // Share / Download / PiP placeholders
  const onShare = React.useCallback(async () => {
    try {
      await RN.Share.share({ message: sourceUrl, url: sourceUrl, title: "Watch this video" });
      console.info("[Player][Share] success");
    } catch (e) {
      console.warn("[Player][Share] failed:", e);
    }
    setMenuVisible(false);
    showControls();
  }, [sourceUrl, showControls]);

  const onThanks = React.useCallback(() => {
    RN.Alert.alert("Thanks", "Thanks sent (placeholder).");
    showControls();
    console.debug("[Player][Thanks]");
  }, [showControls]);

  const onDownload = React.useCallback(() => {
    RN.Alert.alert("Download", "Download started (placeholder). Implement native download when needed.");
    setMenuVisible(false);
    showControls();
    console.debug("[Player][Download] placeholder");
  }, [showControls]);

  const onTogglePip = React.useCallback(async () => {
    try {
      if (videoRef.current && typeof (videoRef.current as any).presentPictureInPicture === "function") {
        await (videoRef.current as any).presentPictureInPicture();
      } else {
        RN.Alert.alert("Picture-in-picture", "PiP is not supported on this platform/build.");
      }
    } catch (e) {
      console.warn("[Player][PiP] failed:", e);
    }
    setMenuVisible(false);
    showControls();
  }, [showControls]);

  const onSelectQuality = React.useCallback(
    (q: string) => {
      RN.Alert.alert("Quality", `Selected ${q} (placeholder)`);
      setQualityMenuVisible(false);
      showControls();
    },
    [showControls]
  );

  const toggleCaptions = React.useCallback(() => {
    setCaptionsEnabled((v) => !v);
    showControls();
  }, [showControls]);

  const toggleLike = React.useCallback(() => {
    setLiked((l) => !l);
    showControls();
  }, [showControls]);

  const toggleSave = React.useCallback(() => {
    setSaved((s) => !s);
    showControls();
  }, [showControls]);

  const toggleAutoplay = React.useCallback(() => {
    setAutoplayEnabled((a) => !a);
    showControls();
    console.debug("[Player][Action] toggleAutoplay");
  }, [showControls]);

  const jumpToChapter = React.useCallback(
    async (c: ChapterItem) => {
      await safeCall(async (ref) => {
        const s = await ref.getStatusAsync();
        if (!s.isLoaded) return;
        await ref.setPositionAsync(c.startMs);
      });
      showControls();
    },
    [safeCall, showControls]
  );

  const replay = React.useCallback(async () => {
    await safeCall(async (ref) => {
      await ref.setPositionAsync(0);
      await ref.playAsync();
    });
    showControls();
  }, [safeCall, showControls]);

  // effect: notify parent fullscreen changes
  React.useEffect(() => {
    try {
      onFullscreenChange?.(isFullscreen || isNativeFullscreen);
    } catch (e) {
      console.warn("[Player][onFullscreenChange] handler error:", e);
    }
  }, [isFullscreen, isNativeFullscreen, onFullscreenChange]);

  // validate URL
  React.useEffect(() => {
    try {
      // eslint-disable-next-line no-new
      new URL(sourceUrl);
      setError(null);
    } catch (e: any) {
      setError("Invalid video URL");
      console.error("[Player] Invalid video URL:", e?.message ?? e);
    }
  }, [sourceUrl]);

  // cleanup
  React.useEffect(() => {
    return () => {
      (async () => {
        try {
          await ScreenOrientation.unlockAsync();
        } catch {}
        try {
          RN.StatusBar.setHidden(false, "fade");
        } catch {}
        if (videoRef.current) {
          try {
            await videoRef.current.unloadAsync();
            console.debug("[Player] unloaded video on unmount");
          } catch {}
        }
      })();
    };
  }, []);

  // chapters index
  const currentChapterIndex = React.useMemo(() => {
    if (!chapters?.length) return -1;
    let idx = -1;
    for (let i = 0; i < chapters.length; i++) {
      if ((durationMillis ?? 0) >= chapters[i].startMs && positionMillis >= chapters[i].startMs) idx = i;
    }
    return idx;
  }, [chapters, positionMillis, durationMillis]);

  // active caption (simple)
  const currentCaption = React.useMemo<CaptionItem | undefined>(() => {
    if (!captionsEnabled || !captions?.length) return undefined;
    return captions.find((c) => positionMillis >= c.start && (c.end == null || positionMillis <= c.end));
  }, [captionsEnabled, captions, positionMillis]);

  // Expose state, handlers, derived
  const state = {
    status,
    loading,
    error,
    controlsVisible,
    playerKey,
    isFullscreen,
    isNativeFullscreen,
    displayMode,
    playbackRate,
    captionsEnabled,
    liked,
    saved,
    looping,
    autoplayEnabled,
    menuVisible,
    speedMenuVisible,
    qualityMenuVisible,
    title,
    anim,
    // style helper export for controls
    styles,
  };

  const handlers = {
    // event handlers for the UI
    onPlaybackStatusUpdate,
    onFullscreenUpdate,
    onLoad,
    onError,
    togglePlay,
    toggleMute,
    toggleLoop,
    toggleFullscreen,
    onSeekComplete,
    quickSeek,
    onVideoAreaPress,
    handleRetry,
    onShare,
    onThanks,
    onDownload,
    onTogglePip,
    onSelectQuality,
    toggleCaptions,
    toggleLike,
    toggleSave,
    toggleAutoplay,
    jumpToChapter,
    replay,
    setTitle,
    openMenu: () => setMenuVisible(true),
    openSpeedMenu: () => setSpeedMenuVisible(true),
    openQualityMenu: () => setQualityMenuVisible(true),
    closeMenus: () => {
      setMenuVisible(false);
      setQualityMenuVisible(false);
      setSpeedMenuVisible(false);
    },
    styles,
    utils: { formatTime },
    didJustFinish,
  };

  const derived = {
    positionMillis,
    durationMillis,
    playableMillis,
    isLive,
    isLoaded,
    isBuffering,
    isPlaying,
    isMuted,
    didJustFinish,
    currentCaption,
    currentChapterIndex,
    colors,
    inputBackground,
    scheme: colorScheme,
  };

  const layout = {
    isLandscape: isFullscreen || layoutWidth > layoutHeight,
    layoutWidth,
    layoutHeight,
    containerStyle: isFullscreen
      ? {
          position: "absolute" as const,
          top: 0,
          left: 0,
          width: layoutWidth,
          height: layoutHeight,
          zIndex: 9999,
          backgroundColor: "black",
        }
      : {
          position: "relative" as const,
          width: layoutWidth,
          height: Math.floor(layoutHeight / 2),
        },
  };

  return {
    videoRef,
    state,
    handlers,
    derived,
    layout,
    accessibilityProps: { accessible: true },
  };
}
