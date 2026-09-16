// __tests__/player/fakes/fakeEngineHook.ts
// Replaces usePlaybackEngine in root tests. Call installFakeEngineHook() at module top,
// before importing Player, inside jest.mock's factory via the exported mock object.
import { act } from "@testing-library/react-native";
import type { EngineOptions, PlaybackCommands, PlaybackSnapshot } from "../../../components/VideoPlayer/engine/types";
import type { UsePlaybackEngineCallbacks } from "../../../components/VideoPlayer/engine/usePlaybackEngine";
import { loadingSnapshot } from "./snapshots";

export function fakeCommands(): PlaybackCommands {
  return {
    play: jest.fn(), pause: jest.fn(), togglePlay: jest.fn(), seekTo: jest.fn(), seekBy: jest.fn(), setRate: jest.fn(),
    setMuted: jest.fn(), setVolume: jest.fn(), selectQuality: jest.fn(), selectSubtitle: jest.fn(), goToLive: jest.fn(),
    retry: jest.fn(), replay: jest.fn(),
  };
}

export function createFakeEngineHook() {
  let snapshot: PlaybackSnapshot = loadingSnapshot();
  const listeners = new Set<() => void>();
  const commands = fakeCommands();
  const state = {
    lastOptions: null as EngineOptions | null,
    lastCallbacks: null as UsePlaybackEngineCallbacks | null,
    notifyPictureInPicture: jest.fn(),
    commands,
    setSnapshot(next: PlaybackSnapshot) {
      snapshot = next;
      act(() => listeners.forEach((l) => l()));
    },
  };
  // The mocked usePlaybackEngine: subscribes the component to snapshot changes.
  const usePlaybackEngine = (_source: unknown, options: EngineOptions, callbacks?: UsePlaybackEngineCallbacks) => {
    const React = require("react") as typeof import("react");
    const [, force] = React.useState(0);
    React.useEffect(() => {
      const l = () => force((n) => n + 1);
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    }, []);
    state.lastOptions = options;
    state.lastCallbacks = callbacks ?? null;
    return { snapshot, commands, player: {}, notifyPictureInPicture: state.notifyPictureInPicture };
  };
  return { state, usePlaybackEngine };
}
