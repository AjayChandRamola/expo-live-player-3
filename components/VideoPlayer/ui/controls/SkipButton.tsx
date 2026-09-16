// components/VideoPlayer/ui/controls/SkipButton.tsx
import React from "react";
import { ControlButton, type ControlSize } from "./ControlButton";

interface Props {
  readonly direction: "previous" | "next";
  readonly enabled: boolean;
  readonly onPress: () => void;
  readonly size?: ControlSize;
  readonly testID?: string;
}

export function SkipButton({ direction, enabled, onPress, size = "md", testID }: Props) {
  const isPrevious = direction === "previous";
  return (
    <ControlButton
      icon={isPrevious ? "skip-previous" : "skip-next"}
      accessibilityLabel={isPrevious ? "Previous video" : "Next video"}
      onPress={onPress}
      disabled={!enabled}
      size={size}
      testID={testID}
    />
  );
}
