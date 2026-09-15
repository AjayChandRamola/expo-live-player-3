// hooks/useLoadable.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppError, Loadable, LoadStatus } from "../types/result";
import { toAppError } from "../services/appError";
import { useIsOnline } from "./useIsOnline";

interface UseLoadableOptions<T> {
  /** Must be stable (wrap in useCallback in the caller). */
  readonly load: () => Promise<T>;
  /** Called to decide whether a successful result counts as empty. */
  readonly isEmpty?: (data: T) => boolean;
  /** When false, the hook stays idle and does not call load. */
  readonly enabled?: boolean;
}

export function useLoadable<T>({
  load,
  isEmpty,
  enabled = true,
}: UseLoadableOptions<T>): Loadable<T> {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  /** Incremented per request; only the newest may commit state. */
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [nonce, setNonce] = useState(0);
  const { reportNetworkFailure, reportSuccess } = useIsOnline();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const id = ++requestIdRef.current;
    setStatus("loading");
    setError(null);

    load()
      .then((result) => {
        reportSuccess();
        if (!mountedRef.current || id !== requestIdRef.current) return;
        setData(result);
        setStatus(isEmpty?.(result) ? "empty" : "success");
      })
      .catch((caught: unknown) => {
        const appError = toAppError(caught);
        if (appError.code === "network") reportNetworkFailure();
        if (!mountedRef.current || id !== requestIdRef.current) return;
        setError(appError);
        setStatus(appError.code === "network" ? "offline" : "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, isEmpty, enabled, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { status, data, error, retry };
}
