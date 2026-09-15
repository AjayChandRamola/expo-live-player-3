// services/storage/settingsStorage.ts
import { LIMITS, STORAGE_KEYS } from "../../constants/config";
import { readJson, writeJson } from "./asyncStorageAdapter";

export type ThemePreference = "system" | "light" | "dark";

export interface Settings {
  readonly theme: ThemePreference;
  readonly autoplayDefault: boolean;
}

const DEFAULTS: Settings = { theme: "system", autoplayDefault: true };
const THEMES: readonly ThemePreference[] = ["system", "light", "dark"];

function isSettings(value: unknown): value is Settings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Settings>;
  return (
    typeof candidate.theme === "string" &&
    THEMES.includes(candidate.theme) &&
    typeof candidate.autoplayDefault === "boolean"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export async function readSettings(): Promise<Settings> {
  return readJson(STORAGE_KEYS.settings, isSettings, DEFAULTS);
}

export async function writeSettings(settings: Settings): Promise<void> {
  await writeJson(STORAGE_KEYS.settings, settings);
}

export async function readRecentSearches(): Promise<string[]> {
  return readJson(STORAGE_KEYS.recentSearches, isStringArray, []);
}

export async function writeRecentSearches(queries: readonly string[]): Promise<void> {
  // Bounded so the key cannot grow without limit.
  await writeJson(STORAGE_KEYS.recentSearches, queries.slice(0, LIMITS.recentSearchesMax));
}
