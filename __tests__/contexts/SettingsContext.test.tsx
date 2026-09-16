// __tests__/contexts/SettingsContext.test.tsx
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { SettingsProvider, useSettings } from "../../contexts/SettingsContext";
import * as settingsStorage from "../../services/storage/settingsStorage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../services/storage/settingsStorage");
const storage = settingsStorage as jest.Mocked<typeof settingsStorage>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe("SettingsContext", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    storage.writeSettings.mockResolvedValue(undefined);
  });

  it("hydrates stored settings", async () => {
    storage.readSettings.mockResolvedValue({ theme: "dark", autoplayDefault: false });
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.hydrated).toBe(false);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.theme).toBe("dark");
    expect(result.current.autoplayDefault).toBe(false);
  });

  it("falls back to defaults when the read fails", async () => {
    storage.readSettings.mockRejectedValue(new Error("disk"));
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.theme).toBe("system");
    expect(result.current.autoplayDefault).toBe(true);
  });

  it("persists a theme change", async () => {
    storage.readSettings.mockResolvedValue({ theme: "system", autoplayDefault: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
    await waitFor(() =>
      expect(storage.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" }),
      ),
    );
  });

  it("persists an autoplay change", async () => {
    storage.readSettings.mockResolvedValue({ theme: "system", autoplayDefault: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setAutoplayDefault(false));
    await waitFor(() =>
      expect(storage.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoplayDefault: false }),
      ),
    );
  });

  it("does not write during hydration", async () => {
    storage.readSettings.mockResolvedValue({ theme: "dark", autoplayDefault: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(storage.writeSettings).not.toHaveBeenCalled();
  });

  it("keeps the on-screen value when a write fails", async () => {
    storage.readSettings.mockResolvedValue({ theme: "system", autoplayDefault: true });
    storage.writeSettings.mockRejectedValue(new Error("disk full"));
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setTheme("dark"));
    await waitFor(() => expect(storage.writeSettings).toHaveBeenCalled());
    expect(result.current.theme).toBe("dark");
  });

  it("throws a clear error outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSettings())).toThrow(/SettingsProvider/);
    spy.mockRestore();
  });
});
