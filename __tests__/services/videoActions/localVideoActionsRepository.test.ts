import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLocalVideoActionsRepository } from "../../../services/videoActions/localVideoActionsRepository";
import { STORAGE_KEYS } from "../../../constants/config";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const repo = () => createLocalVideoActionsRepository({ now: () => "2026-09-16T00:00:00.000Z", writeDelayMs: 0 });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("localVideoActionsRepository", () => {
  it("returns defaults for an unknown video with counts null", async () => {
    const state = await repo().getState("v1");
    expect(state).toEqual({ videoId: "v1", liked: false, disliked: false, reported: false, notInterested: false, counts: null, updatedAt: "2026-09-16T00:00:00.000Z" });
  });

  it("like and dislike are mutually exclusive and persist across instances", async () => {
    const a = repo();
    await a.setLike("v1", true);
    expect((await a.setDislike("v1", true))).toMatchObject({ liked: false, disliked: true });
    await a.flush();
    const b = repo();
    expect(await b.getState("v1")).toMatchObject({ liked: false, disliked: true });
  });

  it("idempotent: setting the same value performs no write", async () => {
    const a = repo();
    await a.setLike("v1", true);
    await a.flush();
    // AsyncStorage's jest mock is already a jest.fn(); spyOn wraps the same
    // instance and inherits its existing call history, so it must be cleared
    // here to only observe calls made by the assertion below.
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    setItem.mockClear();
    await a.setLike("v1", true);
    await a.flush();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("report is idempotent and validates details length", async () => {
    const a = repo();
    expect((await a.report("v1", "spam")).reported).toBe(true);
    expect((await a.report("v1", "other", "again")).reported).toBe(true);
    await expect(a.report("v2", "other", "x".repeat(501))).rejects.toMatchObject({ code: "validation" });
  });

  it("hidden channels round-trip", async () => {
    const a = repo();
    await a.setChannelHidden("c1", true);
    expect(await a.isChannelHidden("c1")).toBe(true);
    await a.setChannelHidden("c1", false);
    expect(await a.isChannelHidden("c1")).toBe(false);
  });

  it("clips validate bounds and list per video", async () => {
    const a = repo();
    const clip = await a.createClip("v1", 1_000, 5_000);
    expect(clip).toMatchObject({ videoId: "v1", startMs: 1_000, endMs: 5_000 });
    expect(await a.listClips("v1")).toHaveLength(1);
    await expect(a.createClip("v1", 5_000, 5_500)).rejects.toMatchObject({ code: "validation" }); // < clipMinMs
    await expect(a.createClip("v1", 0, 61_000)).rejects.toMatchObject({ code: "validation" }); // > clipMaxMs
  });

  it("corrupt payload resets to empty", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.videoActions, "{not json");
    expect((await repo().getState("v1")).liked).toBe(false);
    await AsyncStorage.setItem(STORAGE_KEYS.videoActions, JSON.stringify({ version: 99 }));
    expect((await repo().getState("v1")).liked).toBe(false);
  });
});
