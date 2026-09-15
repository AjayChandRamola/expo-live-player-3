// __tests__/hooks/useIsOnline.test.tsx
import { AppState } from "react-native";
import { renderHook, act } from "@testing-library/react-native";
import { useIsOnline } from "../../hooks/useIsOnline";

describe("useIsOnline", () => {
  beforeEach(() => {
    // isOnline is shared module state; reset it to the default before
    // every test since each caller's report affects every other caller.
    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportSuccess());
  });

  afterEach(() => jest.restoreAllMocks());

  it("assumes online until something fails", () => {
    const { result } = renderHook(() => useIsOnline());
    expect(result.current.isOnline).toBe(true);
  });

  it("goes offline after a reported network failure", () => {
    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportNetworkFailure());
    expect(result.current.isOnline).toBe(false);
  });

  it("comes back online after a reported success", () => {
    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportNetworkFailure());
    act(() => result.current.reportSuccess());
    expect(result.current.isOnline).toBe(true);
  });

  it("optimistically returns online when the app comes to the foreground", () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportNetworkFailure());
    expect(result.current.isOnline).toBe(false);

    act(() => listeners.forEach((cb) => cb("active")));
    expect(result.current.isOnline).toBe(true);
  });

  it("removes its app-state listener on unmount", () => {
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove } as never);
    const { unmount } = renderHook(() => useIsOnline());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
