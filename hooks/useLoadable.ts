// hooks/useLoadable.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppError, Loadable, LoadStatus } from "../types/result";
import { toAppError } from "../services/appError";

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
        if (!mountedRef.current || id !== requestIdRef.current) return;
        setData(result);
        setStatus(isEmpty?.(result) ? "empty" : "success");
      })
      .catch((caught: unknown) => {
        if (!mountedRef.current || id !== requestIdRef.current) return;
        const appError = toAppError(caught);
        setError(appError);
        setStatus(appError.code === "network" ? "offline" : "error");
      });
  }, [load, isEmpty, enabled, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { status, data, error, retry };
}
