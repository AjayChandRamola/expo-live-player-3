// components/VideoPlayer/hooks/useOnStateChange.ts
import { useEffect, useRef } from "react";
import type { PlaybackSnapshot } from "../engine/types";

export function useOnStateChange(snapshot: PlaybackSnapshot, onStateChange: (snapshot: PlaybackSnapshot) => void): void {
  const ref = useRef(onStateChange);
  ref.current = onStateChange;
  useEffect(() => {
    ref.current(snapshot);
  }, [snapshot]);
}
