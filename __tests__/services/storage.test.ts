// __tests__/services/storage.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSaved, writeSaved } from "../../services/storage/savedStorage";
import {
  readSettings,
  writeSettings,
  readRecentSearches,
  writeRecentSearches,
} from "../../services/storage/settingsStorage";
import { STORAGE_KEYS, LIMITS } from "../../constants/config";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("savedStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("returns an empty state when nothing is stored", async () => {
    await expect(readSaved()).resolves.toEqual({ savedIds: [], likedIds: [] });
  });

  it("round-trips a saved state", async () => {
    await writeSaved({ savedIds: ["a", "b"], likedIds: ["b"] });
    await expect(readSaved()).resolves.toEqual({ savedIds: ["a", "b"], likedIds: ["b"] });
  });

  it("writes under the versioned key", async () => {
    await writeSaved({ savedIds: ["a"], likedIds: [] });
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.saved);
    expect(raw).toBeTruthy();
  });

  it("resets to empty when the payload is not valid JSON", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.saved, "{not json");
    await expect(readSaved()).resolves.toEqual({ savedIds: [], likedIds: [] });
  });

  it("resets to empty when the payload has the wrong shape", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.saved, JSON.stringify({ savedIds: "nope" }));
    await expect(readSaved()).resolves.toEqual({ savedIds: [], likedIds: [] });
  });

  it("drops non-string entries from a partially corrupt array", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.saved,
      JSON.stringify({ savedIds: ["a", 5, null, "b"], likedIds: [] }),
    );
    const result = await readSaved();
    expect(result.savedIds).toEqual(["a", "b"]);
  });

  it("rejects with a storage AppError when the device write fails", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await expect(writeSaved({ savedIds: [], likedIds: [] })).rejects.toMatchObject({
      code: "storage",
    });
  });
});

describe("settingsStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("defaults to system theme with autoplay on", async () => {
    await expect(readSettings()).resolves.toEqual({ theme: "system", autoplayDefault: true });
  });

  it("round-trips settings", async () => {
    await writeSettings({ theme: "dark", autoplayDefault: false });
    await expect(readSettings()).resolves.toEqual({ theme: "dark", autoplayDefault: false });
  });

  it("falls back to defaults when the stored theme is not a known value", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ theme: "neon", autoplayDefault: true }),
    );
    await expect(readSettings()).resolves.toEqual({ theme: "system", autoplayDefault: true });
  });

  it("round-trips recent searches", async () => {
    await writeRecentSearches(["yagna", "gayatri"]);
    await expect(readRecentSearches()).resolves.toEqual(["yagna", "gayatri"]);
  });

  it("caps recent searches at the configured maximum", async () => {
    const many = Array.from({ length: LIMITS.recentSearchesMax + 10 }, (_, i) => `q${i}`);
    await writeRecentSearches(many);
    const stored = await readRecentSearches();
    expect(stored).toHaveLength(LIMITS.recentSearchesMax);
    expect(stored[0]).toBe("q0");
  });

  it("returns an empty list when recent searches are corrupt", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.recentSearches, "[[[");
    await expect(readRecentSearches()).resolves.toEqual([]);
  });
});
