// components/Video/actions/VideoActionBar.tsx
// YouTube-style action bar. Owns its sheets and reads/writes state through
// useVideoActions (backed by VideoActionsRepository), never local flags.
import React, { memo, useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLAYER_FEATURE_FLAGS } from "../../../constants/config";
import Logger from "../../../utils/Logger";
import { useVideoActions } from "./useVideoActions";
import { VideoActionButton } from "./VideoActionButton";
import { ClipEditor } from "./sheets/ClipEditor";
import { DownloadSheet } from "./sheets/DownloadSheet";
import { OverflowMenu } from "./sheets/OverflowMenu";
import { ReportSheet } from "./sheets/ReportSheet";
import { SaveSheet } from "./sheets/SaveSheet";
import { ShareSheet } from "./sheets/ShareSheet";
import { ThanksSheet } from "./sheets/ThanksSheet";

export interface VideoActionBarProps {
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly channelId?: string;
  readonly sourceKind: "mp4" | "hls";
}

function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export const VideoActionBar = memo(function VideoActionBar({ videoId, videoTitle, videoUrl, channelId, sourceKind }: VideoActionBarProps) {
  const insets = useSafeAreaInsets();
  const actions = useVideoActions(videoId);
  const [shareVisible, setShareVisible] = useState(false);
  const [downloadVisible, setDownloadVisible] = useState(false);
  const [clipVisible, setClipVisible] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [thanksVisible, setThanksVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);

  const liked = actions.state?.liked ?? false;
  const disliked = actions.state?.disliked ?? false;
  const counts = actions.state?.counts ?? null;

  const handleLike = useCallback(() => {
    Logger.info("[VideoActionBar] Like pressed", { videoId, currentlyLiked: liked });
    actions.like();
  }, [videoId, liked, actions]);

  const handleDislike = useCallback(() => {
    Logger.info("[VideoActionBar] Dislike pressed", { videoId, currentlyDisliked: disliked });
    actions.dislike();
  }, [videoId, disliked, actions]);

  const showDownload = PLAYER_FEATURE_FLAGS.download && sourceKind === "mp4";
  const showClip = PLAYER_FEATURE_FLAGS.clipEditor;
  const showThanks = PLAYER_FEATURE_FLAGS.thanks;
  const showDislike = PLAYER_FEATURE_FLAGS.dislike;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 0) }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={styles.scrollView}>
        <VideoActionButton
          icon={liked ? "thumb-up" : "thumb-up-outline"}
          label={counts && counts.likes > 0 ? formatCount(counts.likes) : "Like"}
          active={liked}
          onPress={handleLike}
          accessibilityLabel={`Like button. ${liked ? "Currently liked" : "Press to like this video"}${counts ? `. ${counts.likes} likes` : ""}`}
        />

        {showDislike ? (
          <VideoActionButton
            icon={disliked ? "thumb-down" : "thumb-down-outline"}
            label="Dislike"
            active={disliked}
            onPress={handleDislike}
            accessibilityLabel={`Dislike button. ${disliked ? "Currently disliked" : "Press to dislike this video"}`}
          />
        ) : null}

        <VideoActionButton icon="share-variant" label="Share" active={false} onPress={() => setShareVisible(true)} accessibilityLabel="Share button. Press to share this video" />

        {showDownload ? (
          <VideoActionButton icon="download" label="Download" active={false} onPress={() => setDownloadVisible(true)} accessibilityLabel="Download button. Press to download this video" />
        ) : null}

        {showClip ? (
          <VideoActionButton icon="scissors-cutting" label="Clip" active={false} onPress={() => setClipVisible(true)} accessibilityLabel="Clip button. Press to create a clip from this video" />
        ) : null}

        <VideoActionButton icon="playlist-plus" label="Save" active={false} onPress={() => setSaveVisible(true)} accessibilityLabel="Save button. Press to save this video to a playlist" />

        {showThanks ? (
          <VideoActionButton icon="hand-heart" label="Thanks" active={false} onPress={() => setThanksVisible(true)} accessibilityLabel="Thanks button. Press to say thanks with a payment" />
        ) : null}

        <VideoActionButton icon="dots-vertical" label="More" active={false} onPress={() => setMoreVisible(true)} accessibilityLabel="More options button. Press to see more options" />
      </ScrollView>

      {actions.error ? <Text style={styles.errorText}>{actions.error.message}</Text> : null}

      <ShareSheet videoId={videoId} title={videoTitle} url={videoUrl} visible={shareVisible} onClose={() => setShareVisible(false)} />
      <DownloadSheet visible={downloadVisible} onClose={() => setDownloadVisible(false)} video={{ id: videoId, url: videoUrl, kind: sourceKind, title: videoTitle }} />
      <ClipEditor visible={clipVisible} onClose={() => setClipVisible(false)} videoId={videoId} durationMs={0} currentPositionMs={0} onCreate={actions.createClip} />
      <SaveSheet videoId={videoId} visible={saveVisible} onClose={() => setSaveVisible(false)} />
      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={(reason, details) => {
          actions.report(reason, details);
          setReportVisible(false);
        }}
      />
      <ThanksSheet videoId={videoId} visible={thanksVisible} onClose={() => setThanksVisible(false)} />
      <OverflowMenu
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        videoId={videoId}
        channelId={channelId}
        onNotInterested={() => {
          actions.notInterested();
          setMoreVisible(false);
        }}
        onReport={() => {
          setMoreVisible(false);
          setReportVisible(true);
        }}
        onDontRecommendChannel={() => {
          if (channelId) actions.hideChannel(channelId);
          setMoreVisible(false);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 4,
    borderTopWidth: 0,
    borderTopColor: "transparent",
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#B91C1C",
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
});
