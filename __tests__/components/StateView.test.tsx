// __tests__/components/StateView.test.tsx
import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StateView } from "../../components/ui/StateView";
import { makeError } from "../../services/appError";

describe("StateView", () => {
  it("renders nothing when idle", () => {
    render(<StateView status="idle" testID="sv" />);
    expect(screen.queryByTestId("sv")).toBeNull();
  });

  it("renders nothing when successful, because the caller renders content", () => {
    render(<StateView status="success" testID="sv" />);
    expect(screen.queryByTestId("sv")).toBeNull();
  });

  it("renders a spinner while loading", () => {
    render(<StateView status="loading" testID="sv" />);
    expect(screen.getByTestId("sv-loading")).toBeTruthy();
  });

  it("renders a supplied skeleton instead of the spinner", () => {
    render(<StateView status="loading" testID="sv" loadingSkeleton={<Text>bones</Text>} />);
    expect(screen.getByText("bones")).toBeTruthy();
  });

  it("shows the empty title and hint", () => {
    render(<StateView status="empty" testID="sv" emptyTitle="Nothing saved" emptyHint="Tap Save" />);
    expect(screen.getByText("Nothing saved")).toBeTruthy();
    expect(screen.getByText("Tap Save")).toBeTruthy();
  });

  it("shows the error message from the AppError, not a hard-coded string", () => {
    const error = makeError("not_found");
    render(<StateView status="error" error={error} testID="sv" />);
    expect(screen.getByText(error.message)).toBeTruthy();
  });

  it("shows the offline message from the AppError", () => {
    const error = makeError("network");
    render(<StateView status="offline" error={error} testID="sv" />);
    expect(screen.getByText(error.message)).toBeTruthy();
  });

  it("calls onRetry when the retry button is pressed", () => {
    const onRetry = jest.fn();
    render(<StateView status="error" error={makeError("unknown")} onRetry={onRetry} testID="sv" />);
    fireEvent.press(screen.getByTestId("sv-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when no handler is given", () => {
    render(<StateView status="error" error={makeError("unknown")} testID="sv" />);
    expect(screen.queryByTestId("sv-retry")).toBeNull();
  });

  it("exposes the retry button to assistive technology", () => {
    render(<StateView status="error" error={makeError("unknown")} onRetry={jest.fn()} testID="sv" />);
    const retry = screen.getByTestId("sv-retry");
    expect(retry.props.accessibilityRole).toBe("button");
    expect(typeof retry.props.accessibilityLabel).toBe("string");
  });
});
