// components/VideoPlayer/Controls.tsx
/* 
  Dependencies:
    - react
    - react-native
    - react-native-paper (IconButton, ActivityIndicator)
    - @react-native-community/slider
    - expo-av types
  Stateless controls view. Receives handlers + derived state from the hook.
*/
import React from "react";
import * as RN from "react-native";
import { IconButton, ActivityIndicator } from "react-native-paper";
import Slider from "@react-native-community/slider";
import type { ControlsProps } from "./types";
import AutoplayToggle from "./AutoplayToggle";

const AnimatedView = RN.Animated.View;

const Controls: React.FC<ControlsProps> = ({
	captionsEnabled,
  anim,
  controlsVisible,
  isLive,
  isPlaying,
  didJustFinish,
  isMuted,
  looping,
  autoplayEnabled,
  playbackRate,
  captionsLength,
  chapters,
  positionMillis,
  durationMillis,
  playableMillis,
  colors,
  handlers,
  tokens,
  textColor,
}) => {
  const translateY = anim.interpolate?.({ inputRange: [0, 1], outputRange: [10, 0] }) ?? 0;

  const trackInactive = colors.scheme === "light" ? "rgba(11,18,32,0.28)" : "rgba(255,255,255,0.28)";

  return (
    <AnimatedView
      style={[
        handlers.styles.controlsWrap,
        {
          backgroundColor: colors.overlay,
          opacity: anim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={controlsVisible ? "auto" : "none"}
    >
      {/* Top row */}
      <RN.View style={[handlers.styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
        <RN.View style={{ flexDirection: "row", alignItems: "center" }}>
          <RN.Pressable onPress={handlers.togglePlay} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : didJustFinish ? "Replay" : "Play"}>
            <IconButton icon={isPlaying ? "pause" : didJustFinish ? "replay" : "play"} size={tokens.sizes.controlIcon} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          <RN.Pressable onPress={handlers.toggleMute} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel={isMuted ? "Unmute" : "Mute"}>
            <IconButton icon={isMuted ? "volume-off" : "volume-high"} size={tokens.sizes.controlIcon} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          <RN.Pressable onPress={handlers.cycleDisplayMode} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel={`Display mode. Tap to cycle.`}>
            <IconButton icon="crop-free" size={22} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          {captionsLength > 0 && (
            <RN.Pressable onPress={handlers.toggleCaptions} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel="Toggle captions">
              <IconButton
  icon={captionsEnabled ? "closed-caption" : "closed-caption-off"}
  size={22}
  color={captionsEnabled ? tokens.accent : textColor}
  style={handlers.styles.iconButton}
/>

            </RN.Pressable>
          )}
        </RN.View>

        <RN.View style={{ flexDirection: "row", alignItems: "center" }}>
          <RN.Pressable onPress={handlers.toggleLoop} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel={`Loop ${looping ? "on" : "off"}`}>
            <IconButton icon={looping ? "repeat" : "repeat-variant"} size={22} color={looping ? tokens.accent : textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          {/* Autoplay Toggle - YouTube 2025 Style */}
          <RN.View style={handlers.styles.controlTouchArea}>
            <AutoplayToggle
              autoplayEnabled={autoplayEnabled}
              onToggle={handlers.toggleAutoplay}
              size={28}
              disabled={false}
            />
          </RN.View>

          <RN.Pressable onPress={handlers.toggleFullscreen} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel="Fullscreen">
            <IconButton icon="fullscreen" size={tokens.sizes.controlIcon} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          <RN.Pressable onPress={handlers.openMenu} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel="More options">
            <IconButton icon="dots-vertical" size={22} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>
        </RN.View>
      </RN.View>

      {/* Slider / Timeline */}
      {!isLive ? (
        <RN.View style={handlers.styles.sliderRow}>
          <RN.Text style={[handlers.styles.timeLabel, { color: textColor }]}>{handlers.utils.formatTime(positionMillis)}</RN.Text>

          <RN.View style={{ flex: 1, justifyContent: "center" }}>
            <RN.View style={{ height: tokens.sizes.sliderHeight, width: "100%", position: "relative", justifyContent: "center" }}>
              <RN.View
                style={{
                  position: "absolute",
                  left: 0,
                  height: tokens.sizes.sliderHeight,
                  width: durationMillis && playableMillis ? `${Math.max(0, Math.min((playableMillis / durationMillis) * 100, 100))}%` : "0%",
                  backgroundColor: colors.scheme === "light" ? "rgba(11,18,32,0.18)" : "rgba(255,255,255,0.18)",
                  borderRadius: 4,
                }}
              />

              <Slider
                style={{ height: tokens.sizes.sliderHeight }}
                value={durationMillis ? Math.max(0, Math.min(positionMillis / durationMillis, 1)) : 0}
                onSlidingComplete={handlers.onSeekComplete}
                minimumValue={0}
                maximumValue={1}
                minimumTrackTintColor={tokens.accent}
                maximumTrackTintColor={trackInactive}
                thumbTintColor={tokens.accent}
                accessibilityLabel="Seek timeline"
                accessible
              />

              {chapters.length > 0 &&
                durationMillis &&
                chapters.map((c, i) => {
                  const pct = Math.max(0, Math.min((c.startMs / (durationMillis || 1)) * 100, 100));
                  return <RN.View key={`cm-${i}`} style={[handlers.styles.chapterMarker, { left: `${pct}%` }]} accessible accessibilityLabel={`Chapter ${c.title}`} />;
                })}
            </RN.View>
          </RN.View>

          <RN.Text style={[handlers.styles.timeLabel, { color: textColor }]}>{handlers.utils.formatTime(durationMillis)}</RN.Text>
        </RN.View>
      ) : (
        <RN.View style={handlers.styles.liveInfo}>
          <RN.Text style={[handlers.styles.liveInfoText, { color: textColor }]}>Live stream</RN.Text>
        </RN.View>
      )}

      {/* Bottom row */}
      <RN.View style={handlers.styles.rowBottom}>
        <RN.View style={handlers.styles.quickGroup}>
          <RN.TouchableOpacity onPress={() => handlers.quickSeek(-10000)} style={[handlers.styles.quickBtn, { backgroundColor: colors.controlSurface }]} accessibilityRole="button" accessibilityLabel="Rewind 10 seconds">
            <RN.Text style={[handlers.styles.quickText, { color: textColor }]}>⟲ 10s</RN.Text>
          </RN.TouchableOpacity>
          <RN.TouchableOpacity onPress={() => handlers.quickSeek(10000)} style={[handlers.styles.quickBtn, { backgroundColor: colors.controlSurface }]} accessibilityRole="button" accessibilityLabel="Forward 10 seconds">
            <RN.Text style={[handlers.styles.quickText, { color: textColor }]}>10s ⟳</RN.Text>
          </RN.TouchableOpacity>
        </RN.View>

        <RN.View style={{ flexDirection: "row", alignItems: "center" }}>
          <RN.TouchableOpacity onPress={handlers.openSpeedMenu} style={[handlers.styles.smallBadge, { backgroundColor: colors.controlSurface }]} accessibilityRole="button" accessibilityLabel={`Playback speed ${playbackRate}x`}>
            <RN.Text style={[handlers.styles.badgeText, { color: textColor }]}>{playbackRate}x</RN.Text>
          </RN.TouchableOpacity>

          <RN.TouchableOpacity onPress={handlers.openQualityMenu} style={[handlers.styles.smallBadge, { backgroundColor: colors.controlSurface, marginLeft: 8 }]} accessibilityRole="button" accessibilityLabel="Quality">
            <RN.Text style={[handlers.styles.badgeText, { color: textColor }]}>Auto</RN.Text>
          </RN.TouchableOpacity>

          {handlers.didJustFinish && (
            <RN.TouchableOpacity
              onPress={handlers.replay}
              style={[handlers.styles.replayBtn, { backgroundColor: tokens.accent, marginLeft: 12 }]}
              accessibilityRole="button"
              accessibilityLabel="Replay"
            >
              <RN.Text style={[handlers.styles.replayText, { color: "#fff" }]}>Replay</RN.Text>
            </RN.TouchableOpacity>
          )}
        </RN.View>
      </RN.View>
    </AnimatedView>
  );
};

export default React.memo(Controls);
