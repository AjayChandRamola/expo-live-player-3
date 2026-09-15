// services/storage/savedStorage.ts
import { STORAGE_KEYS } from "../../constants/config";
import { readJson, writeJson } from "./asyncStorageAdapter";

export interface SavedState {
  readonly savedIds: string[];
  readonly likedIds: string[];
}

const EMPTY: SavedState = { savedIds: [], likedIds: [] };

function onlyStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function isSavedShape(value: unknown): value is { savedIds: unknown; likedIds: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { savedIds?: unknown }).savedIds)
  );
}

export async function readSaved(): Promise<SavedState> {
  const raw = await readJson(STORAGE_KEYS.saved, isSavedShape, EMPTY as unknown as {
    savedIds: unknown;
    likedIds: unknown;
  });
  return {
    savedIds: onlyStrings(raw.savedIds),
    likedIds: onlyStrings(raw.likedIds),
  };
}

export async function writeSaved(state: SavedState): Promise<void> {
  await writeJson(STORAGE_KEYS.saved, {
    savedIds: onlyStrings(state.savedIds),
    likedIds: onlyStrings(state.likedIds),
  });
}
