// components/ui/StateView.tsx
/**
 * Renders loading, empty, error, and offline from one status prop, so every
 * screen presents the same states the same way. idle and success render
 * nothing — the caller renders its own content for those.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import type { AppError, LoadStatus } from "../../types/result";

export interface StateViewProps {
  readonly status: LoadStatus;
  readonly error?: AppError | null;
  readonly onRetry?: () => void;
  readonly emptyTitle?: string;
  readonly emptyHint?: string;
  readonly loadingSkeleton?: React.ReactNode;
  readonly testID?: string;
}

export function StateView({
  status,
  error,
  onRetry,
  emptyTitle,
  emptyHint,
  loadingSkeleton,
  testID,
}: StateViewProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  if (status === "idle" || status === "success") return null;

  if (status === "loading") {
    return (
      <View testID={`${testID}-loading`} style={styles.center}>
        {loadingSkeleton ?? <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  if (status === "empty") {
    return (
      <View testID={testID} style={styles.center}>
        {emptyTitle ? <Text style={[styles.title, { color: colors.text }]}>{emptyTitle}</Text> : null}
        {emptyHint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{emptyHint}</Text> : null}
      </View>
    );
  }

  // error or offline
  return (
    <View testID={testID} style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>{error?.message}</Text>
      {onRetry ? (
        <Pressable
          testID={`${testID}-retry`}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={[styles.retry, { borderColor: colors.primary }]}
        >
          <Text style={{ color: colors.primary }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  title: { ...tokens.typography.body, textAlign: "center" },
  hint: { ...tokens.typography.caption, textAlign: "center" },
  retry: {
    marginTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    minHeight: tokens.touchTarget.min,
    justifyContent: "center",
  },
});
