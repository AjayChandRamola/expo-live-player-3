// components/VideoPlayer/ui/ControlsOverlay.tsx
// Layout only. Positions: docs/player/06-ui-and-gestures-spec.md §2
import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { ChapterItem } from "../../../types/domain";
import { currentChapter } from "../engine/pure/currentChapter";
import type { PlaybackCommands, PlaybackSnapshot } from "../engine/types";
import type { HapticsAdapter } from "../platform/types";
import { playerTokens } from "../tokens";
import { AutoplayToggle } from "./controls/AutoplayToggle";
import { FullscreenButton } from "./controls/FullscreenButton";
import { GoLiveButton } from "./controls/GoLiveButton";
import { LiveBadge } from "./controls/LiveBadge";
import { MinimizeButton } from "./controls/MinimizeButton";
import { MuteButton } from "./controls/MuteButton";
import { PipButton } from "./controls/PipButton";
import { PlayPauseButton } from "./controls/PlayPauseButton";
import { SettingsButton } from "./controls/SettingsButton";
import { SkipButton } from "./controls/SkipButton";
import { ProgressBar } from "./ProgressBar";
import { TimeLabel } from "./TimeLabel";

export interface ControlsOverlayProps {
  readonly snapshot: PlaybackSnapshot;
  readonly commands: PlaybackCommands;
  readonly visible: boolean;
  readonly opacity: SharedValue<number>;
  readonly layoutMode: "inline" | "fullscreen";
  readonly insets: EdgeInsets;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayNextEnabled: boolean;
  readonly chapters?: readonly ChapterItem[];
  readonly pipSupported: boolean;
  readonly haptics: HapticsAdapter;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onToggleAutoplayNext: (enabled: boolean) => void;
  readonly onToggleFullscreen: () => void;
  readonly onToggleMinimize: () => void;
  readonly onOpenSettings: () => void;
  readonly onPip: () => void;
  readonly onSeekStart: () => void;
  readonly onSeekPreview: (ms: number) => void;
  readonly onSeekCommit: (ms: number) => void;
  readonly onSeekCancel: () => void;
  readonly testID?: string;
}

export const ControlsOverlay = memo(function ControlsOverlay(props: ControlsOverlayProps) {
  const { snapshot, commands, visible, opacity, layoutMode, insets, chapters } = props;
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const isFullscreen = layoutMode === "fullscreen";
  const inset = useMemo(
    () => ({
      paddingTop: playerTokens.space.md + (isFullscreen ? insets.top : 0),
      paddingBottom: playerTokens.space.md + (isFullscreen ? insets.bottom : 0),
      paddingLeft: playerTokens.space.md + (isFullscreen ? insets.left : 0),
      paddingRight: playerTokens.space.md + (isFullscreen ? insets.right : 0),
    }),
    [insets, isFullscreen],
  );
  const chapterTitle = useMemo(() => (chapters ? currentChapter(chapters, snapshot.positionMs)?.title ?? null : null), [chapters, snapshot.positionMs]);

  return (
    <Animated.View style={[styles.overlay, inset, animatedStyle]} pointerEvents={visible ? "box-none" : "none"} testID={props.testID}>
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.side}>{isFullscreen ? null : <MinimizeButton onPress={props.onToggleMinimize} />}</View>
        <LiveBadge isLive={snapshot.isLive} />
        <View style={[styles.side, styles.right]}>
          <AutoplayToggle enabled={props.isAutoplayNextEnabled} hasNext={props.hasNext} onToggle={props.onToggleAutoplayNext} />
          <PipButton supported={props.pipSupported} onPress={props.onPip} />
          <SettingsButton onPress={props.onOpenSettings} />
        </View>
      </View>

      <View style={styles.centreRow} pointerEvents="box-none">
        <SkipButton direction="previous" enabled={props.hasPrevious} onPress={props.onPrevious} />
        <View style={styles.centreSlot}>
          <PlayPauseButton status={snapshot.status} commands={commands} />
        </View>
        <SkipButton direction="next" enabled={props.hasNext} onPress={props.onNext} />
      </View>

      <View pointerEvents="box-none">
        <View style={styles.bottomLine}>
          <TimeLabel positionMs={snapshot.positionMs} durationMs={snapshot.durationMs} isLive={snapshot.isLive} liveOffsetMs={snapshot.liveOffsetMs} chapterTitle={chapterTitle} />
          <View style={[styles.side, styles.right]}>
            <GoLiveButton isLive={snapshot.isLive} liveOffsetMs={snapshot.liveOffsetMs} commands={commands} />
            <MuteButton muted={snapshot.muted} commands={commands} />
            <FullscreenButton isFullscreen={isFullscreen} onToggle={props.onToggleFullscreen} />
          </View>
        </View>
        <ProgressBar
          positionMs={snapshot.positionMs}
          durationMs={snapshot.durationMs}
          bufferedMs={snapshot.bufferedMs}
          chapters={chapters}
          isLive={snapshot.isLive}
          disabled={!visible}
          onSeekStart={props.onSeekStart}
          onSeekPreview={props.onSeekPreview}
          onSeekCommit={props.onSeekCommit}
          onSeekCancel={props.onSeekCancel}
          haptics={props.haptics}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "space-between", backgroundColor: playerTokens.color.scrim, zIndex: playerTokens.z.overlay },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { flexDirection: "row", alignItems: "center", minWidth: playerTokens.size.controlSm },
  right: { justifyContent: "flex-end" },
  centreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  centreSlot: { width: playerTokens.size.controlLg, height: playerTokens.size.controlLg, marginHorizontal: playerTokens.space.xl, alignItems: "center", justifyContent: "center" },
  bottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: playerTokens.size.minTouchTarget },
});
