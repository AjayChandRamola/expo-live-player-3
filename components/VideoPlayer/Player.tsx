// components/VideoPlayer/Player.tsx
// Composition root. Spec §3.4; wiring order: docs/player/03-architecture.md §5.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VideoView } from "expo-video";
import { ASPECT_16_9, INLINE_MAX_HEIGHT_RATIO, LONG_PRESS_RATE, MINI_PLAYER_WIDTH, TIME_UPDATE_INTERVAL_MS } from "./constants";
import { devLog } from "./engine/devLog";
import { usePlaybackEngine } from "./engine/usePlaybackEngine";
import type { SubtitleTrackInfo } from "./engine/types";
import { useControlsVisibility } from "./gestures/useControlsVisibility";
import { useSwipeGestures } from "./gestures/useSwipeGestures";
import { useTapGestures } from "./gestures/useTapGestures";
import { layoutModeFor } from "./hooks/layoutMode";
import { useEndScreenCountdown } from "./hooks/useEndScreenCountdown";
import { useFullscreen } from "./hooks/useFullscreen";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useOnStateChange } from "./hooks/useOnStateChange";
import { useSurfaceLayout } from "./hooks/useSurfaceLayout";
import { useToast } from "./hooks/useToast";
import { brightnessAdapter, hapticsAdapter, pictureInPictureAdapter } from "./platform";
import { playerTokens } from "./tokens";
import type { VideoPlayerProps } from "./types";
import { BufferingIndicator } from "./ui/BufferingIndicator";
import { CaptionsView } from "./ui/CaptionsView";
import { ControlsOverlay } from "./ui/ControlsOverlay";
import { EndScreen } from "./ui/EndScreen";
import { ErrorCard } from "./ui/ErrorCard";
import { MiniPlayer } from "./ui/MiniPlayer";
import { PlayerSurface } from "./ui/PlayerSurface";
import { SettingsSheet } from "./ui/SettingsSheet";
import { SwipeIndicator, type SwipeLevel } from "./ui/SwipeIndicator";
import { Toast } from "./ui/Toast";

export function Player(props: VideoPlayerProps) {
  const { source, captions, chapters, isMinimized, hasNext, hasPrevious, isAutoplayNextEnabled } = props;

  // 1. Engine
  const { snapshot, commands, player, notifyPictureInPicture } = usePlaybackEngine(
    source,
    { autoplay: props.autoplay ?? true, loop: false, mutedByDefault: false, initialPositionMs: props.initialPositionMs, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS },
    { onPositionChange: props.onPositionChange },
  );

  // 2. Layout and platform
  const surfaceRef = useRef<View>(null);
  const videoViewRef = useRef<VideoView>(null);
  const getElement = useCallback(() => surfaceRef.current, []);
  const fullscreen = useFullscreen({ onChange: props.onFullscreenChange, getElement, enabled: !isMinimized });
  const layoutMode = layoutModeFor(isMinimized, fullscreen.isFullscreen);
  const [surfaceLayout, onSurfaceLayout] = useSurfaceLayout();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  // 3. Transient UI state
  const toast = useToast();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [swipeLevel, setSwipeLevel] = useState<SwipeLevel | null>(null);
  const hasPlayedRef = useRef(false);
  if (snapshot.status === "playing") hasPlayedRef.current = true;
  const rateBeforeLongPressRef = useRef(snapshot.playbackRate);

  // 4. Visibility, gestures, keyboard
  const visibility = useControlsVisibility({ status: snapshot.status, isSheetOpen, isMinimized });
  const gesturesEnabled = layoutMode !== "minimized" && !isSheetOpen && snapshot.status !== "error";
  const onToggleControls = useCallback(() => (visibility.visible ? visibility.hide() : visibility.show()), [visibility]);
  const onLongPressRate = useCallback(
    (active: boolean) => {
      if (active) {
        rateBeforeLongPressRef.current = snapshot.playbackRate;
        commands.setRate(LONG_PRESS_RATE);
        toast.show(`${LONG_PRESS_RATE}× speed`);
      } else {
        commands.setRate(rateBeforeLongPressRef.current);
      }
    },
    [commands, snapshot.playbackRate, toast],
  );
  const onSkipFeedback = useCallback((direction: "back" | "forward") => toast.show(direction === "back" ? "-10s" : "+10s"), [toast]);
  const tapGesture = useTapGestures({ commands, enabled: gesturesEnabled, layout: surfaceLayout, haptics: hapticsAdapter, onInteraction: visibility.onInteraction, onToggleControls, onSkipFeedback, onLongPressRate });
  const swipeGesture = useSwipeGestures({ commands, enabled: gesturesEnabled, layout: surfaceLayout, brightness: brightnessAdapter, initialVolume: snapshot.volume, onLevel: setSwipeLevel });
  const composedGesture = useMemo(() => Gesture.Simultaneous(tapGesture, swipeGesture), [tapGesture, swipeGesture]);
  const onToggleCaptions = useCallback(() => setCaptionsEnabled((v) => !v), []);
  useKeyboardShortcuts({ commands, snapshot, fullscreen, onToggleCaptions, onInteraction: visibility.onInteraction, enabled: layoutMode !== "minimized" });

  // 5. Outbound callbacks and effects
  useOnStateChange(snapshot, props.onStateChange);
  const countdown = useEndScreenCountdown({ status: snapshot.status, isLive: snapshot.isLive, hasNext, enabled: isAutoplayNextEnabled, onFinished: props.onFinished });
  useEffect(() => {
    brightnessAdapter.attach({ getElement });
    return () => {
      void brightnessAdapter.restore();
    };
  }, [getElement]);
  useEffect(() => pictureInPictureAdapter.subscribe({ getElement }, notifyPictureInPicture), [getElement, notifyPictureInPicture]);

  // 6. Handlers
  const onToggleAutoplayNext = useCallback(
    (enabled: boolean) => {
      props.onToggleAutoplayNext(enabled);
      toast.show(enabled ? "Autoplay is on" : "Autoplay is off");
    },
    [props, toast],
  );
  const onPip = useCallback(async () => {
    const view = videoViewRef.current;
    const result = await pictureInPictureAdapter.start({
      startPictureInPicture: view ? () => view.startPictureInPicture() : undefined,
      stopPictureInPicture: view ? () => view.stopPictureInPicture() : undefined,
      getElement,
    });
    if (!result.ok) devLog("adapter.failed.pip.start", { reason: result.reason });
  }, [getElement]);
  const onToggleMinimize = useCallback(async () => {
    if (fullscreen.isFullscreen) await fullscreen.exit();
    props.onToggleMinimize();
  }, [fullscreen, props]);
  const onRate = useCallback(
    (rate: number) => {
      commands.setRate(rate);
      toast.show(`Speed ${rate}×`);
    },
    [commands, toast],
  );
  const onSelectSubtitle = useCallback((track: SubtitleTrackInfo | null) => commands.selectSubtitle(track), [commands]);
  const onPictureInPictureStart = useCallback(() => notifyPictureInPicture(true), [notifyPictureInPicture]);
  const onPictureInPictureStop = useCallback(() => notifyPictureInPicture(false), [notifyPictureInPicture]);

  // 7. Layout style
  const containerStyle = useMemo(() => {
    if (layoutMode === "fullscreen") return [styles.base, styles.fullscreen, { width: window.width, height: window.height }];
    if (layoutMode === "minimized") return [styles.base, { width: MINI_PLAYER_WIDTH, height: MINI_PLAYER_WIDTH / ASPECT_16_9, borderRadius: playerTokens.radius.md }];
    const isPortrait = window.height > window.width;
    return isPortrait
      ? [styles.base, { width: "100%" as const, height: Math.min(window.height * INLINE_MAX_HEIGHT_RATIO, window.width / ASPECT_16_9) }]
      : [styles.base, { width: "100%" as const, aspectRatio: ASPECT_16_9 }];
  }, [layoutMode, window.height, window.width]);

  const activeQualityLabel = snapshot.activeQuality ? `Auto · ${snapshot.activeQuality.label}` : null;

  return (
    <View ref={surfaceRef} style={containerStyle} testID={props.testID}>
      <GestureDetector gesture={composedGesture}>
        <PlayerSurface
          ref={videoViewRef}
          player={player}
          posterUrl={source.posterUrl}
          showPoster={!hasPlayedRef.current}
          allowsPictureInPicture={pictureInPictureAdapter.isSupported()}
          onPictureInPictureStart={onPictureInPictureStart}
          onPictureInPictureStop={onPictureInPictureStop}
          onLayout={onSurfaceLayout}
        >
          {layoutMode === "minimized" ? (
            <MiniPlayer status={snapshot.status} commands={commands} onRestore={props.onToggleMinimize} onClose={props.onToggleMinimize} />
          ) : (
            <ControlsOverlay
              snapshot={snapshot}
              commands={commands}
              visible={visibility.visible && !snapshot.isPictureInPicture}
              opacity={visibility.opacity}
              layoutMode={layoutMode}
              insets={insets}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              isAutoplayNextEnabled={isAutoplayNextEnabled}
              chapters={chapters}
              pipSupported={pictureInPictureAdapter.isSupported()}
              haptics={hapticsAdapter}
              onNext={props.onNext}
              onPrevious={props.onPrevious}
              onToggleAutoplayNext={onToggleAutoplayNext}
              onToggleFullscreen={fullscreen.toggle}
              onToggleMinimize={onToggleMinimize}
              onOpenSettings={() => setSheetOpen(true)}
              onPip={onPip}
              onSeekStart={visibility.show}
              onSeekPreview={() => undefined}
              onSeekCommit={commands.seekTo}
              onSeekCancel={visibility.onInteraction}
            />
          )}
          {captionsEnabled && captions && layoutMode !== "minimized" ? <CaptionsView captions={captions} positionMs={snapshot.positionMs} /> : null}
          <BufferingIndicator status={snapshot.status} />
          <ErrorCard error={snapshot.error} retryAttempt={snapshot.retryAttempt} retrying={snapshot.status === "loading" && snapshot.retryAttempt > 0} onRetry={commands.retry} />
          <EndScreen visible={snapshot.status === "ended" && layoutMode !== "minimized"} secondsLeft={countdown.secondsLeft} onReplay={commands.replay} onCancelAutoplay={countdown.cancel} />
          <SwipeIndicator level={swipeLevel} />
          <Toast message={toast.message} />
        </PlayerSurface>
      </GestureDetector>
      <SettingsSheet
        visible={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        rate={snapshot.playbackRate}
        onRate={onRate}
        captionsAvailable={Boolean(captions?.length) || snapshot.subtitleTracks.length > 0}
        captionsEnabled={captionsEnabled}
        onToggleCaptions={setCaptionsEnabled}
        subtitleTracks={snapshot.subtitleTracks}
        activeSubtitle={snapshot.activeSubtitle}
        onSelectSubtitle={onSelectSubtitle}
        activeQualityLabel={activeQualityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: playerTokens.color.videoBackground, overflow: "hidden", alignSelf: "center" },
  fullscreen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: playerTokens.z.fullscreen },
});
