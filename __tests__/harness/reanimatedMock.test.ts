// __tests__/harness/reanimatedMock.test.ts
// Guards the Jest harness: Reanimated 4 must load under Jest (through the
// react-native-worklets mock) and the harness's useSharedValue wrapper must
// keep identity across re-renders.
import React from "react";
import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

describe("reanimated jest harness", () => {
  it("loads react-native-reanimated without touching the native worklets proxy", () => {
    const { result } = renderHook(() => useSharedValue(1));
    expect(result.current.value).toBe(1);
  });

  it("keeps the same shared value object across re-renders", () => {
    const { result, rerender } = renderHook(() => useSharedValue(7));
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
    expect(React.isValidElement(first)).toBe(false);
  });
});
