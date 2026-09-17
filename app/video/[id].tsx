// app/video/[id].tsx
import React, { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { VideoPlaybackContainer } from "../../components/Video/VideoPlaybackContainer";
import { VideoMeta } from "../../components/Video/VideoMeta";
import { StateView } from "../../components/ui/StateView";
import { Screen } from "../../components/ui/Screen";
import UpNextList from "../../components/VideoFeed/UpNextList";
import { usePlayQueue } from "../../contexts/PlayQueueContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useVideoDetail } from "../../hooks/useVideoDetail";
import { useRelatedVideos } from "../../hooks/useRelatedVideos";
import { toVideoMetadata } from "../../services/videoMetadataAdapter";
import type { VideoMetadata } from "../../types/video";

function sanitizeId(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
  }
  const trimmed = out.trim().slice(0, 64);
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function VideoScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const safeId = sanitizeId(params.id);

  const { status, data, error, retry } = useVideoDetail(safeId);
  const relatedResult = useRelatedVideos(safeId);
  const queue = usePlayQueue();
  const settings = useSettings();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const nextId = queue.currentVideo?.id;
    if (nextId && nextId !== safeId) {
      router.setParams({ id: nextId });
    }
  }, [queue.currentVideo?.id, safeId, router]);

  const handleFinished = useCallback(() => {
    if (queue.isAutoplayEnabled) {
      queue.playNext();
    }
  }, [queue]);

  const handleNext = useCallback(() => {
    queue.playNext();
  }, [queue]);

  const handlePrevious = useCallback(() => {
    queue.playPrevious();
  }, [queue]);

  const handleFullscreenChange = useCallback((isFs: boolean) => {
    setIsFullscreen(isFs);
  }, []);

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const handleToggleAutoplay = useCallback(
    (enabled: boolean) => {
      queue.setAutoplay(enabled);
      settings.setAutoplayDefault(enabled);
    },
    [queue, settings],
  );

  const handleUpNextPress = useCallback(
    (video: VideoMetadata) => {
      queue.playById(video.id);
    },
    [queue],
  );

  if (status !== "success" || !data) {
    return (
      <Screen testID="video-screen">
        <Stack.Screen options={{ headerBackTitle: "Back" }} />
        <StateView status={status} error={error} onRetry={retry} testID="video-state" />
      </Screen>
    );
  }

  const relatedMetadata = (relatedResult.data ?? []).map(toVideoMetadata);

  return (
    <Screen testID="video-screen">
      <Stack.Screen options={{ headerBackTitle: "Back" }} />
      <VideoPlaybackContainer
        video={data.video}
        source={data.source}
        hasNext={queue.hasNext}
        hasPrevious={queue.hasPrevious}
        isAutoplayEnabled={queue.isAutoplayEnabled}
        isMinimized={isMinimized}
        isFullscreen={isFullscreen}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onFinished={handleFinished}
        onToggleMinimize={handleToggleMinimize}
        onToggleAutoplay={handleToggleAutoplay}
        onFullscreenChange={handleFullscreenChange}
      />
      {!isFullscreen ? (
        <>
          <VideoMeta video={data.video} testID="video-meta" />
          <UpNextList
            videos={relatedMetadata}
            currentVideoId={data.video.id}
            onVideoPress={handleUpNextPress}
          />
        </>
      ) : null}
    </Screen>
  );
}
