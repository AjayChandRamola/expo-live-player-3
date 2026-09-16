// components/VideoPlayer/hooks/useToast.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { TOAST_MS } from "../constants";

export interface ToastState {
  readonly message: string | null;
  show(text: string): void;
}

export function useToast(): ToastState {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (text: string) => {
      clear();
      setMessage(text);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setMessage(null);
      }, TOAST_MS);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);
  return { message, show };
}
