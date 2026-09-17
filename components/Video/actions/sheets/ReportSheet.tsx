import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LIMITS, REPORT_REASONS, type ReportReason } from "../../../../constants/config";
import { getColors, tokens } from "../../../../constants/tokens";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (reason: ReportReason, details?: string) => void;
  readonly testID?: string;
}

const LABELS: Readonly<Record<ReportReason, string>> = { inappropriate: "Inappropriate", spam: "Spam", misleading: "Misleading", other: "Other" };
const colors = getColors("dark");

export function ReportSheet({ visible, onClose, onSubmit, testID }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Report video</Text>
        {REPORT_REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} accessibilityLabel={LABELS[r]} style={styles.row}>
            <Text style={styles.text}>{LABELS[r]}</Text>
          </Pressable>
        ))}
        <TextInput value={details} onChangeText={setDetails} maxLength={LIMITS.reportDetailsMaxLength} placeholder="Details (optional)" accessibilityLabel="Details" style={styles.input} />
        <Pressable
          disabled={reason === null}
          onPress={() => reason && onSubmit(reason, details.trim() || undefined)}
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          accessibilityState={{ disabled: reason === null }}
          style={[styles.button, reason === null && styles.disabled]}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, padding: tokens.spacing.xl, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg },
  title: { ...tokens.typography.heading, color: colors.text, marginBottom: tokens.spacing.md },
  row: { minHeight: tokens.touchTarget.min, justifyContent: "center" },
  text: { ...tokens.typography.body, color: colors.text },
  input: { marginTop: tokens.spacing.md, padding: tokens.spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: tokens.radius.sm, color: colors.text },
  button: { marginTop: tokens.spacing.lg, minHeight: tokens.touchTarget.min, justifyContent: "center", alignItems: "center", borderRadius: tokens.radius.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: "600" },
});
