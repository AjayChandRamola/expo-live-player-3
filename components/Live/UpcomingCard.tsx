// components/Live/UpcomingCard.tsx
import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { getColors, tokens } from "../../constants/tokens";
import type { LiveSession } from "../../types/domain";

export interface UpcomingCardProps {
  readonly session: LiveSession;
  /** Injectable for deterministic tests. */
  readonly now?: Date;
  readonly testID?: string;
}

function formatCountdown(startsAt: string, now: Date): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "Starting soon";

  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return "Starting soon";

  const totalMinutes = Math.ceil(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
}

export function UpcomingCard({ session, now, testID }: UpcomingCardProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const countdown = formatCountdown(session.startsAt, now ?? new Date());

  return (
    <View testID={testID} style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>{session.title}</Text>
      <Text testID={`${testID}-countdown`} style={[styles.countdown, { color: colors.textMuted }]}>
        {countdown}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.xs,
  },
  title: { ...tokens.typography.title },
  countdown: { ...tokens.typography.body },
});
