// __tests__/screens/SettingsScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SettingsScreen from "../../app/settings";

const mockSetTheme = jest.fn();
const mockSetAutoplayDefault = jest.fn();
let mockTheme: "system" | "light" | "dark" = "system";
let mockAutoplayDefault = true;

jest.mock("../../contexts/SettingsContext", () => ({
  useSettings: () => ({
    theme: mockTheme,
    autoplayDefault: mockAutoplayDefault,
    hydrated: true,
    setTheme: mockSetTheme,
    setAutoplayDefault: mockSetAutoplayDefault,
  }),
}));

const mockSetAutoplay = jest.fn();
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setAutoplay: mockSetAutoplay }),
}));

jest.mock("expo-router", () => ({ Stack: { Screen: () => null } }));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTheme = "system";
    mockAutoplayDefault = true;
  });

  it("offers all three theme choices", () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId("theme-system")).toBeTruthy();
    expect(screen.getByTestId("theme-light")).toBeTruthy();
    expect(screen.getByTestId("theme-dark")).toBeTruthy();
  });

  it("marks the active theme as selected for assistive technology", () => {
    mockTheme = "dark";
    render(<SettingsScreen />);
    expect(screen.getByTestId("theme-dark").props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("persists a theme choice", () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("theme-dark"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles the autoplay default and applies it to the current queue", () => {
    render(<SettingsScreen />);
    fireEvent(screen.getByTestId("autoplay-toggle"), "valueChange", false);
    expect(mockSetAutoplayDefault).toHaveBeenCalledWith(false);
    expect(mockSetAutoplay).toHaveBeenCalledWith(false);
  });

  it("shows the app version", () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId("settings-version")).toBeTruthy();
  });
});
