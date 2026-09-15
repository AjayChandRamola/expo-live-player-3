// app/(tabs)/live.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { StateView } from "../../components/ui/StateView";
import { LiveHero } from "../../components/Live/LiveHero";
import { RecentSessionsList } from "../../components/Live/RecentSessionsList";
import { useLiveStatus } from "../../hooks/useLiveStatus";
import { getRecentSessions } from "../../services/liveService";
import type { LiveSession } from "../../types/domain";

export default function LiveScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { status, data, error, retry } = useLiveStatus({ enabled: isFocused });
  const isRefreshing = status === "loading";
  const [recentSessions, setRecentSessions] = useState<LiveSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    getRecentSessions()
      .then((sessions) => {
        if (!cancelled) setRecentSessions(sessions);
      })
      .catch(() => {
        // Recent sessions are a supplementary list; a failure here does not
        // block the live hero above it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleWatchReplay = useCallback(
    (videoId: string) => {
      router.push(`/video/${videoId}`);
    },
    [router],
  );

  const handleSelectSession = useCallback(
    (session: LiveSession) => {
      if (session.replayVideoId) {
        router.push(`/video/${session.replayVideoId}`);
      }
    },
    [router],
  );

  return (
    <Screen testID="live-screen">
      <StateView status={status} error={error} onRetry={retry} testID="live-state" />

      {status === "success" && data ? (
        <>
          <LiveHero status={data} onWatchReplay={handleWatchReplay} testID="live" />
          <RecentSessionsList
            sessions={recentSessions}
            onSelect={handleSelectSession}
            testID="live-list"
            refreshing={isRefreshing}
            onRefresh={retry}
          />
        </>
      ) : null}
    </Screen>
  );
}
