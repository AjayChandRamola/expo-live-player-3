// __tests__/player/AutoplayNotification.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import AutoplayNotification from "../../components/VideoPlayer/AutoplayNotification";

describe("AutoplayNotification", () => {
  it("renders its message when visible", () => {
    render(
      <AutoplayNotification visible message="Autoplay is on" onDismiss={jest.fn()} />,
    );
    expect(screen.getByText("Autoplay is on")).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    render(
      <AutoplayNotification visible={false} message="Autoplay is off" onDismiss={jest.fn()} />,
    );
    expect(screen.queryByText("Autoplay is off")).toBeNull();
  });
});
