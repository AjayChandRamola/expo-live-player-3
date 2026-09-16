// __tests__/player/ui/ErrorCard.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ErrorCard } from "../../../components/VideoPlayer/ui/ErrorCard";
import { ERROR_MESSAGES, MAX_RETRIES } from "../../../components/VideoPlayer/constants";
import type { PlaybackError } from "../../../components/VideoPlayer/engine/types";

const net: PlaybackError = { code: "network", message: ERROR_MESSAGES.network, retryable: true };
const unsupported: PlaybackError = { code: "unsupported", message: ERROR_MESSAGES.unsupported, retryable: false };

describe("ErrorCard", () => {
  it("hidden without an error", () => {
    render(<ErrorCard error={null} retryAttempt={0} retrying={false} onRetry={jest.fn()} testID="err" />);
    expect(screen.queryByTestId("err")).toBeNull();
  });
  it("shows the message and a retrying line while an automatic retry is in flight", () => {
    render(<ErrorCard error={net} retryAttempt={2} retrying onRetry={jest.fn()} />);
    expect(screen.getByText(ERROR_MESSAGES.network)).toBeTruthy();
    expect(screen.getByText(`Retrying (2/${MAX_RETRIES})…`)).toBeTruthy();
    expect(screen.queryByLabelText("Retry")).toBeNull();
  });
  it("offers Retry after retries are exhausted", () => {
    const onRetry = jest.fn();
    render(<ErrorCard error={net} retryAttempt={MAX_RETRIES} retrying={false} onRetry={onRetry} />);
    fireEvent.press(screen.getByLabelText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("no Retry for non-retryable errors and uses an assertive live region", () => {
    render(<ErrorCard error={unsupported} retryAttempt={0} retrying={false} onRetry={jest.fn()} testID="err" />);
    expect(screen.queryByLabelText("Retry")).toBeNull();
    expect(screen.getByTestId("err").props.accessibilityLiveRegion).toBe("assertive");
  });
});
