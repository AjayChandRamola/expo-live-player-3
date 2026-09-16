// __tests__/hooks/useLiveStatus.test.tsx
import { AppState } from "react-native";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useLiveStatus } from "../../hooks/useLiveStatus";
import * as liveService from "../../services/liveService";
import { makeError } from "../../services/appError";
import { TIMING } from "../../constants/config";

jest.mock("../../services/liveService");
const live = liveService as jest.Mocked<typeof liveService>;

const status = {
  state: "live" as const,
  session: {
    id: "s1",
    title: "Gayatri Yagya",
    thumbnailUrl: "https://cdn.test/t.jpg",
    startsAt: "2026-01-01T00:00:00Z",
    source: { kind: "hls" as const, url: "https://cdn.test/live.m3u8" },
  },
  checkedAt: "2026-01-01T00:00:00Z",
};

describe("useLiveStatus", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    live.getLiveStatus.mockResolvedValue(status);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("loads the status on mount", async () => {
    const { result } = renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.state).toBe("live");
  });

  it("polls on the configured interval", async () => {
    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs);
    });
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(2));
  });

  it("does not poll when disabled", async () => {
    renderHook(() => useLiveStatus({ enabled: false }));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 3);
    });
    expect(live.getLiveStatus).not.toHaveBeenCalled();
  });

  it("stops polling after unmount", async () => {
    const { unmount } = renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 3);
    });
    expect(live.getLiveStatus).toHaveBeenCalledTimes(1);
  });

  it("stops polling when the app leaves the foreground", async () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    act(() => listeners.forEach((cb) => cb("background")));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 2);
    });
    expect(live.getLiveStatus).toHaveBeenCalledTimes(1);
  });

  it("backs off after an error instead of hammering the endpoint", async () => {
    live.getLiveStatus.mockRejectedValue(makeError("network"));
    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs);
    });
    const afterFirstInterval = live.getLiveStatus.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs);
    });
    // With backoff the second interval must not add another call yet.
    expect(live.getLiveStatus.mock.calls.length).toBe(afterFirstInterval);
  });

  it("keeps only one request in flight", async () => {
    let resolve: (v: typeof status) => void = () => {};
    live.getLiveStatus.mockReturnValue(new Promise((r) => { resolve = r; }));

    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 2);
    });
    expect(live.getLiveStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve(status);
    });
  });
});
