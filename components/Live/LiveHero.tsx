// components/Live/LiveHero.tsx
/**
 * The state switch for the Live tab's main area. Resolves the session's
 * source itself and renders an error instead of ever handing an unresolved
 * source to the player or the embed view.
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import { VideoPlaybackContainer } from "../Video/VideoPlaybackContainer";
import { LiveEmbedView } from "./LiveEmbedView";
import { LiveBadge } from "./LiveBadge";
import { UpcomingCard } from "./UpcomingCard";
import { LiveEndedOverlay } from "./LiveEndedOverlay";
import { resolveEmbed, resolvePlayable } from "../../services/mediaSourceResolver";
import { track } from "../../services/analytics";
import type { LiveStatus, Video } from "../../types/domain";

export interface LiveHeroProps {
  readonly status: LiveStatus;
  readonly onWatchReplay: (videoId: string) => void;
  readonly testID?: string;
}

function toLiveVideo(session: NonNullable<LiveStatus["session"]>): Video {
  return {
    id: session.id,
    title: session.title,
    thumbnailUrl: session.thumbnailUrl,
    durationSec: 0,
    publishedAt: session.startsAt,
    channel: { id: "live", name: "Yagna Live" },
    isLive: true,
    source: session.source,
  };
}

export function LiveHero({ status, onWatchReplay, testID }: LiveHeroProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const trackedSessionRef = useRef<string | null>(null);

  const session = status.session;

  useEffect(() => {
    if (status.state === "live" && session && trackedSessionRef.current !== session.id) {
      trackedSessionRef.current = session.id;
      track("live_join", { sessionId: session.id });
    }
  }, [status.state, session]);

  if (status.state === "none" || !session) {
    return (
      <View testID={`${testID}-none`} style={styles.center}>
        <Text style={[styles.message, { color: colors.textMuted }]}>
          No live session is scheduled right now.
        </Text>
      </View>
    );
  }

  if (status.state === "upcoming") {
    return <UpcomingCard session={session} testID={`${testID}-upcoming`} />;
  }

  if (status.state === "ended") {
    return (
      <LiveEndedOverlay
        replayVideoId={session.replayVideoId}
        onWatchReplay={onWatchReplay}
        testID={`${testID}-replay`}
      />
    );
  }

  // status.state === "live"
  try {
    if (session.source.kind === "youtube") {
      const target = resolveEmbed(session);
      return (
        <View style={styles.playerWrap}>
          <LiveBadge testID={`${testID}-badge`} />
          <LiveEmbedView target={target} testID={`${testID}-embed`} />
        </View>
      );
    }

    const source = resolvePlayable(session);
    const video = toLiveVideo(session);
    return (
      <View style={styles.playerWrap}>
        <LiveBadge testID={`${testID}-badge`} />
        <VideoPlaybackContainer
          video={video}
          source={source}
          hasNext={false}
          hasPrevious={false}
          isAutoplayEnabled={false}
          isMinimized={false}
          isFullscreen={false}
          onNext={() => {}}
          onPrevious={() => {}}
          onFinished={() => {}}
          onToggleMinimize={() => {}}
          onToggleAutoplay={() => {}}
          onFullscreenChange={() => {}}
        />
      </View>
    );
  } catch {
    return (
      <View testID={`${testID}-source-error`} style={styles.center}>
        <Text style={[styles.message, { color: colors.text }]}>
          This live stream is unavailable right now.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.xl,
  },
  message: { ...tokens.typography.body, textAlign: "center" },
  playerWrap: { gap: tokens.spacing.xs },
});
