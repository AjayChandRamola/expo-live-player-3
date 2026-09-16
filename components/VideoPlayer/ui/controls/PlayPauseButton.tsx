// components/VideoPlayer/ui/controls/PlayPauseButton.tsx
import React from "react";
import type { PlaybackCommands, PlaybackStatus } from "../../engine/types";
import { ControlButton, type ControlSize } from "./ControlButton";

interface Props {
  readonly status: PlaybackStatus;
  readonly commands: PlaybackCommands;
  readonly size?: ControlSize;
  readonly testID?: string;
}

export function PlayPauseButton({ status, commands, size = "lg", testID }: Props) {
  switch (status) {
    case "playing":
      return <ControlButton icon="pause" accessibilityLabel="Pause" onPress={commands.togglePlay} size={size} testID={testID} />;
    case "paused":
    case "ready":
      return <ControlButton icon="play" accessibilityLabel="Play" onPress={commands.togglePlay} size={size} testID={testID} />;
    case "ended":
      return <ControlButton icon="replay" accessibilityLabel="Replay" onPress={commands.replay} size={size} testID={testID} />;
    default:
      return null;
  }
}
