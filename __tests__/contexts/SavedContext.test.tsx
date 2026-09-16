// __tests__/contexts/SavedContext.test.tsx
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { SavedProvider, useSaved } from "../../contexts/SavedContext";
import * as savedStorage from "../../services/storage/savedStorage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../services/storage/savedStorage");
const storage = savedStorage as jest.Mocked<typeof savedStorage>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SavedProvider>{children}</SavedProvider>
);

async function mounted() {
  storage.readSaved.mockResolvedValue({ savedIds: [], likedIds: [] });
  const hook = renderHook(() => useSaved(), { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe("SavedContext", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    storage.writeSaved.mockResolvedValue(undefined);
  });

  it("hydrates from storage on mount", async () => {
    storage.readSaved.mockResolvedValue({ savedIds: ["a", "b"], likedIds: ["a"] });
    const { result } = renderHook(() => useSaved(), { wrapper });

    expect(result.current.hydrated).toBe(false);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.savedIds).toEqual(["a", "b"]);
    expect(result.current.isLiked("a")).toBe(true);
  });

  it("starts empty when storage read fails", async () => {
    storage.readSaved.mockRejectedValue(new Error("disk"));
    const { result } = renderHook(() => useSaved(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.savedIds).toEqual([]);
  });

  it("saves an id to the front of the list", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleSave("a"));
    act(() => result.current.toggleSave("b"));
    expect(result.current.savedIds).toEqual(["b", "a"]);
  });

  it("unsaves an id", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleSave("a"));
    expect(result.current.isSaved("a")).toBe(true);
    act(() => result.current.toggleSave("a"));
    expect(result.current.isSaved("a")).toBe(false);
  });

  it("moves an already-saved id to the front instead of duplicating it", async () => {
    const { result } = await mounted();
    act(() => {
      result.current.toggleSave("a");
      result.current.toggleSave("b");
    });
    act(() => result.current.toggleSave("a")); // unsave
    act(() => result.current.toggleSave("a")); // save again
    expect(result.current.savedIds).toEqual(["a", "b"]);
    expect(result.current.savedIds.filter((id) => id === "a")).toHaveLength(1);
  });

  it("toggles likes independently of saves", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleLike("a"));
    expect(result.current.isLiked("a")).toBe(true);
    expect(result.current.isSaved("a")).toBe(false);
  });

  it("persists changes to storage", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleSave("a"));
    await waitFor(() =>
      expect(storage.writeSaved).toHaveBeenCalledWith(
        expect.objectContaining({ savedIds: ["a"] }),
      ),
    );
  });

  it("does not write during hydration", async () => {
    storage.readSaved.mockResolvedValue({ savedIds: ["a"], likedIds: [] });
    const { result } = renderHook(() => useSaved(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(storage.writeSaved).not.toHaveBeenCalled();
  });

  it("keeps working when a write fails", async () => {
    const { result } = await mounted();
    storage.writeSaved.mockRejectedValue(new Error("disk full"));
    act(() => result.current.toggleSave("a"));
    await waitFor(() => expect(storage.writeSaved).toHaveBeenCalled());
    expect(result.current.isSaved("a")).toBe(true);
  });

  it("reports false for everything before hydration finishes", () => {
    storage.readSaved.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSaved(), { wrapper });
    expect(result.current.hydrated).toBe(false);
    expect(result.current.isSaved("a")).toBe(false);
  });

  it("throws a clear error outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSaved())).toThrow(/SavedProvider/);
    spy.mockRestore();
  });
});
