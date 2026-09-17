import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";

// VideoActionsProvider eagerly imports the real localVideoActionsRepository/
// downloadService singletons at module scope (for its default deps), which
// pull in the native AsyncStorage module even though this test overrides
// deps with a fake repository. Mock it so the module can load under Jest.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { VideoActionsProvider } from "../../../components/Video/actions/VideoActionsProvider";
import { useVideoActions } from "../../../components/Video/actions/useVideoActions";
import type { VideoActionState, VideoActionsRepository } from "../../../services/videoActions/VideoActionsRepository";
import { makeError } from "../../../services/appError";

function stateOf(videoId: string, o: Partial<VideoActionState> = {}): VideoActionState {
  return { videoId, liked: false, disliked: false, reported: false, notInterested: false, counts: null, updatedAt: "t", ...o };
}

function fakeRepo(): VideoActionsRepository & { resolveLike: (s: VideoActionState) => void; rejectLike: () => void } {
  let pending: { resolve: (s: VideoActionState) => void; reject: (e: unknown) => void } | null = null;
  return {
    getState: jest.fn(async (id: string) => stateOf(id)),
    setLike: jest.fn(() => new Promise<VideoActionState>((resolve, reject) => { pending = { resolve, reject }; })),
    setDislike: jest.fn(async (id: string, v: boolean) => stateOf(id, { disliked: v })),
    report: jest.fn(async (id: string) => stateOf(id, { reported: true })),
    setNotInterested: jest.fn(async (id: string, v: boolean) => stateOf(id, { notInterested: v })),
    setChannelHidden: jest.fn(async () => undefined),
    isChannelHidden: jest.fn(async () => false),
    createClip: jest.fn(async (videoId: string, startMs: number, endMs: number) => ({ id: "c1", videoId, startMs, endMs, createdAt: "t" })),
    listClips: jest.fn(async () => []),
    resolveLike: (s) => pending?.resolve(s),
    rejectLike: () => pending?.reject(makeError("storage")),
  };
}

function wrapper(repository: VideoActionsRepository) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <VideoActionsProvider deps={{ repository }}>{children}</VideoActionsProvider>;
  }
  return Wrapper;
}

describe("useVideoActions", () => {
  it("loads state on mount", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.state?.videoId).toBe("v1");
  });

  it("like is optimistic, guarded while in flight, and confirmed by the response", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.like());
    expect(result.current.state?.liked).toBe(true);
    expect(result.current.pending.has("like")).toBe(true);
    act(() => result.current.like()); // ignored while pending
    expect(repo.setLike).toHaveBeenCalledTimes(1);
    await act(async () => repo.resolveLike(stateOf("v1", { liked: true })));
    expect(result.current.pending.has("like")).toBe(false);
    expect(result.current.state?.liked).toBe(true);
  });

  it("rollback on failure with an AppError", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.like());
    await act(async () => repo.rejectLike());
    expect(result.current.state?.liked).toBe(false);
    expect(result.current.error?.code).toBe("storage");
  });

  it("dislike clears like optimistically", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.like());
    await act(async () => repo.resolveLike(stateOf("v1", { liked: true })));
    await act(async () => result.current.dislike());
    expect(result.current.state).toMatchObject({ liked: false, disliked: true });
  });

  it("stale load response for a previous videoId is ignored", async () => {
    const repo = fakeRepo();
    let resolveFirst: ((s: VideoActionState) => void) | null = null;
    (repo.getState as jest.Mock).mockImplementationOnce(() => new Promise<VideoActionState>((r) => { resolveFirst = r; }));
    const { result, rerender } = renderHook(({ id }: { id: string }) => useVideoActions(id), { wrapper: wrapper(repo), initialProps: { id: "v1" } });
    rerender({ id: "v2" });
    await waitFor(() => expect(result.current.state?.videoId).toBe("v2"));
    await act(async () => resolveFirst?.(stateOf("v1", { liked: true })));
    expect(result.current.state?.videoId).toBe("v2");
  });

  it("createClip returns the record or null on failure", async () => {
    const repo = fakeRepo();
    const { result } = renderHook(() => useVideoActions("v1"), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await expect(result.current.createClip(1_000, 5_000)).resolves.toMatchObject({ id: "c1" });
    (repo.createClip as jest.Mock).mockRejectedValueOnce(makeError("validation"));
    await expect(result.current.createClip(0, 1)).resolves.toBeNull();
  });
});
