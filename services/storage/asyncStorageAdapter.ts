// services/storage/asyncStorageAdapter.ts
/**
 * The only module in the app that imports AsyncStorage.
 *
 * Every read is guarded: bad JSON or an unexpected shape resolves to the
 * caller's fallback and logs, rather than throwing into a render.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logger from "../../utils/Logger";
import { makeError } from "../appError";

export async function readJson<T>(
  key: string,
  guard: (value: unknown) => value is T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!guard(parsed)) {
      Logger.warn("[Storage]", `Discarding malformed payload for ${key}`);
      return fallback;
    }
    return parsed;
  } catch (cause) {
    Logger.warn("[Storage]", `Read failed for ${key}`, cause);
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (cause) {
    Logger.error("[Storage]", `Write failed for ${key}`, cause);
    throw makeError("storage", cause);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (cause) {
    Logger.error("[Storage]", `Remove failed for ${key}`, cause);
    throw makeError("storage", cause);
  }
}
