// components/VideoPlayer/ui/controls/MinimizeButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

export function MinimizeButton({ onPress, testID }: { readonly onPress: () => void; readonly testID?: string }) {
  return <ControlButton icon="arrow-collapse" accessibilityLabel="Minimize player" onPress={onPress} size="sm" testID={testID} />;
}
