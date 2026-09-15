// app/(tabs)/saved.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { StateView } from "../../components/ui/StateView";
import { EmptySaved } from "../../components/Saved/EmptySaved";
import { SavedList } from "../../components/Saved/SavedList";
import { getColors, tokens } from "../../constants/tokens";
import { TIMING } from "../../constants/config";
import { useSaved } from "../../contexts/SavedContext";
import { usePlayQueue } from "../../contexts/PlayQueueContext";
import { useSavedVideos } from "../../hooks/useSavedVideos";
import type { Video } from "../../types/domain";

export default function SavedScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const { toggleSave } = useSaved();
  const { setQueue } = usePlayQueue();
  const { status, data, error, retry, missingIds } = useSavedVideos();

  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handlePressVideo = useCallback(
    (video: Video) => {
      setQueue(data ?? [], video.id);
      router.push(`/video/${video.id}`);
    },
    [router, setQueue, data],
  );

  const handleUnsave = useCallback(
    (id: string) => {
      toggleSave(id);
      setUndoId(id);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoId(null), TIMING.undoSnackbarMs);
    },
    [toggleSave],
  );

  const handleUndo = useCallback(() => {
    if (!undoId) return;
    toggleSave(undoId);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoId(null);
  }, [toggleSave, undoId]);

  return (
    <Screen testID="saved-screen">
      <StateView status={status} error={error} onRetry={retry} testID="saved-state" />

      {status === "empty" ? <EmptySaved testID="saved-empty" /> : null}

      {status === "success" && data ? (
        <>
          {missingIds.length > 0 ? (
            <View testID="saved-missing-notice" style={styles.notice}>
              <Text style={[styles.noticeText, { color: colors.textMuted }]}>
                {missingIds.length} saved video{missingIds.length > 1 ? "s are" : " is"} no longer
                available.
              </Text>
            </View>
          ) : null}
          <SavedList videos={data} onPressVideo={handlePressVideo} onUnsave={handleUnsave} />
        </>
      ) : null}

      {undoId ? (
        <View style={[styles.snackbar, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.snackbarText, { color: colors.text }]}>Removed from Saved</Text>
          <Pressable
            testID="saved-undo"
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo remove from saved"
          >
            <Text style={[styles.undoText, { color: colors.primary }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  noticeText: { ...tokens.typography.caption },
  snackbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
  },
  snackbarText: { ...tokens.typography.body },
  undoText: { ...tokens.typography.body, fontWeight: "600" },
});
