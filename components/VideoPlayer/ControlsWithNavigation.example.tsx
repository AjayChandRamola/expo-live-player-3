/**
 * components/VideoPlayer/ControlsWithNavigation.example.tsx
 *
 * EXAMPLE: Enhanced Controls component with YouTube-style navigation buttons
 * 
 * This shows how to integrate PreviousVideoButton and NextVideoButton
 * into your existing Controls.tsx component.
 *
 * TO USE:
 * 1. Copy the relevant sections to your Controls.tsx
 * 2. Add navigation handlers to your VideoPlayer logic
 * 3. Pass hasPrevious/hasNext props from parent component
 */

import React from "react";
import * as RN from "react-native";
import { IconButton, ActivityIndicator } from "react-native-paper";
import Slider from "@react-native-community/slider";
import type { ControlsProps } from "./types";
import { PreviousVideoButton } from "./PreviousVideoButton";
import { NextVideoButton } from "./NextVideoButton";

const AnimatedView = RN.Animated.View;

// Extended props to include navigation
export type ControlsWithNavigationProps = ControlsProps & {
  // New navigation props
  hasPreviousVideo?: boolean;
  hasNextVideo?: boolean;
  onNavigateToPrevious?: () => void;
  onNavigateToNext?: () => void;
};

const ControlsWithNavigation: React.FC<ControlsWithNavigationProps> = ({
  captionsEnabled,
  anim,
  controlsVisible,
  isLive,
  isPlaying,
  didJustFinish,
  isMuted,
  looping,
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
  // Navigation props
  hasPreviousVideo = false,
  hasNextVideo = false,
  onNavigateToPrevious = () => console.log("Navigate to previous video"),
  onNavigateToNext = () => console.log("Navigate to next video"),
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
      {/* Top row with navigation buttons */}
      <RN.View style={[handlers.styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
        <RN.View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* === NEW: Previous Video Button === */}
          <RN.View style={{ marginRight: 8 }}>
            <PreviousVideoButton
              opacity={anim}
              onPress={onNavigateToPrevious}
              disabled={!hasPreviousVideo}
              size={52} // Slightly smaller to fit in control bar
              style={{ position: "relative" }} // Override absolute positioning
            />
          </RN.View>

          {/* Existing Play/Pause button */}
          <RN.Pressable onPress={handlers.togglePlay} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : didJustFinish ? "Replay" : "Play"}>
            <IconButton icon={isPlaying ? "pause" : didJustFinish ? "replay" : "play"} size={tokens.sizes.controlIcon} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          {/* === NEW: Next Video Button === */}
          <RN.View style={{ marginLeft: 8 }}>
            <NextVideoButton
              opacity={anim}
              onPress={onNavigateToNext}
              disabled={!hasNextVideo}
              size={52} // Slightly smaller to fit in control bar
              style={{ position: "relative" }} // Override absolute positioning
            />
          </RN.View>

          {/* Existing mute button */}
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

        {/* Right side controls (unchanged) */}
        <RN.View style={{ flexDirection: "row", alignItems: "center" }}>
          <RN.Pressable onPress={handlers.toggleLoop} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel={`Loop ${looping ? "on" : "off"}`}>
            <IconButton icon={looping ? "repeat" : "repeat-variant"} size={22} color={looping ? tokens.accent : textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          <RN.Pressable onPress={handlers.toggleFullscreen} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel="Fullscreen">
            <IconButton icon="fullscreen" size={tokens.sizes.controlIcon} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>

          <RN.Pressable onPress={handlers.openMenu} style={handlers.styles.controlTouchArea} accessibilityRole="button" accessibilityLabel="More options">
            <IconButton icon="dots-vertical" size={22} color={textColor} style={handlers.styles.iconButton} />
          </RN.Pressable>
        </RN.View>
      </RN.View>

      {/* Slider / Timeline (unchanged) */}
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

      {/* Bottom row (unchanged) */}
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

export default React.memo(ControlsWithNavigation);

/**
 * === INTEGRATION NOTES ===
 *
 * 1. In your VideoPlayer component, add navigation state:
 *
 *    const [playlist, setPlaylist] = useState([...videos]);
 *    const [currentIndex, setCurrentIndex] = useState(0);
 *
 *    const hasPrevious = currentIndex > 0;
 *    const hasNext = currentIndex < playlist.length - 1;
 *
 *    const handlePrevious = () => {
 *      if (hasPrevious) {
 *        setCurrentIndex(currentIndex - 1);
 *        // Load previous video
 *      }
 *    };
 *
 *    const handleNext = () => {
 *      if (hasNext) {
 *        setCurrentIndex(currentIndex + 1);
 *        // Load next video
 *      }
 *    };
 *
 * 2. Pass these props to ControlsWithNavigation:
 *
 *    <ControlsWithNavigation
 *      {...existingProps}
 *      hasPreviousVideo={hasPrevious}
 *      hasNextVideo={hasNext}
 *      onNavigateToPrevious={handlePrevious}
 *      onNavigateToNext={handleNext}
 *    />
 *
 * 3. Style adjustments:
 *    - Navigation buttons use size={52} in control bar (smaller than standalone 64px)
 *    - Position is set to "relative" to work within flexbox layout
 *    - Opacity animation is inherited from parent anim value
 *
 * 4. For center-screen overlay (YouTube style):
 *    - Use larger size (64px or 80px)
 *    - Position absolute with custom positioning
 *    - See YouTubeControlsDemo.tsx for layout example
 */

