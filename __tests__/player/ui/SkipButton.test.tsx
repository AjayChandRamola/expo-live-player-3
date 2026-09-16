// __tests__/player/ui/SkipButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SkipButton } from "../../../components/VideoPlayer/ui/controls/SkipButton";

describe("SkipButton", () => {
  it("previous/next labels and presses", () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(
      <>
        <SkipButton direction="previous" enabled onPress={onPrev} />
        <SkipButton direction="next" enabled onPress={onNext} />
      </>,
    );
    fireEvent.press(screen.getByLabelText("Previous video"));
    fireEvent.press(screen.getByLabelText("Next video"));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
  it("disabled when not enabled", () => {
    const onNext = jest.fn();
    render(<SkipButton direction="next" enabled={false} onPress={onNext} testID="next" />);
    fireEvent.press(screen.getByTestId("next"));
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByTestId("next").props.accessibilityState.disabled).toBe(true);
  });
});
