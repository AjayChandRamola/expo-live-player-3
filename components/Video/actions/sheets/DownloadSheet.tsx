// components/Video/actions/sheets/DownloadSheet.tsx
// Real MP4 downloads (ADR 0008). States: docs/player/02-feature-catalog.md F33
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens, getColors } from "../../../../constants/tokens";
import { toAppError } from "../../../../services/appError";
import type { DownloadRecord } from "../../../../services/storage/downloadsStorage";
import type { AppError } from "../../../../types/result";
import { useVideoActionsDeps } from "../VideoActionsProvider";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly video: { readonly id: string; readonly url: string; readonly kind: "mp4" | "hls"; readonly title: string };
  readonly testID?: string;
}

const PERCENT = 100;
const colors = getColors("dark");

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.button}>
      <Text style={styles.buttonText}>{label.replace(/ download$/, "")}</Text>
    </Pressable>
  );
}

export function DownloadSheet({ visible, onClose, video, testID }: Props) {
  const { downloads } = useVideoActionsDeps();
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let alive = true;
    downloads.get(video.id).then((r) => alive && setRecord(r));
    const unsubscribe = downloads.subscribe((records) => setRecord(records.find((r) => r.videoId === video.id) ?? null));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [downloads, video.id]);

  const run = useCallback(
    (fn: () => Promise<void>) => {
      setError(null);
      fn().catch((cause) => setError(toAppError(cause)));
    },
    [],
  );

  if (!visible || video.kind !== "mp4") return null;

  const start = () => run(() => downloads.start({ id: video.id, url: video.url, kind: video.kind }));
  const status = record?.status ?? "none";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>{video.title}</Text>
        {status === "none" ? <Button label="Download" onPress={start} /> : null}
        {status === "queued" ? <Text style={styles.text}>Waiting…</Text> : null}
        {status === "downloading" && record ? (
          <>
            <Text style={styles.text}>{`${Math.round(record.progress * PERCENT)}%`}</Text>
            <Button label="Pause download" onPress={() => run(() => downloads.pause(video.id))} />
            <Button label="Cancel download" onPress={() => run(() => downloads.cancel(video.id))} />
          </>
        ) : null}
        {status === "paused" ? (
          <>
            <Button label="Resume download" onPress={() => run(() => downloads.resume(video.id))} />
            <Button label="Cancel download" onPress={() => run(() => downloads.cancel(video.id))} />
          </>
        ) : null}
        {status === "completed" ? (
          <>
            <Text style={styles.text}>Downloaded</Text>
            <Button label="Delete download" onPress={() => run(() => downloads.remove(video.id))} />
          </>
        ) : null}
        {status === "failed" ? (
          <>
            <Text style={styles.text}>Download failed.</Text>
            <Button label="Retry download" onPress={start} />
            <Button label="Delete download" onPress={() => run(() => downloads.cancel(video.id))} />
          </>
        ) : null}
        {error ? <Text style={styles.error}>{error.message}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, padding: tokens.spacing.xl, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg },
  title: { ...tokens.typography.heading, color: colors.text, marginBottom: tokens.spacing.md },
  text: { ...tokens.typography.body, color: colors.text, marginVertical: tokens.spacing.sm },
  error: { ...tokens.typography.body, color: colors.danger, marginTop: tokens.spacing.sm },
  button: { minHeight: tokens.touchTarget.min, justifyContent: "center", paddingHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.sm, borderRadius: tokens.radius.pill, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: "600" },
});
