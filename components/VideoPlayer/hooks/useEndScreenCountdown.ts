// components/VideoPlayer/hooks/useEndScreenCountdown.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { END_SCREEN_COUNTDOWN_MS } from "../constants";
import type { PlaybackStatus } from "../engine/types";

const ONE_SECOND_MS = 1000;

interface Input {
  readonly status: PlaybackStatus;
  readonly isLive: boolean;
  readonly hasNext: boolean;
  readonly enabled: boolean;
  readonly onFinished: () => void;
}

export function useEndScreenCountdown({ status, isLive, hasNext, enabled, onFinished }: Input): { secondsLeft: number | null; cancel(): void } {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    const active = status === "ended" && enabled && hasNext && !isLive;
    if (!active) {
      stop();
      return;
    }
    let remaining = END_SCREEN_COUNTDOWN_MS / ONE_SECOND_MS;
    setSecondsLeft(remaining);
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setSecondsLeft(remaining);
        return;
      }
      stop();
      onFinishedRef.current();
    }, ONE_SECOND_MS);
    return stop;
  }, [status, enabled, hasNext, isLive, stop]);

  return { secondsLeft, cancel: stop };
}
