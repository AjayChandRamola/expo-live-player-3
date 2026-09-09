/**
 * components/VideoPlayer/usePlayPauseController.ts
 *
 * Central controller hook for Play/Pause overlay (fixed auto-hide behavior)
 *
 * Fix summary:
 * - Timer callbacks query live runtime status (videoRef.getStatusAsync) at hide-time to avoid stale closure issues.
 * - Animation completes before visible toggles to false so debug shows accurate state.
 * - Uses refs for latest playback/visibility state to avoid stale closures.
 * - Robust cleanup of timers and animations to avoid leaks.
 * - [FIX] onPlaybackStatusUpdate now detects transitions (e.g., Paused -> Playing)
 * and does NOT reset the auto-hide timer on every 'playing' tick.
 *
 * Usage:
 * const controller = usePlayPauseController({ videoRef, autoplay });
 * controller.onCenterPress();
 * controller.onPlaybackStatusUpdate(status);
 * controller.onScreenTap();
 *
 * Note: TypeScript, Expo-managed workflow compatible.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useVideoPlayer } from "expo-video";

type Params = {
  player: ReturnType<typeof useVideoPlayer> | null;
  autoplay?: boolean;
  /** ms button initially shown on mount */
  initialVisibleMs?: number;
  /** ms to auto-hide after interactions when video is playing (or when paused if autoHideWhenPaused=true) */
  autoHideMs?: number;
  /** animation duration ms */
  fadeDurationMs?: number;
  /** logs enable */
  enableLogs?: boolean;
  /**
   * If true, overlay will also auto-hide when paused.
   * Default: false (preserves "paused stays visible" UX).
   */
  autoHideWhenPaused?: boolean;
};

type ControllerReturn = {
  visible: boolean;
  opacity: Animated.Value;
  isPlaying: boolean;
  isLoaded: boolean;
  onScreenTap: () => void;
  onCenterPress: () => Promise<void>;
  showImmediately: (immediate?: boolean) => void;
  hideImmediately: (immediate?: boolean) => void;
  scheduleHideIfNeeded: () => void;
};

export function usePlayPauseController({
  player,
  autoplay = true,
  initialVisibleMs = 3000,
  autoHideMs = 3500,
  fadeDurationMs = 220,
  enableLogs = false,
  autoHideWhenPaused = false,
}: Params): ControllerReturn {
  const log = (...args: any[]) => {
    if (enableLogs) console.info("[Player][Controller]", ...args);
  };

  // authoritative playback state (kept in sync via onPlaybackStatusUpdate)
  const [isPlaying, setIsPlaying] = useState<boolean>(!!autoplay);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // keep refs of latest state to avoid stale closures inside timers
  const isPlayingRef = useRef<boolean>(!!autoplay);
  const isLoadedRef = useRef<boolean>(false);
  const visibleRef = useRef<boolean>(true);

  // visibility
  const [visible, setVisible] = useState<boolean>(true);
  const opacity = useRef(new Animated.Value(1)).current;

  // timers & refs
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Track player state
  useEffect(() => {
    if (!player) {
      setIsPlaying(false);
      setIsLoaded(false);
      return;
    }

    const checkState = () => {
      try {
        setIsPlaying(player.playing);
        setIsLoaded(player.duration > 0);
      } catch (e) {
        // Silent fail
      }
    };

    checkState();
    const interval = setInterval(checkState, 250);
    return () => clearInterval(interval);
  }, [player]);

  // update refs whenever state changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // helper: clear hide timer
  const clearHideTimer = useCallback(() => {
    try {
      if (hideTimerRef.current != null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
        log("[Timer] cleared");
      }
    } catch (e) {
      console.warn("[Controller] clearHideTimer failed:", e);
    }
  }, []);

  // helper: clear initial timer
  const clearInitialTimer = useCallback(() => {
    try {
      if (initialTimerRef.current != null) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
        log("[Timer] initial cleared");
      }
    } catch (e) {
      console.warn("[Controller] clearInitialTimer failed:", e);
    }
  }, []);

  // stop any running animation
  const stopAnimation = useCallback(() => {
    try {
      if (lastAnimationRef.current) {
        lastAnimationRef.current.stop();
        lastAnimationRef.current = null;
      }
    } catch (e) {
      console.warn("[Controller] stopAnimation failed:", e);
    }
  }, []);

  // animate to value (0..1) and return a Promise that resolves when complete
  const animateTo = useCallback(
    (toValue: number, immediate = false): Promise<void> => {
      return new Promise((resolve) => {
        try {
          stopAnimation();
          const duration = immediate ? 0 : fadeDurationMs;
          const anim = Animated.timing(opacity, {
            toValue,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          });
          lastAnimationRef.current = anim;
          anim.start(() => {
            // clear reference once complete
            lastAnimationRef.current = null;
            resolve();
          });
        } catch (e) {
          console.warn("[Controller] animation failed:", e);
          resolve();
        }
      });
    },
    [opacity, fadeDurationMs, stopAnimation]
  );

  /**
   * Core: schedule auto-hide but decide at the moment of hiding using fresh playback status.
   * This avoids stale closure/state issues.
   */
  const scheduleHideIfNeeded = useCallback(() => {
    try {
      clearHideTimer();

      // schedule the check regardless — we will decide when timer fires.
      hideTimerRef.current = setTimeout(async () => {
        try {
          log("[Timer] auto-hide fired; checking live playback state...");

          // Check player state directly
          let shouldHide = false;
          try {
            if (player) {
              const loaded = player.duration > 0;
              const playing = player.playing;
              log("[Timer] live status -> loaded:", loaded, "playing:", playing);

              // hide if playing (common case)
              if (playing) shouldHide = true;
              else if (!playing && loaded && autoHideWhenPaused)
                shouldHide = true;
              else shouldHide = false;
            } else {
              // fallback to the latest refs if player not available
              log(
                "[Timer] player not available — falling back to refs loaded/playing:",
                isLoadedRef.current,
                isPlayingRef.current
              );
              if (isPlayingRef.current) shouldHide = true;
              else if (
                !isPlayingRef.current &&
                isLoadedRef.current &&
                autoHideWhenPaused
              )
                shouldHide = true;
            }
          } catch (inner) {
            console.warn("[Controller] failed to read runtime status:", inner);
            // conservative fallback: hide only if latest ref says playing
            shouldHide = !!isPlayingRef.current;
          }

          if (shouldHide) {
            log("[Timer] conditions matched -> hiding overlay with fade");
            // fade out smoothly then mark visible=false after animation completes
            await animateTo(0);
            setVisible(false);
            log("[Visibility] hidden (post animation)");
          } else {
            log(
              "[Timer] conditions did NOT match -> keeping overlay visible"
            );
            // keep visible and don't reschedule automatically here
            // another interaction or playback status update will call scheduleHideIfNeeded again
          }
        } catch (e) {
          console.warn("[Controller] auto-hide failed:", e);
        } finally {
          hideTimerRef.current = null;
        }
      }, autoHideMs);

      log(
        "[Timer] scheduled auto-hide in",
        autoHideMs,
        "ms (decision deferred to runtime status check)."
      );
    } catch (e) {
      console.warn("[Controller] scheduleHideIfNeeded failed:", e);
    }
  }, [autoHideMs, autoHideWhenPaused, animateTo, clearHideTimer, player, log]);

  /**
   * Show overlay immediately (optionally immediate without animation)
   * - Clears any hide timer and schedules a fresh one
   */
  const showImmediately = useCallback(
    (immediate = false) => {
      try {
        clearHideTimer();
        // If already visible but opacity was 0 (edge case), ensure visible true so debug shows correctly.
        setVisible(true);
        // ensure opacity animates to 1
        animateTo(1, immediate).then(() => {
          // always schedule hide only after show starts
          scheduleHideIfNeeded();
          log("[Visibility] show (immediate:", immediate, ")");
        });
      } catch (e) {
        console.warn("[Controller] showImmediately failed:", e);
      }
    },
    [animateTo, clearHideTimer, scheduleHideIfNeeded, log]
  );

  /**
   * Hide overlay immediately (optionally immediate without animation)
   */
  const hideImmediately = useCallback(
    (immediate = false) => {
      try {
        clearHideTimer();
        // previous UX: don't hide if paused; to preserve backwards compatibility we respect autoHideWhenPaused flag
        if (!autoHideWhenPaused && !isPlayingRef.current) {
          log(
            "[Visibility] skip hide because video is paused and autoHideWhenPaused=false"
          );
          return;
        }

        // animate to 0 then set visible false
        animateTo(0, immediate).then(() => {
          setVisible(false);
          log("[Visibility] hide (immediate:", immediate, ")");
        });
      } catch (e) {
        console.warn("[Controller] hideImmediately failed:", e);
      }
    },
    [animateTo, autoHideWhenPaused, clearHideTimer, log]
  );

  /**
   * Called when user taps the screen area.
   * Behaviour:
   * - If overlay visible:
   * - if playing -> hide (immediate)
   * - if paused -> keep visible (but reset timer)
   * - If overlay hidden -> show immediately and schedule hide.
   */
  const onScreenTap = useCallback(() => {
    try {
      log(
        "[User] screen tap. visible:",
        visibleRef.current,
        "isPlaying:",
        isPlayingRef.current
      );
      if (visibleRef.current) {
        if (isPlayingRef.current) {
          // user tapped while playing and overlay visible -> hide instantly
          hideImmediately(true);
        } else {
          // paused -> keep visible but reset any timers (so user can interact)
          showImmediately(true);
        }
      } else {
        // was hidden -> show then auto-hide later (if conditions match)
        showImmediately(true);
      }
    } catch (e) {
      console.warn("[Controller] onScreenTap failed:", e);
    }
  }, [hideImmediately, showImmediately]);

  /**
   * When center button pressed we toggle playback via player safely.
   * - When pausing: keep overlay visible (but can auto-hide later if autoHideWhenPaused=true)
   * - When playing: show overlay then schedule hide
   */
  const onCenterPress = useCallback(async () => {
    log("[User] center press requested");
    try {
      if (!player) {
        console.warn(
          "[Controller] player not available -> showing overlay for UX"
        );
        showImmediately(true);
        return;
      }
      
      if (!player.duration || player.duration === 0) {
        console.warn("[Controller] video not loaded yet");
        showImmediately(true);
        return;
      }

      const playing = player.playing;
      if (playing) {
        // pause
        player.pause();
        // keep visible (user paused intentionally)
        showImmediately(true);
      } else {
        // if just finished reset defensively
        if (player.currentTime >= player.duration - 0.1) {
          try {
            player.currentTime = 0;
          } catch (e) {
            // ignore
            log("[Controller] setPosition(0) failed:", e);
          }
        }
        player.play();
        // show and schedule hide
        showImmediately(false);
      }
    } catch (e) {
      console.error("[Controller] onCenterPress error:", e);
    }
  }, [player, showImmediately, log]);

  // State transitions are now handled via useEffect that tracks player state directly
  // When playing state changes, we update the overlay accordingly
  useEffect(() => {
    if (!isLoaded) {
      // not loaded — ensure visible for UX, and clear any pending hide
      clearHideTimer();
      showImmediately(true);
      return;
    }

    if (!isPlaying) {
      // Paused — show overlay (paused stays visible)
      showImmediately(true);
    } else {
      // Playing — schedule hide if overlay is visible
      if (visibleRef.current) {
        scheduleHideIfNeeded();
      }
    }
  }, [isPlaying, isLoaded, clearHideTimer, showImmediately, scheduleHideIfNeeded]);

  // On mount: show initial overlay for configured time then allow normal rules to take over.
  useEffect(() => {
    log("[Controller] mount -> show initial for", initialVisibleMs, "ms");
    showImmediately(true);

    if (initialVisibleMs > 0) {
      initialTimerRef.current = setTimeout(() => {
        try {
          log(
            "[Controller] initial visible elapsed -> evaluating runtime hide"
          );
          scheduleHideIfNeeded();
        } catch (e) {
          console.warn("[Controller] initial timer handler failed:", e);
        } finally {
          initialTimerRef.current = null;
        }
      }, initialVisibleMs);
    }

    return () => {
      clearInitialTimer();
      clearHideTimer();
      stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // cleanup on unmount (extra safety)
  useEffect(() => {
    return () => {
      clearInitialTimer();
      clearHideTimer();
      stopAnimation();
    };
  }, [clearInitialTimer, clearHideTimer, stopAnimation]);

  // public API
  return {
    visible,
    opacity,
    isPlaying,
    isLoaded,
    onScreenTap,
    onCenterPress,
    showImmediately,
    hideImmediately,
    scheduleHideIfNeeded,
  };
}

export default usePlayPauseController;