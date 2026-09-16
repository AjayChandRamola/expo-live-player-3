// __tests__/player/engine/usePlaybackEngine.test.tsx
// F10 lifecycle, F15 position reporting, S4, S11-S13, S20.
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { usePlaybackEngine } from "../../../components/VideoPlayer/engine/usePlaybackEngine";
import { POSITION_REPORT_INTERVAL_MS, TIME_UPDATE_INTERVAL_MS } from "../../../components/VideoPlayer/constants";
import type { EngineOptions } from "../../../components/VideoPlayer/engine/types";
import type { VideoPlayerSource } from "../../../components/VideoPlayer/types";
import { createFakeVideoPlayer, type FakeVideoPlayer } from "../fakes/fakeVideoPlayer";

let mockFake: FakeVideoPlayer;
jest.mock("expo-video", () => ({
  useVideoPlayer: jest.fn(() => mockFake),
}));

const MP4: VideoPlayerSource = { url: "https://example.test/v.mp4", kind: "mp4", isLive: false };
const HLS: VideoPlayerSource = { url: "https://example.test/s.m3u8", kind: "hls", isLive: false };
const OPTIONS: EngineOptions = { autoplay: true, loop: false, mutedByDefault: false, timeUpdateIntervalMs: TIME_UPDATE_INTERVAL_MS };

type AppStateHandler = (state: string) => void;
let appStateHandlers: AppStateHandler[] = [];
const removeSpy = jest.fn();

function becomeReady(duration = 100) {
  mockFake.duration = duration;
  mockFake.status = "readyToPlay";
  mockFake.emit("statusChange", { status: "readyToPlay", oldStatus: "loading" });
}
function tick(seconds: number) {
  mockFake.currentTime = seconds;
  mockFake.emit("timeUpdate", { currentTime: seconds, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: seconds + 5 });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFake = createFakeVideoPlayer();
  appStateHandlers = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as AppStateHandler);
    return { remove: removeSpy };
  });
  removeSpy.mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("usePlaybackEngine", () => {
  it("creates the player with a null source, sets the source once, and plays after ready", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video") as { useVideoPlayer: jest.Mock };
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS));
    expect(useVideoPlayer).toHaveBeenCalledWith(null);
    expect(mockFake.replaceCalls).toHaveLength(1);
    expect(result.current.snapshot.status).toBe("loading");
    act(() => becomeReady());
    expect(result.current.snapshot.status).toBe("playing");
  });

  it("re-render with the same URL does not replace the source", () => {
    const { rerender } = renderHook(({ src }: { src: VideoPlayerSource }) => usePlaybackEngine(src, OPTIONS), { initialProps: { src: MP4 } });
    rerender({ src: { ...MP4 } });
    expect(mockFake.replaceCalls).toHaveLength(1);
  });

  it("S4: URL change replaces once and reports the old position first", () => {
    const onPositionChange = jest.fn();
    const { rerender, result } = renderHook(
      ({ src }: { src: VideoPlayerSource }) => usePlaybackEngine(src, OPTIONS, { onPositionChange }),
      { initialProps: { src: MP4 } },
    );
    act(() => becomeReady());
    act(() => tick(20));
    onPositionChange.mockClear();
    rerender({ src: HLS });
    expect(onPositionChange).toHaveBeenCalledWith(20_000, 100_000);
    expect(mockFake.replaceCalls).toHaveLength(2);
    expect(result.current.snapshot.status).toBe("loading");
    expect(result.current.snapshot.positionMs).toBe(0);
  });

  it("F15: reports position every POSITION_REPORT_INTERVAL_MS of playback, on pause and on seek", () => {
    const onPositionChange = jest.fn();
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS, { onPositionChange }));
    act(() => becomeReady());
    act(() => tick(1));
    expect(onPositionChange).toHaveBeenCalledTimes(1); // first report fired when playback started at position 0 (elapsed from -Infinity)
    act(() => tick(3));
    expect(onPositionChange).toHaveBeenCalledTimes(1);
    act(() => tick(1 + POSITION_REPORT_INTERVAL_MS / 1000));
    expect(onPositionChange).toHaveBeenCalledTimes(2);
    act(() => result.current.commands.pause());
    expect(onPositionChange).toHaveBeenCalledTimes(3);
    act(() => result.current.commands.seekTo(50_000));
    expect(onPositionChange).toHaveBeenLastCalledWith(50_000, 100_000);
  });

  it("does not report position for live sources", () => {
    const onPositionChange = jest.fn();
    renderHook(() => usePlaybackEngine({ ...HLS, isLive: true }, OPTIONS, { onPositionChange }));
    act(() => becomeReady(0));
    act(() => tick(10));
    act(() => tick(20));
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("S13: AppState background pauses via the engine; active does not resume", () => {
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS));
    act(() => becomeReady());
    act(() => appStateHandlers.forEach((h) => h("background")));
    expect(mockFake.pause).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.status).toBe("paused");
    act(() => appStateHandlers.forEach((h) => h("active")));
    expect(result.current.snapshot.status).toBe("paused");
  });

  it("S11/S12/S20: unmount reports the final position, pauses, removes listeners and clears timers", () => {
    const onPositionChange = jest.fn();
    const { unmount } = renderHook(() => usePlaybackEngine(MP4, OPTIONS, { onPositionChange }));
    act(() => becomeReady());
    act(() => tick(7));
    onPositionChange.mockClear();
    unmount();
    expect(onPositionChange).toHaveBeenCalledWith(7_000, 100_000);
    expect(mockFake.pause).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(mockFake.listenerCount("timeUpdate")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("uses the latest onPositionChange callback (no stale closure)", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender, result } = renderHook(
      ({ cb }: { cb: (p: number, d: number) => void }) => usePlaybackEngine(MP4, OPTIONS, { onPositionChange: cb }),
      { initialProps: { cb: first } },
    );
    act(() => becomeReady());
    // becomeReady's transition to "playing" at position 0 triggers the same
    // first-report edge exercised in the F15 test above (position 0 minus
    // -Infinity is always "due"). Clear it so the assertions below are only
    // about which callback later reports use, not about that edge.
    first.mockClear();
    rerender({ cb: second });
    act(() => result.current.commands.pause());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("exposes notifyPictureInPicture", () => {
    const { result } = renderHook(() => usePlaybackEngine(MP4, OPTIONS));
    act(() => becomeReady());
    act(() => result.current.notifyPictureInPicture(true));
    expect(result.current.snapshot.isPictureInPicture).toBe(true);
  });
});
