/**
 * components/VideoPlayer/index.tsx
 *
 * Full VideoPlayer integrating:
 * - expo-video VideoView and useVideoPlayer
 * - usePlayPauseController for center Play/Pause overlay behavior
 * - PlayPauseButton presentational component
 *
 * Backwards-compatible props preserved:
 * - default export is VideoPlayer component
 *
 * Key behaviors implemented:
 * - Center Play/Pause button visible initially ~3s, auto-hide when playing
 * - Auto-hide resumes after play/resume
 * - Single-tap toggles (visible / hide) with paused-stays-visible rule
 * - Double-tap quick-seek preserved (heuristic detection)
 * - Defensive programming and observability (structured logs)
 *
 * Dependencies: react, react-native, expo-video, @expo/vector-icons
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  Text,
  StatusBar,
  Dimensions,
  Platform,
  Modal,
  SafeAreaView,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import PlayPauseButton from "./PlayPauseButton";
import { PreviousVideoButton } from "./PreviousVideoButton";
import { NextVideoButton } from "./NextVideoButton";
import { MinimizeButton } from "./MinimizeButton";
import AutoplayToggle from "./AutoplayToggle";
import AutoplayNotification from "./AutoplayNotification";
import FullscreenButton from "./FullscreenButton";
import { usePlayPauseController } from "./usePlayPauseController";
import { VideoProgressBar } from "./VideoProgressBar";
import { VideoTimeOverlay } from "./VideoTimeOverlay";
import { VideoActionBar } from "./VideoActionBar";
import { VideoShareSheet } from "./modals/VideoShareSheet";
import { VideoDownloadModal } from "./modals/VideoDownloadModal";
import { VideoClipEditor } from "./modals/VideoClipEditor";
import { VideoSaveSheet } from "./modals/VideoSaveSheet";
import { VideoOverflowMenu } from "./modals/VideoOverflowMenu";
import { useVideoProgress } from "../../hooks/useVideoProgress";
import { useVideoActions } from "../../hooks/useVideoActions";
import Logger from "../../utils/Logger";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  sourceUrl: string;
  autoplay?: boolean;
  buttonSize?: number;
  // Navigation props
  hasPreviousVideo?: boolean;
  hasNextVideo?: boolean;
  onNavigateToPrevious?: () => void;
  onNavigateToNext?: () => void;
  // Minimize/PiP props
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  // Fullscreen callback
  onFullscreenChange?: (full: boolean) => void;
  // Autoplay callbacks
  isAutoplayEnabled?: boolean;
  onVideoFinished?: () => void;
  // Legacy props (for compatibility)
  captions?: any;
  chapters?: any;
  hideControlsTimeout?: number;
  theme?: string;
  // Video metadata — consumed by the action bar, share sheet, and overflow menu.
  // videoId must be a non-empty string for the action bar and progress bar to render
  // (see the guards at the `!isFullscreen && !isMinimized && videoId` conditions below).
  videoId?: string;
  videoTitle?: string;
  videoUrl?: string;
  channelId?: string;
};

const DEFAULT_BUTTON_SIZE = 80;
/** Quick seek amount (ms) for double-tap */
const QUICK_MS = 10000;

/** Structured logger for this module */
const log = (...args: any[]) => {
  if (__DEV__) console.info("[Player]", ...args);
};

/**
 * VideoPlayer component
 */
const VideoPlayer: React.FC<Props> = ({
  sourceUrl,
  autoplay = true,
  buttonSize = DEFAULT_BUTTON_SIZE,
  // Navigation props with defaults
  hasPreviousVideo = false,
  hasNextVideo = false,
  onNavigateToPrevious = () => log("Previous video pressed (no handler)"),
  onNavigateToNext = () => log("Next video pressed (no handler)"),
  // Minimize props with defaults
  isMinimized = false,
  onToggleMinimize = () => log("Minimize/Restore pressed (no handler)"),
  // Fullscreen callback
  onFullscreenChange,
  // Autoplay props
  isAutoplayEnabled = true,
  onVideoFinished,
  // Video metadata
  videoId,
  videoTitle,
  videoUrl,
  channelId,
}) => {
  const lastTapRef = useRef<number>(0);
  
  // Create video player instance
  const player = useVideoPlayer(sourceUrl, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Autoplay state for next video
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  
  // Notification state
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  
  // Safe area insets for preventing overlap with system navigation
  const insets = useSafeAreaInsets();
  
  // Preserve video state when switching fullscreen
  const [savedPosition, setSavedPosition] = useState(0);
  const [savedIsPlaying, setSavedIsPlaying] = useState(autoplay);

  const controller = usePlayPauseController({
    player,
    autoplay,
    initialVisibleMs: 3000,
    autoHideMs: 3500,
    fadeDurationMs: 220,
    enableLogs: __DEV__,
  });
  
  // Initialize autoplay
  useEffect(() => {
    if (player && autoplay) {
      try {
        player.play();
      } catch (e) {
        log("[Player] Autoplay failed:", e);
      }
    }
  }, [player, autoplay]);

  // Modal states
  const [showShare, setShowShare] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showClip, setShowClip] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Track playback status. Declared before useVideoProgress because that hook
  // reads isPlaying in its options object.
  const [isPlaying, setIsPlaying] = useState(autoplay);

  // Video progress tracking
  const { position, duration, buffered, isLoaded: progressLoaded, seek } = useVideoProgress({
    player,
    isPlaying: isPlaying,
  });

  // Video actions (Like, Dislike, Share, etc.)
  const {
    isLiked,
    isDisliked,
    likeCount,
    dislikeCount,
    isSaved,
    like,
    dislike,
    share: shareAction,
    download: downloadAction,
    clip: clipAction,
    save: saveAction,
    report,
    notInterested,
    dontRecommendChannel,
  } = useVideoActions({
    videoId: videoId || "unknown",
  });

  // Handle orientation changes and window resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
      log("[Player] Dimensions changed:", window.width, "x", window.height);
    });

    return () => subscription?.remove();
  }, []);

  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    if (!player) return;
    
    // Update playing state
    const checkPlaying = () => {
      try {
        setIsPlaying(player.playing);
        setIsLoaded(player.duration > 0);
      } catch (e) {
        // Silent fail
      }
    };
    
    checkPlaying();
    const interval = setInterval(checkPlaying, 250);
    
    return () => clearInterval(interval);
  }, [player]);

  /**
   * Handle taps on video area:
   * - Always trigger controller.onScreenTap() to reset overlay timers
   * - Detect double-tap (best-effort heuristic) to quick seek left/right
   */
  const onVideoAreaPress = useCallback(
    (evt: GestureResponderEvent) => {
      try {
        controller.onScreenTap();

        const now = Date.now();
        const last = lastTapRef.current;
        lastTapRef.current = now;

        if (now - last < 300 && player) {
          // double-tap detected: quick seek
          const locX = (evt.nativeEvent as any).locationX;
          const pageX = (evt.nativeEvent as any).pageX;
          // Heuristic to determine left vs right (simple threshold)
          const isLeft =
            typeof locX === "number"
              ? locX < (evt.currentTarget as any)?.clientWidth / 2 ?? 200
              : typeof pageX === "number"
              ? pageX < 200
              : false;
          const offset = isLeft ? -QUICK_MS : QUICK_MS;
          log(
            "[Player] double-tap quickSeek",
            offset > 0 ? "forward" : "back",
            offset
          );

          try {
            if (!player.duration || player.duration === 0) return;
            const currentTimeMs = player.currentTime * 1000;
            const durationMs = player.duration * 1000;
            const newPosMs = Math.max(
              0,
              Math.min(currentTimeMs + offset, durationMs)
            );
            player.currentTime = newPosMs / 1000;
            // interaction -> reset auto-hide timer
            controller.scheduleHideIfNeeded();
          } catch (e) {
            console.warn("[Player] quickSeek failed:", e);
          }
        }
      } catch (e) {
        console.warn("[Player] onVideoAreaPress failure:", e);
      }
    },
    [controller, player]
  );

  /** Handle video finished for autoplay */
  useEffect(() => {
    if (!player || !isLoaded) return;
    
    const checkFinished = () => {
      try {
        if (player.currentTime >= player.duration - 0.1 && player.duration > 0) {
          log("[Player] Video finished");
          
          if (isAutoplayEnabled && hasNextVideo && onVideoFinished) {
            log("[Autoplay] Triggering next video");
            // Small delay to show finished state
            setTimeout(() => {
              onVideoFinished();
            }, 1000);
          } else if (!isAutoplayEnabled) {
            log("[Autoplay] Disabled, showing replay option");
          } else if (!hasNextVideo) {
            log("[Autoplay] No next video available");
          }
        }
      } catch (e) {
        // Silent fail
      }
    };
    
    const interval = setInterval(checkFinished, 250);
    return () => clearInterval(interval);
  }, [player, isLoaded, isAutoplayEnabled, hasNextVideo, onVideoFinished]);

  const onCenterPress = useCallback(async () => {
    await controller.onCenterPress();
  }, [controller]);

  const onVideoError = useCallback(
    (e: any) => {
      console.error("[Player][expo-video] error:", e);
      controller.showImmediately(true);
    },
    [controller]
  );

  const handleToggleAutoplay = useCallback(() => {
    setAutoplayEnabled((prev) => {
      const newState = !prev;
      // Show notification with appropriate message
      setNotificationMessage(newState ? "Autoplay is on" : "Autoplay is off");
      setNotificationVisible(true);
      log("[Player] Autoplay toggled:", newState);
      return newState;
    });
  }, []);

  const handleNotificationDismiss = useCallback(() => {
    setNotificationVisible(false);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!player) return;
      
      // ALWAYS save current state first (critical for both enter and exit)
      let currentPosition = savedPosition;
      let currentIsPlaying = savedIsPlaying;
      
      try {
        if (player.duration > 0) {
          currentPosition = player.currentTime * 1000;
          currentIsPlaying = player.playing;
          setSavedPosition(currentPosition);
          setSavedIsPlaying(currentIsPlaying);
          log("[Player] Saved state - Position:", currentPosition, "Playing:", currentIsPlaying);
        }
      } catch (e) {
        log("[Player] Failed to save state:", e);
      }
      
      if (!isFullscreen) {
        // Enter fullscreen
        log("[Player] Entering fullscreen");
        
        // Web: Use Fullscreen API
        if (Platform.OS === "web") {
          try {
            const docElement = document.documentElement as any;
            if (docElement.requestFullscreen) {
              await docElement.requestFullscreen();
            } else if (docElement.webkitRequestFullscreen) {
              await docElement.webkitRequestFullscreen();
            } else if (docElement.mozRequestFullScreen) {
              await docElement.mozRequestFullScreen();
            } else if (docElement.msRequestFullscreen) {
              await docElement.msRequestFullscreen();
            }
          } catch (e) {
            log("[Player] Web fullscreen API failed:", e);
          }
        } else {
          // Mobile: Hide status bar and lock orientation
          StatusBar.setHidden(true, "fade");
          
          try {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
            );
          } catch (e) {
            log("[Player] Orientation lock failed:", e);
          }
        }
        
        setIsFullscreen(true);
        controller.showImmediately(true);
        
        // Restore position and play state after entering fullscreen
        setTimeout(() => {
          try {
            if (player.duration > 0) {
              player.currentTime = currentPosition / 1000;
              log("[Player] Restored position:", currentPosition);
              
              // Preserve play/pause state
              if (currentIsPlaying) {
                player.play();
                log("[Player] Resumed playing");
              } else {
                player.pause();
                log("[Player] Kept paused");
              }
            }
          } catch (e) {
            log("[Player] Failed to restore state:", e);
          }
        }, 200);
      } else {
        // Exit fullscreen
        log("[Player] Exiting fullscreen");
        
        // Web: Exit Fullscreen API
        if (Platform.OS === "web") {
          try {
            const doc = document as any;
            if (doc.exitFullscreen) {
              await doc.exitFullscreen();
            } else if (doc.webkitExitFullscreen) {
              await doc.webkitExitFullscreen();
            } else if (doc.mozCancelFullScreen) {
              await doc.mozCancelFullScreen();
            } else if (doc.msExitFullscreen) {
              await doc.msExitFullscreen();
            }
          } catch (e) {
            log("[Player] Web exit fullscreen failed:", e);
          }
        } else {
          // Mobile: Show status bar and unlock orientation
          StatusBar.setHidden(false, "fade");
          
          try {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.PORTRAIT_UP
            );
          } catch (e) {
            log("[Player] Orientation unlock failed:", e);
          }
        }
        
        setIsFullscreen(false);
        controller.showImmediately(true);
        
        // Restore position and play state after exiting fullscreen
        setTimeout(() => {
          try {
            if (player.duration > 0) {
              player.currentTime = currentPosition / 1000;
              log("[Player] Restored position after exit:", currentPosition);
              
              // Preserve play/pause state
              if (currentIsPlaying) {
                player.play();
                log("[Player] Resumed playing after exit");
              } else {
                player.pause();
                log("[Player] Kept paused after exit");
              }
            }
          } catch (e) {
            log("[Player] Failed to restore state after exit:", e);
          }
        }, 200);
      }
    } catch (e) {
      console.error("[Player] Fullscreen toggle error:", e);
    }
  }, [isFullscreen, controller, savedPosition, savedIsPlaying, player]);

  // Handle minimize - exit fullscreen first if needed
  const handleMinimize = useCallback(async () => {
    if (isFullscreen) {
      // Exit fullscreen first, then minimize
      log("[Player] Exiting fullscreen before minimize");
      await handleToggleFullscreen();
      // Small delay to let fullscreen exit complete
      setTimeout(() => {
        onToggleMinimize();
      }, 300);
    } else {
      // Already in portrait, just minimize
      onToggleMinimize();
    }
  }, [isFullscreen, handleToggleFullscreen, onToggleMinimize]);

  // Handle keyboard events (Escape to exit fullscreen on web)
  useEffect(() => {
    if (Platform.OS === "web") {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isFullscreen) {
          handleToggleFullscreen();
        } else if (e.key === "f" || e.key === "F") {
          handleToggleFullscreen();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isFullscreen, handleToggleFullscreen]);

  // Listen for fullscreen changes on web (user using browser controls)
  useEffect(() => {
    if (Platform.OS === "web") {
      const handleFullscreenChange = () => {
        const doc = document as any;
        const isCurrentlyFullscreen = !!(
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        );
        
        if (isCurrentlyFullscreen !== isFullscreen) {
          setIsFullscreen(isCurrentlyFullscreen);
          controller.showImmediately(true);
        }
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.addEventListener("mozfullscreenchange", handleFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleFullscreenChange);

      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
        document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      };
    }
  }, [isFullscreen, controller]);

  // Notify parent of fullscreen changes and log
  useEffect(() => {
    if (onFullscreenChange) {
      onFullscreenChange(isFullscreen);
    }
    Logger.info("[VideoPlayer] Fullscreen state changed", {
      isFullscreen,
      videoId: videoId || "unknown",
    });
  }, [isFullscreen, onFullscreenChange, videoId]);

  // Compute responsive wrapper style with proper React Native fullscreen
  const isPortrait = dimensions.height > dimensions.width;
  
  // Calculate video aspect ratio (16:9 standard) - defined here for use in useEffect
  const VIDEO_ASPECT_RATIO = 16 / 9;
  
  // Reduce video height by 8% (from 33% to ~30.4%) to account for safe area and prevent overlap
  const VIDEO_HEIGHT_PERCENT = isPortrait ? 0.304 : 1; // Reduced from 0.33 to 0.304 (~8% reduction)

  // Log layout changes when progress bar position changes
  useEffect(() => {
    if (!isFullscreen && !isMinimized && videoId) {
      const videoHeight = isPortrait 
        ? Math.min(dimensions.height * VIDEO_HEIGHT_PERCENT, dimensions.width / VIDEO_ASPECT_RATIO)
        : dimensions.width / VIDEO_ASPECT_RATIO;
      
      Logger.info("[VideoPlayer] Progress bar positioned below video (YouTube layout)", {
        videoId,
        videoHeight,
        oldVideoHeight: dimensions.height * 0.33,
        containerWidth: dimensions.width,
        layout: "video -> progress -> actions",
        heightReductionPercent: 8, // Reduced from 33% to 30.4%
      });
      
      // Log white panel height reduction (50% reduction)
      const originalHeight = 12 + 12 + 12; // Original: progress top (12) + progress bottom (12) + action bar (12) = 36
      const newHeight = 4 + 4 + 4; // New: progress top (4) + progress bottom (4) + action bar (4) = 12
      Logger.info("[UI] white_panel_height_reduced_50_percent", {
        videoId,
        timestamp: new Date().toISOString(),
        originalHeight,
        newHeight,
        reductionPercent: 50,
        oldPaddingTop: 8,
        newPaddingTop: 4,
        oldPaddingBottom: 8,
        newPaddingBottom: 4,
        oldActionBarPadding: 8,
        newActionBarPadding: 4,
        oldTimeOverlayPadding: 1,
        newTimeOverlayPadding: 0,
        oldTimeOverlayMargin: 2,
        newTimeOverlayMargin: 1,
      });
      
      // Log adjusted vertical height
      Logger.info("[UI] adjusted_vertical_height", {
        videoId,
        oldHeightPercent: 33,
        newHeightPercent: 30.4,
        reductionPercent: 8,
        safeAreaBottom: insets.bottom,
        finalVideoHeight: videoHeight,
        containerHeight: dimensions.height,
      });
      
      // Log gap reduction
      Logger.info("[UI] white_panel_gaps_reduced", {
        videoId,
        timestamp: new Date().toISOString(),
        progressBarPaddingBottom: "removed (0px)",
        actionBarPaddingTop: "removed (0px)",
        actionBarPaddingBottom: "removed (0px) - only safe area padding when needed",
        progressBarBorderBottom: "removed",
        actionBarBorderTop: "removed",
        timeOverlayMarginTop: "removed (0px)",
        gapReduction: "eliminated gap between progress bar and action buttons",
        whiteSpaceReduction: "eliminated unnecessary white space below action buttons",
      });
    }
  }, [isFullscreen, isMinimized, videoId, dimensions.height, dimensions.width, isPortrait, VIDEO_ASPECT_RATIO, VIDEO_HEIGHT_PERCENT, insets.bottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset orientation and status bar on unmount
      if (isFullscreen) {
        if (Platform.OS === "web") {
          // Exit fullscreen on web
          const doc = document as any;
          if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
          else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        } else {
          // Reset mobile
          StatusBar.setHidden(false, "fade");
          ScreenOrientation.unlockAsync().catch(() => {});
        }
      }
    };
  }, [isFullscreen]);
  
  // Log safe area detection
  useEffect(() => {
    if (!isFullscreen && insets.bottom > 0) {
      Logger.info("[UI] safe_area_bottom_detected", {
        bottom: insets.bottom,
        left: insets.left,
        right: insets.right,
        top: insets.top,
        platform: Platform.OS,
      });
    }
  }, [insets.bottom, insets.left, insets.right, insets.top, isFullscreen]);
  
  // Calculate wrapper dimensions ensuring full video visibility
  const wrapperStyle = isFullscreen
    ? {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: dimensions.width,
        height: dimensions.height,
        zIndex: 9999,
        backgroundColor: "#000",
        flex: 1,
      }
    : isPortrait
    ? {
        ...styles.wrapper,
        width: "100%",
        // Reduced height by 8% to prevent overlap with system navigation
        // Use ~30.4% of screen height, but ensure aspect ratio is maintained
        // This ensures full video visibility with letterboxing if needed
        height: Math.min(
          dimensions.height * VIDEO_HEIGHT_PERCENT, // ~30.4% of screen height (reduced from 33%)
          dimensions.width / VIDEO_ASPECT_RATIO // Maintain aspect ratio
        ),
        alignSelf: "center" as const, // Center horizontally
        backgroundColor: "#000", // Black bars for letterboxing
        overflow: "hidden" as const, // Prevent any overflow
      }
    : {
        ...styles.wrapper,
        width: "100%",
        aspectRatio: VIDEO_ASPECT_RATIO, // Maintain aspect ratio in landscape
        backgroundColor: "#000", // Black bars for letterboxing
        overflow: "hidden" as const, // Prevent any overflow
      };

  // Video style for proper centering and filling
  // In non-fullscreen, use contain to ensure full video visibility with letterboxing
  const videoStyle = isFullscreen
    ? {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
      }
    : {
        ...styles.video,
        width: "100%",
        height: "100%",
        alignSelf: "center" as const, // Center video within container
      };
  
  // ResizeMode changes based on fullscreen state
  // Use "contain" to ensure full video visibility (no cropping) with letterboxing
  // "fill" only in fullscreen mode
  const resizeMode = isFullscreen ? "fill" : "contain"; // Always contain to show full video
  
  // Log resize mode and aspect ratio for debugging
  useEffect(() => {
    if (!isFullscreen) {
      const calculatedHeight = isPortrait
        ? Math.min(
            dimensions.height * 0.33,
            dimensions.width / VIDEO_ASPECT_RATIO
          )
        : dimensions.width / VIDEO_ASPECT_RATIO;
      
      const needsLetterboxing = isPortrait 
        ? calculatedHeight < dimensions.height * 0.33
        : false;
      
      Logger.info("[VideoPlayer] Resize mode and layout", {
        resizeMode,
        isFullscreen,
        isPortrait,
        videoHeight: calculatedHeight,
        containerWidth: dimensions.width,
        containerHeight: dimensions.height,
        aspectRatio: VIDEO_ASPECT_RATIO,
        letterboxing: needsLetterboxing ? "yes (top/bottom)" : "no",
        fullVisibility: "ensured via contain mode",
      });
    }
  }, [resizeMode, isFullscreen, isPortrait, dimensions.width, dimensions.height, VIDEO_ASPECT_RATIO]);

  // Touchable style for proper fullscreen coverage
  const touchableStyle = isFullscreen
    ? {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
      }
    : styles.touchable;

  // Render fullscreen content
  const renderPlayerContent = () => (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onVideoAreaPress}
        style={touchableStyle}
        accessibilityLabel="Tap to show controls"
      >
        <VideoView
          style={videoStyle}
          player={player}
          contentFit={resizeMode === "contain" ? "contain" : resizeMode === "cover" ? "cover" : "fill"}
          nativeControls={false}
          allowsFullscreen={false}
        />
      </TouchableOpacity>

      {/* Center Control Buttons overlay (Previous, Play/Pause, Next) */}
      <View pointerEvents="box-none" style={styles.centerOverlay}>
        <View style={styles.controlRow}>
          {/* Previous Video Button */}
          <PreviousVideoButton
            opacity={controller.opacity}
            disabled={!hasPreviousVideo}
            onPress={onNavigateToPrevious}
            size={buttonSize * 0.8} // 80% of play button size (YouTube proportions)
            style={{ position: "relative", marginRight: 24 }}
          />

          {/* Play/Pause Button */}
          <PlayPauseButton
            opacity={controller.opacity}
            isPlaying={isPlaying}
            size={buttonSize}
            onPress={onCenterPress}
            style={{ position: "relative" }}
          />

          {/* Next Video Button */}
          <NextVideoButton
            opacity={controller.opacity}
            disabled={!hasNextVideo}
            onPress={onNavigateToNext}
            size={buttonSize * 0.8} // 80% of play button size (YouTube proportions)
            style={{ position: "relative", marginLeft: 24 }}
          />
        </View>
      </View>

      {/* Minimize/Restore Button - Top Left (YouTube position) */}
      <View 
        pointerEvents="box-none" 
        style={[
          styles.topLeftOverlay,
          isFullscreen && {
            position: "absolute",
            top: 20,
            left: 20,
            zIndex: 10000,
          }
        ]}
      >
        <View pointerEvents="auto">
          <MinimizeButton
            opacity={controller.opacity}
            isMinimized={isMinimized}
            onPress={handleMinimize}
            size={isFullscreen ? 56 : (buttonSize * 0.6)} // Larger in fullscreen
            style={{ position: "relative" }}
          />
        </View>
      </View>

      {/* Autoplay Toggle - Top Right (YouTube 2025 position) */}
      <View pointerEvents="box-none" style={styles.topRightOverlay}>
        <View pointerEvents="auto">
          <AutoplayToggle
            opacity={controller.opacity}
            autoplayEnabled={autoplayEnabled}
            onToggle={handleToggleAutoplay}
            size={32}
            disabled={!hasNextVideo}
          />
        </View>
      </View>

      {/* Autoplay Notification - Shows "Autoplay is on/off" */}
      <AutoplayNotification
        visible={notificationVisible}
        message={notificationMessage}
        onDismiss={handleNotificationDismiss}
      />

      {/* Fullscreen Button - Bottom Right (YouTube position) */}
      <View 
        pointerEvents="box-none" 
        style={[
          styles.bottomRightOverlay,
          isFullscreen && {
            position: "absolute",
            bottom: 20,
            right: 20,
            zIndex: 10000,
          }
        ]}
      >
        <View pointerEvents="auto">
          <FullscreenButton
            opacity={controller.opacity}
            isFullscreen={isFullscreen}
            onToggle={handleToggleFullscreen}
            size={isFullscreen ? 56 : 48}
          />
        </View>
      </View>

      {/* Debug overlay removed for cleaner UI */}
    </>
  );

  // Use Modal for true fullscreen on mobile
  if (isFullscreen && Platform.OS !== "web") {
    return (
      <Modal
        visible={true}
        animationType="none"
        statusBarTranslucent={true}
        transparent={false}
        supportedOrientations={['landscape', 'portrait']}
        onRequestClose={handleToggleFullscreen}
      >
        <View style={styles.fullscreenModalContainer}>
          {renderPlayerContent()}
        </View>
      </Modal>
    );
  }

  // Normal render or web fullscreen
  return (
    <>
      <View style={wrapperStyle as any}>
        {renderPlayerContent()}
      </View>
      
      {/* Progress Bar + Time Display - Below video, above action bar (YouTube layout) */}
      {!isFullscreen && !isMinimized && videoId && (
        <View 
          style={[
            styles.progressBarContainer,
            // No paddingBottom here - moved to action bar to eliminate gap
          ]}
        >
          <VideoProgressBar
            position={position}
            duration={duration}
            buffered={buffered}
            isPlaying={isPlaying}
            onSeek={(newPosition) => {
              Logger.info("[VideoPlayer] Progress bar seek", { 
                from: position, 
                to: newPosition,
                videoId,
              });
              seek(newPosition);
            }}
            containerWidth={dimensions.width}
            onDragStart={() => {
              Logger.info("[VideoPlayer] Progress bar drag started", { videoId });
            }}
            onDragEnd={() => {
              Logger.info("[VideoPlayer] Progress bar drag ended", { videoId });
            }}
          />
          <VideoTimeOverlay
            currentTime={position}
            duration={duration}
            textColor="#606060" // YouTube-style gray text
          />
        </View>
      )}
      
      {/* Action Bar - Below video (only when not fullscreen and not minimized) */}
      {!isFullscreen && !isMinimized && videoId && (
        <>
          <VideoActionBar
            videoId={videoId}
            videoTitle={videoTitle}
            videoUrl={videoUrl || sourceUrl}
            channelId={channelId}
            isLiked={isLiked}
            isDisliked={isDisliked}
            likeCount={likeCount}
            dislikeCount={dislikeCount}
            isSaved={isSaved}
            onLike={like}
            onDislike={dislike}
            onShare={() => setShowShare(true)}
            onDownload={() => setShowDownload(true)}
            onClip={() => setShowClip(true)}
            onSave={() => setShowSave(true)}
            onMore={() => setShowMore(true)}
          />

          {/* Modals */}
          <VideoShareSheet
            videoId={videoId}
            title={videoTitle}
            url={videoUrl || sourceUrl}
            visible={showShare}
            onClose={() => setShowShare(false)}
          />

          <VideoDownloadModal
            videoId={videoId}
            visible={showDownload}
            onClose={() => setShowDownload(false)}
          />

          <VideoClipEditor
            videoId={videoId}
            duration={duration}
            currentPosition={position}
            visible={showClip}
            onClose={() => setShowClip(false)}
            onSave={async (startTime, endTime) => {
              await clipAction(startTime, endTime);
              setShowClip(false);
            }}
          />

          <VideoSaveSheet
            videoId={videoId}
            visible={showSave}
            onClose={() => setShowSave(false)}
            onSaved={(playlistIds) => {
              saveAction(playlistIds);
            }}
          />

          <VideoOverflowMenu
            videoId={videoId}
            channelId={channelId}
            visible={showMore}
            onClose={() => setShowMore(false)}
            onNotInterested={notInterested}
            onReport={() => report("inappropriate")}
            onDontRecommendChannel={(channelId) => dontRecommendChannel(channelId || "")}
          />
        </>
      )}
    </>
  );
};

export default VideoPlayer;

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#000", // Black background for letterboxing
    position: "relative",
    overflow: "hidden", // Prevent any overflow
    margin: 0,
    padding: 0,
    justifyContent: "center" as const, // Center video vertically
    alignItems: "center" as const, // Center video horizontally
  },
  touchable: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    alignSelf: "center", // Center video horizontally
  },
  centerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "box-none",
    zIndex: 1003, // Above fullscreen button and progress bar
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "box-none",
  },
  topLeftOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 1001,
    pointerEvents: "box-none",
  },
  topRightOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1001,
    pointerEvents: "box-none",
  },
  bottomRightOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    zIndex: 1001,
    pointerEvents: "box-none",
  },
  progressBarContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF", // YouTube-style white background
    paddingTop: 4, // Reduced by 50% (from 8 to 4)
    paddingBottom: 0, // Removed to eliminate gap between progress bar and action buttons
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
    borderBottomWidth: 0, // Removed border to reduce visual gap
    borderBottomColor: "transparent",
  },
  fullscreenModalContainer: {
    flex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    margin: 0,
    padding: 0,
  },
});