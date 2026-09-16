// components/VideoPlayer/ui/controls/FullscreenButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
  readonly testID?: string;
}

export function FullscreenButton({ isFullscreen, onToggle, testID }: Props) {
  return (
    <ControlButton
      icon={isFullscreen ? "fullscreen-exit" : "fullscreen"}
      accessibilityLabel={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      onPress={onToggle}
      size="sm"
      testID={testID}
    />
  );
}
