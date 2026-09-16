// components/VideoPlayer/ui/PlayerSurface.tsx
// Renders the expo-video surface and the poster. R3 exception: imports VideoView only.
import { Image } from "expo-image";
import { VideoView, type VideoPlayer } from "expo-video";
import React, { forwardRef } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { playerTokens } from "../tokens";

export interface PlayerSurfaceProps {
  readonly player: VideoPlayer;
  readonly posterUrl?: string;
  readonly showPoster: boolean;
  readonly allowsPictureInPicture: boolean;
  readonly onPictureInPictureStart: () => void;
  readonly onPictureInPictureStop: () => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly children?: React.ReactNode;
  readonly testID?: string;
}

export const PLAYER_SURFACE_TEST_IDS = { video: "player-video-view", poster: "player-poster" } as const;

export const PlayerSurface = forwardRef<VideoView, PlayerSurfaceProps>(function PlayerSurface(
  { player, posterUrl, showPoster, allowsPictureInPicture, onPictureInPictureStart, onPictureInPictureStop, onLayout, children, testID },
  ref,
) {
  return (
    <View style={styles.container} onLayout={onLayout} testID={testID}>
      <VideoView
        ref={ref}
        player={player}
        style={styles.fill}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={allowsPictureInPicture}
        startsPictureInPictureAutomatically={allowsPictureInPicture}
        onPictureInPictureStart={onPictureInPictureStart}
        onPictureInPictureStop={onPictureInPictureStop}
        testID={PLAYER_SURFACE_TEST_IDS.video}
      />
      {showPoster && posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.fill} contentFit="contain" accessible={false} testID={PLAYER_SURFACE_TEST_IDS.poster} />
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", height: "100%", backgroundColor: playerTokens.color.videoBackground, overflow: "hidden" },
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
});
