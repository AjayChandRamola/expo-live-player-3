// components/VideoPlayer/ui/controls/PipButton.tsx
import React from "react";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly supported: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function PipButton({ supported, onPress, testID }: Props) {
  if (!supported) return null;
  return <ControlButton icon="picture-in-picture-bottom-right" accessibilityLabel="Picture in picture" onPress={onPress} size="sm" testID={testID} />;
}
