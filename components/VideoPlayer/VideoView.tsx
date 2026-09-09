// components/VideoPlayer/VideoView.tsx
/* 
  Dependencies:
    - expo-video
    - react-native
  Renders expo-video <VideoView /> and surfaces events to parent handlers.
  NOTE: This component may be deprecated in favor of direct VideoView usage.
*/
import React from "react";
import * as RN from "react-native";
import { VideoView as ExpoVideoView, useVideoPlayer } from "expo-video";
import type { VideoViewProps } from "./types";

const VideoView: React.FC<VideoViewProps> = ({
  player,
  sourceUrl,
  onPlaybackStatusUpdate,
  onFullscreenUpdate,
  onLoad,
  onError,
  onVideoAreaPress,
  resizeMode = "contain",
}) => {
  // If no player provided, create one
  const defaultPlayer = useVideoPlayer(sourceUrl || "", (player) => {
    player.loop = false;
  });
  const videoPlayer = player || defaultPlayer;

  return (
    <RN.TouchableOpacity
      activeOpacity={1}
      style={[{ width: "100%", height: "100%" }]}
      onPress={onVideoAreaPress}
      accessibilityLabel="Video area"
      accessibilityHint="Tap to toggle controls. Double-tap left or right to seek 10 seconds."
    >
      <ExpoVideoView
        player={videoPlayer}
        style={{ width: "100%", height: "100%" }}
        contentFit={resizeMode === "contain" ? "contain" : resizeMode === "cover" ? "cover" : "fill"}
        nativeControls={false}
        allowsFullscreen={false}
        accessibilityLabel="Video content"
      />
    </RN.TouchableOpacity>
  );
};

export default React.memo(VideoView);
