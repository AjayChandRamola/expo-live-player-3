// __tests__/player/hooks/useFullscreen.test.tsx
import { act, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import type { createFakeAdapters } from "../fakes/fakeAdapters";

// jest.mock is hoisted above any local `const`, so the fake adapters are
// created inside the factory itself (via require, not the hoisted import)
// and captured into this outer binding for the test body to use.
let mockAdapters: ReturnType<typeof createFakeAdapters>;
jest.mock("../../../components/VideoPlayer/platform", () => {
  const { createFakeAdapters: create } = require("../fakes/fakeAdapters");
  mockAdapters = create();
  return {
    fullscreenAdapter: mockAdapters.fullscreen,
    orientationAdapter: mockAdapters.orientation,
    systemChromeAdapter: mockAdapters.systemChrome,
    keyboardAdapter: mockAdapters.keyboard,
    pictureInPictureAdapter: mockAdapters.pictureInPicture,
    brightnessAdapter: mockAdapters.brightness,
    hapticsAdapter: mockAdapters.haptics,
  };
});

import { useFullscreen } from "../../../components/VideoPlayer/hooks/useFullscreen";

type BackHandlerCb = () => boolean;
let backHandlers: BackHandlerCb[] = [];
const backRemove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  backHandlers = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, cb) => {
    backHandlers.push(cb as BackHandlerCb);
    return { remove: backRemove };
  });
});

const getElement = () => null;

describe("useFullscreen", () => {
  it("enter locks landscape, hides chrome, reports change; exit reverses", async () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useFullscreen({ onChange, getElement, enabled: true }));
    await act(() => result.current.enter());
    expect(result.current.isFullscreen).toBe(true);
    expect(mockAdapters.orientation.lock).toHaveBeenCalledWith("landscape");
    expect(mockAdapters.systemChrome.hide).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(true);
    await act(() => result.current.exit());
    expect(result.current.isFullscreen).toBe(false);
    expect(mockAdapters.orientation.lock).toHaveBeenLastCalledWith("portrait");
    expect(mockAdapters.systemChrome.show).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("a failed orientation lock still enters fullscreen", async () => {
    mockAdapters.orientation.nextResult = { ok: false, reason: "x" };
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(() => result.current.enter());
    expect(result.current.isFullscreen).toBe(true);
    mockAdapters.orientation.nextResult = { ok: true };
  });

  it("hardware back exits fullscreen and is consumed; listener removed when not fullscreen", async () => {
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    expect(backHandlers).toHaveLength(0);
    await act(() => result.current.enter());
    expect(backHandlers).toHaveLength(1);
    let consumed = false;
    await act(async () => {
      consumed = backHandlers[0]();
    });
    expect(consumed).toBe(true);
    expect(result.current.isFullscreen).toBe(false);
    expect(backRemove).toHaveBeenCalled();
  });

  it("rotating to landscape while inline enters fullscreen (FULLSCREEN_ON_ROTATE)", async () => {
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(async () => mockAdapters.orientation.emit(false));
    expect(result.current.isFullscreen).toBe(true);
  });

  it("adapter change (browser Escape) mirrors state without re-locking", async () => {
    const { result } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(() => result.current.enter());
    await act(async () => {
      await mockAdapters.fullscreen.exit();
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  it("unmount while fullscreen restores orientation and chrome", async () => {
    const { result, unmount } = renderHook(() => useFullscreen({ onChange: jest.fn(), getElement, enabled: true }));
    await act(() => result.current.enter());
    jest.clearAllMocks();
    unmount();
    expect(mockAdapters.orientation.lock).toHaveBeenCalledWith("portrait");
    expect(mockAdapters.systemChrome.show).toHaveBeenCalled();
  });
});
