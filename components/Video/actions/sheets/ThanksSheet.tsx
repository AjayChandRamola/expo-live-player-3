// components/Video/actions/sheets/ThanksSheet.tsx
// Built against PaymentProvider (ADR 0009). With the unavailable provider it shows "coming soon".
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getColors, tokens } from "../../../../constants/tokens";
import { track } from "../../../../services/analytics";
import { toAppError } from "../../../../services/appError";
import type { PaymentResult, ThanksPreset } from "../../../../services/videoActions/PaymentProvider";
import type { AppError } from "../../../../types/result";
import { useVideoActionsDeps } from "../VideoActionsProvider";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly videoId: string;
  readonly testID?: string;
}

type Phase = { kind: "choose" } | { kind: "processing" } | { kind: "done"; result: PaymentResult } | { kind: "error"; error: AppError };
const colors = getColors("dark");

export function ThanksSheet({ visible, onClose, videoId, testID }: Props) {
  const { payments } = useVideoActionsDeps();
  const [presets, setPresets] = useState<readonly ThanksPreset[]>([]);
  const [selected, setSelected] = useState<ThanksPreset | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });

  useEffect(() => {
    if (!visible) return;
    track("thanks_open", { videoId });
    let alive = true;
    payments.getPresets().then((p) => alive && setPresets(p));
    return () => {
      alive = false;
    };
  }, [payments, videoId, visible]);

  if (!visible) return null;

  const confirm = async () => {
    if (!selected) return;
    setPhase({ kind: "processing" });
    try {
      const intent = await payments.createIntent(videoId, selected.amountMinor, selected.currency);
      setPhase({ kind: "done", result: await payments.confirm(intent.id) });
    } catch (cause) {
      setPhase({ kind: "error", error: toAppError(cause) });
    }
  };

  const canConfirm = payments.isAvailable && selected !== null && phase.kind === "choose";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Say thanks</Text>
        {!payments.isAvailable ? <Text style={styles.banner}>Thanks is coming soon.</Text> : null}
        <View style={styles.grid}>
          {presets.map((p) => (
            <Pressable key={p.amountMinor} onPress={() => setSelected(p)} accessibilityRole="radio" accessibilityLabel={p.label} accessibilityState={{ checked: selected?.amountMinor === p.amountMinor }} style={[styles.chip, selected?.amountMinor === p.amountMinor && styles.chipSelected]}>
              <Text style={styles.text}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        {phase.kind === "done" ? <Text style={styles.text}>{phase.result.status === "succeeded" ? "Thank you!" : phase.result.status === "cancelled" ? "Cancelled." : "Payment failed."}</Text> : null}
        {phase.kind === "error" ? <Text style={styles.error}>{phase.error.message}</Text> : null}
        <Pressable disabled={!canConfirm} onPress={confirm} accessibilityRole="button" accessibilityLabel="Confirm thanks" accessibilityState={{ disabled: !canConfirm }} style={[styles.button, !canConfirm && styles.disabled]}>
          <Text style={styles.buttonText}>{phase.kind === "processing" ? "Processing…" : "Confirm"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, padding: tokens.spacing.xl, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg },
  title: { ...tokens.typography.heading, color: colors.text, marginBottom: tokens.spacing.md },
  banner: { ...tokens.typography.body, color: colors.textMuted, marginBottom: tokens.spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  chip: { minHeight: tokens.touchTarget.min, justifyContent: "center", paddingHorizontal: tokens.spacing.lg, marginRight: tokens.spacing.sm, marginBottom: tokens.spacing.sm, borderRadius: tokens.radius.pill, backgroundColor: colors.surfaceElevated },
  chipSelected: { backgroundColor: colors.primary },
  text: { ...tokens.typography.body, color: colors.text },
  error: { ...tokens.typography.body, color: colors.danger, marginTop: tokens.spacing.sm },
  button: { marginTop: tokens.spacing.lg, minHeight: tokens.touchTarget.min, justifyContent: "center", alignItems: "center", borderRadius: tokens.radius.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: "600" },
});
