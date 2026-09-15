// __tests__/hooks/useLoadable.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useLoadable } from "../../hooks/useLoadable";
import { makeError } from "../../services/appError";

describe("useLoadable", () => {
  it("moves from loading to success", async () => {
    const load = jest.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useLoadable({ load }));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(["a"]);
    expect(result.current.error).toBeNull();
  });

  it("reports empty when the isEmpty predicate matches", async () => {
    const load = jest.fn().mockResolvedValue([]);
    const { result } = renderHook(() =>
      useLoadable({ load, isEmpty: (d: unknown[]) => d.length === 0 }),
    );
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("maps a network error to the offline status", async () => {
    const load = jest.fn().mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("offline"));
    expect(result.current.error?.code).toBe("network");
  });

  it("maps any other error to the error status", async () => {
    const load = jest.fn().mockRejectedValue(makeError("not_found"));
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("not_found");
  });

  it("wraps a raw thrown error as unknown rather than leaking it", async () => {
    const load = jest.fn().mockRejectedValue(new Error("raw"));
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("unknown");
  });

  it("stays idle and does not call load when disabled", async () => {
    const load = jest.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useLoadable({ load, enabled: false }));
    expect(result.current.status).toBe("idle");
    expect(load).not.toHaveBeenCalled();
  });

  it("re-runs load when retry is called", async () => {
    const load = jest.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => result.current.retry());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("ignores a slow first response when a second has already resolved", async () => {
    let resolveFirst: (v: string) => void = () => {};
    const first = new Promise<string>((r) => {
      resolveFirst = r;
    });

    const load = jest
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce("second");

    const { result } = renderHook(() => useLoadable({ load }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toBe("second"));

    // The stale first request now lands. It must not overwrite the newer data.
    await act(async () => {
      resolveFirst("first");
      await first;
    });
    expect(result.current.data).toBe("second");
  });

  it("does not set state after unmount", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    let resolveLoad: (v: string) => void = () => {};
    const pending = new Promise<string>((r) => {
      resolveLoad = r;
    });

    const { unmount } = renderHook(() => useLoadable({ load: () => pending }));
    unmount();

    await act(async () => {
      resolveLoad("late");
      await pending;
    });

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("state update on an unmounted"),
    );
    errorSpy.mockRestore();
  });
});
