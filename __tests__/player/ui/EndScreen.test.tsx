// __tests__/player/ui/EndScreen.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EndScreen } from "../../../components/VideoPlayer/ui/EndScreen";

describe("EndScreen", () => {
  it("hidden when not visible", () => {
    render(<EndScreen visible={false} secondsLeft={null} onReplay={jest.fn()} onCancelAutoplay={jest.fn()} testID="end" />);
    expect(screen.queryByTestId("end")).toBeNull();
  });
  it("replay only when there is no countdown", () => {
    const onReplay = jest.fn();
    render(<EndScreen visible secondsLeft={null} onReplay={onReplay} onCancelAutoplay={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Replay"));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Up next/)).toBeNull();
  });
  it("shows the countdown and cancel", () => {
    const onCancel = jest.fn();
    render(<EndScreen visible secondsLeft={4} onReplay={jest.fn()} onCancelAutoplay={onCancel} />);
    expect(screen.getByText("Up next in 4")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Cancel autoplay"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
