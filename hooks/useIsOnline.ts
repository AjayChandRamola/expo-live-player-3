// hooks/useIsOnline.ts
/**
 * Derives an offline signal from actual request outcomes rather than link
 * state (no netinfo dependency — see the increment's plan for why). Feature
 * hooks report their own network failures and successes; this hook also
 * optimistically assumes online again whenever the app returns to the
 * foreground, since the next request will prove or disprove that quickly.
 *
 * The signal is module-level, shared by every caller: a video screen's
 * failed request and the OfflineBanner elsewhere in the tree must agree on
 * one online/offline state, not each hold their own.
 */
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export interface OnlineState {
  readonly isOnline: boolean;
  /** Feature hooks call this when a request fails with code "network". */
  reportNetworkFailure(): void;
  /** Called after any successful request. */
  reportSuccess(): void;
}

let isOnlineState = true;
const listeners = new Set<() => void>();

function setOnline(value: boolean): void {
  if (isOnlineState === value) return;
  isOnlineState = value;
  listeners.forEach((listener) => listener());
}

export function useIsOnline(): OnlineState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") setOnline(true);
    });
    return () => subscription?.remove();
  }, []);

  const reportNetworkFailure = useCallback(() => setOnline(false), []);
  const reportSuccess = useCallback(() => setOnline(true), []);

  return { isOnline: isOnlineState, reportNetworkFailure, reportSuccess };
}
