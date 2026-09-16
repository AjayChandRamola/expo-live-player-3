// components/VideoPlayer/ui/controls/AutoplayToggle.tsx
import React, { useCallback } from "react";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly enabled: boolean;
  readonly hasNext: boolean;
  readonly onToggle: (enabled: boolean) => void;
  readonly testID?: string;
}

export function AutoplayToggle({ enabled, hasNext, onToggle, testID }: Props) {
  const onPress = useCallback(() => onToggle(!enabled), [enabled, onToggle]);
  return (
    <ControlButton
      icon="play-circle-outline"
      accessibilityLabel={enabled ? "Autoplay on" : "Autoplay off"}
      onPress={onPress}
      active={enabled}
      disabled={!hasNext}
      size="sm"
      testID={testID}
    />
  );
}
