// contexts/SettingsContext.tsx
/**
 * Single source of truth for the theme and autoplay preferences. Hydrates
 * from device storage on mount and writes back on every change. The root
 * layout reads theme app-wide; PlayQueueProvider is seeded from
 * autoplayDefault once hydrated.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Logger from "../utils/Logger";
import {
  readSettings,
  writeSettings,
  type Settings,
  type ThemePreference,
} from "../services/storage/settingsStorage";

export interface SettingsValue {
  readonly theme: ThemePreference;
  readonly autoplayDefault: boolean;
  readonly hydrated: boolean;
  setTheme(theme: ThemePreference): void;
  setAutoplayDefault(enabled: boolean): void;
}

const DEFAULTS: Settings = { theme: "system", autoplayDefault: true };

const SettingsContext = createContext<SettingsValue | undefined>(undefined);

export interface SettingsProviderProps {
  readonly children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [state, setState] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  const mountedRef = useRef(true);
  const hydratedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    readSettings()
      .then((result) => {
        if (!mountedRef.current) return;
        setState(result);
      })
      .catch((cause) => {
        Logger.error("[SettingsContext] Failed to read settings", cause);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        hydratedRef.current = true;
        setHydrated(true);
      });
  }, []);

  const persist = useCallback((next: Settings) => {
    if (!hydratedRef.current) return;
    writeSettings(next).catch((cause) => {
      Logger.error("[SettingsContext] Failed to write settings", cause);
    });
  }, []);

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      setState((prev) => {
        const next = { ...prev, theme };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setAutoplayDefault = useCallback(
    (enabled: boolean) => {
      setState((prev) => {
        const next = { ...prev, autoplayDefault: enabled };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const value = useMemo<SettingsValue>(
    () => ({
      theme: state.theme,
      autoplayDefault: state.autoplayDefault,
      hydrated,
      setTheme,
      setAutoplayDefault,
    }),
    [state.theme, state.autoplayDefault, hydrated, setTheme, setAutoplayDefault],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
