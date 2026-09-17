// components/Video/VideoPlaybackContainer.tsx
/**
 * The only module outside tests permitted to import components/VideoPlayer.
 *
 * Maps a domain Video and a resolved PlayableSource onto the player's frozen
 * prop surface (see LLD index section 5.9) and lifts exactly two events:
 * finished and fullscreen changed. Adds no view wrapper, no network call,
 * and reads no playback state — the player exposes none.
 */
import React, { useEffect, useRef } from "react";
import VideoPlayer from "../VideoPlayer";
import { track } from "../../services/analytics";
import type { PlayableSource, Video } from "../../types/domain";

export interface VideoPlaybackContainerProps {
  readonly video: Video;
  readonly source: PlayableSource;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly isAutoplayEnabled: boolean;
  readonly isMinimized: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onFinished: () => void;
  readonly onToggleMinimize: () => void;
  readonly onFullscreenChange: (isFullscreen: boolean) => void;
}

export function VideoPlaybackContainer({
  video,
  source,
  hasNext,
  hasPrevious,
  isAutoplayEnabled,
  isMinimized,
  onNext,
  onPrevious,
  onFinished,
  onToggleMinimize,
  onFullscreenChange,
}: VideoPlaybackContainerProps) {
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    const key = `${video.id}:${source.url}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;
    track("video_start", { videoId: video.id, kind: source.kind });
  }, [video.id, source.url, source.kind]);

  const handleFinished = () => {
    track("video_finish", { videoId: video.id });
    onFinished();
  };

  return (
    <VideoPlayer
      sourceUrl={source.url}
      hasPreviousVideo={hasPrevious}
      hasNextVideo={hasNext}
      onNavigateToPrevious={onPrevious}
      onNavigateToNext={onNext}
      isMinimized={isMinimized}
      onToggleMinimize={onToggleMinimize}
      onFullscreenChange={onFullscreenChange}
      isAutoplayEnabled={isAutoplayEnabled}
      onVideoFinished={handleFinished}
      captions={video.captions ? [...video.captions] : undefined}
      chapters={video.chapters ? [...video.chapters] : undefined}
      videoId={video.id}
      videoTitle={video.title}
      videoUrl={source.url}
      channelId={video.channel.id}
    />
  );
}
