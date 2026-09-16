// components/VideoPlayer/ui/controls/SettingsButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

export function SettingsButton({ onPress, testID }: { readonly onPress: () => void; readonly testID?: string }) {
  return <ControlButton icon="cog-outline" accessibilityLabel="Settings" onPress={onPress} size="sm" testID={testID} />;
}
