// components/VideoPlayer/ui/controls/MuteButton.tsx
import React, { useCallback } from "react";
import type { PlaybackCommands } from "../../engine/types";
import { ControlButton } from "./ControlButton";

interface Props {
  readonly muted: boolean;
  readonly commands: PlaybackCommands;
  readonly testID?: string;
}

export function MuteButton({ muted, commands, testID }: Props) {
  const onPress = useCallback(() => commands.setMuted(!muted), [commands, muted]);
  return (
    <ControlButton
      icon={muted ? "volume-off" : "volume-high"}
      accessibilityLabel={muted ? "Unmute" : "Mute"}
      onPress={onPress}
      size="sm"
      testID={testID}
    />
  );
}
