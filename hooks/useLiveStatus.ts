// hooks/useLiveStatus.ts
/**
 * Polls getLiveStatus on a bounded lifecycle: only while enabled and the app
 * is foregrounded, one request in flight at a time, exponential backoff on
 * failure, and everything cleared on unmount so nothing keeps running after
 * the screen using it goes away.
 */
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { TIMING } from "../constants/config";
import { getLiveStatus } from "../services/liveService";
import { toAppError } from "../services/appError";
import type { AppError, Loadable, LoadStatus } from "../types/result";
import type { LiveStatus } from "../types/domain";

export interface UseLiveStatusOptions {
  /** Poll only while the screen using this hook is focused. */
  readonly enabled: boolean;
}

export function useLiveStatus(options?: UseLiveStatusOptions): Loadable<LiveStatus> {
  const enabled = options?.enabled ?? true;

  const [status, setStatus] = useState<LoadStatus>("idle");
  const [data, setData] = useState<LiveStatus | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const failureCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<string>("active");
  const hasDataRef = useRef(false);
  const [nonce, setNonce] = useState(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setStatus("idle");
      return;
    }

    failureCountRef.current = 0;
    const isForegrounded = () => appStateRef.current === "active";

    const scheduleNext = (delayMs: number) => {
      clearTimer();
      if (!enabled || !isForegrounded()) return;
      timerRef.current = setTimeout(() => {
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      if (inFlightRef.current || !isForegrounded()) return;
      inFlightRef.current = true;
      if (!hasDataRef.current) setStatus("loading");

      try {
        const result = await getLiveStatus();
        if (!mountedRef.current) return;
        failureCountRef.current = 0;
        hasDataRef.current = true;
        setData(result);
        setError(null);
        setStatus("success");
        scheduleNext(TIMING.liveStatusPollMs);
      } catch (cause) {
        if (!mountedRef.current) return;
        failureCountRef.current += 1;
        setError(toAppError(cause));
        setStatus("error");
        const backoff = Math.min(
          TIMING.liveStatusPollMs * 2 ** (failureCountRef.current + 1),
          TIMING.liveStatusBackoffMaxMs,
        );
        scheduleNext(backoff);
      } finally {
        inFlightRef.current = false;
      }
    };

    void poll();

    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") {
        void poll();
      } else {
        clearTimer();
      }
    });

    return () => {
      clearTimer();
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce]);

  const retry = () => setNonce((n) => n + 1);

  return { status, data, error, retry };
}
