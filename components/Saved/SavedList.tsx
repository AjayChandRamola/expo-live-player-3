// components/Saved/SavedList.tsx
import React, { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import VideoCard from "../VideoFeed/VideoCard";
import { IconButton } from "../ui/IconButton";
import { toVideoMetadata } from "../../services/videoMetadataAdapter";
import { tokens } from "../../constants/tokens";
import type { Video } from "../../types/domain";

export interface SavedListProps {
  readonly videos: readonly Video[];
  readonly onPressVideo: (video: Video) => void;
  readonly onUnsave: (id: string) => void;
}

export function SavedList({ videos, onPressVideo, onUnsave }: SavedListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Video }) => (
      <View style={styles.row}>
        <View style={styles.cardWrap}>
          <VideoCard
            testID={`saved-item-${item.id}`}
            video={toVideoMetadata(item)}
            onPress={() => onPressVideo(item)}
          />
        </View>
        <IconButton
          testID={`saved-unsave-${item.id}`}
          icon="bookmark-remove"
          accessibilityLabel={`Remove ${item.title} from saved`}
          onPress={() => onUnsave(item.id)}
        />
      </View>
    ),
    [onPressVideo, onUnsave],
  );

  return (
    <FlatList
      data={videos as Video[]}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: tokens.spacing.md,
  },
  cardWrap: { flex: 1 },
});
