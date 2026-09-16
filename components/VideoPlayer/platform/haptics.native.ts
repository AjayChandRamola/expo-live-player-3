// components/VideoPlayer/platform/haptics.native.ts
import * as Haptics from "expo-haptics";
import type { HapticsAdapter } from "./types";

export const hapticsAdapter: HapticsAdapter = {
  light() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
};
