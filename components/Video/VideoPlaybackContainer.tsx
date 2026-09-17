// components/Video/VideoPlaybackContainer.tsx
/**
 * The only module outside tests permitted to import components/VideoPlayer.
 * Maps a domain Video and a resolved PlayableSource onto VideoPlayerProps,
 * prefers a downloaded file when one exists, renders the app action bar
 * below the player, and emits analytics. Reads no playback state beyond
 * the callbacks the player exposes.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import VideoPlayer from "../VideoPlayer";
import type { PlaybackSnapshot } from "../VideoPlayer/types";
import { track } from "../../services/analytics";
import type { PlayableSource, Video } from "../../types/domain";
import { VideoActionBar } from "./actions/VideoActionBar";
import { useVideoActionsDeps } from "./actions/VideoActionsProvider";

export interface VideoPlaybackContainerProps {
  readonly video: Video;
  readonly source: PlayableSource;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayEnabled: boolean;
  readonly isMinimized: boolean;
  readonly isFullscreen: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onFinished: () => void;
  readonly onToggleMinimize: () => void;
  readonly onToggleAutoplay: (enabled: boolean) => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
}

const PROGRESS_ANALYTICS_INTERVAL_MS = 60_000;

export function VideoPlaybackContainer(props: VideoPlaybackContainerProps) {
  const { video, source, isFullscreen, isMinimized } = props;
  const { downloads } = useVideoActionsDeps();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const lastTrackedRef = useRef("");
  const lastProgressAtRef = useRef(0);

  // Prefer a completed download; stale-guarded by video id.
  useEffect(() => {
    let alive = true;
    setLocalUri(null);
    downloads.resolveLocalUri(video.id).then((uri) => {
      if (alive) setLocalUri(uri);
    });
    return () => {
      alive = false;
    };
  }, [downloads, video.id]);

  const effectiveUrl = localUri ?? source.url;
  const effectiveKind: "mp4" | "hls" = localUri ? "mp4" : source.kind;

  useEffect(() => {
    const key = `${video.id}:${effectiveUrl}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;
    track("video_start", { videoId: video.id, kind: effectiveKind, local: localUri !== null });
  }, [video.id, effectiveUrl, effectiveKind, localUri]);

  const handleFinished = useCallback(() => {
    track("video_finish", { videoId: video.id });
    props.onFinished();
  }, [props, video.id]);

  const handlePositionChange = useCallback(
    (positionMs: number) => {
      const at = Date.now();
      if (at - lastProgressAtRef.current < PROGRESS_ANALYTICS_INTERVAL_MS) return;
      lastProgressAtRef.current = at;
      track("video_progress", { videoId: video.id, positionMs });
    },
    [video.id],
  );

  const handleStateChange = useCallback(
    (snapshot: PlaybackSnapshot) => {
      // A local file that fails to play falls back to the network source once.
      if (snapshot.status === "error" && localUri !== null) {
        setLocalUri(null);
        void downloads.remove(video.id);
      }
    },
    [downloads, localUri, video.id],
  );

  return (
    <View style={styles.column}>
      <VideoPlayer
        source={{ url: effectiveUrl, kind: effectiveKind, isLive: video.isLive, posterUrl: video.thumbnailUrl }}
        title={video.title}
        captions={video.captions}
        chapters={video.chapters}
        hasNext={props.hasNext}
        hasPrevious={props.hasPrevious}
        isAutoplayNextEnabled={props.isAutoplayEnabled}
        isMinimized={isMinimized}
        onNext={props.onNext}
        onPrevious={props.onPrevious}
        onFinished={handleFinished}
        onToggleMinimize={props.onToggleMinimize}
        onToggleAutoplayNext={props.onToggleAutoplay}
        onFullscreenChange={props.onFullscreenChange}
        onPositionChange={handlePositionChange}
        onStateChange={handleStateChange}
      />
      {!isFullscreen && !isMinimized ? (
        <VideoActionBar videoId={video.id} videoTitle={video.title} videoUrl={source.url} channelId={video.channel.id} sourceKind={source.kind} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ column: { width: "100%" } });
