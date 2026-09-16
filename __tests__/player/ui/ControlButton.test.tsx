// __tests__/player/ui/ControlButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ControlButton } from "../../../components/VideoPlayer/ui/controls/ControlButton";
import { playerTokens } from "../../../components/VideoPlayer/tokens";

describe("ControlButton", () => {
  it("renders role, label and calls onPress once", () => {
    const onPress = jest.fn();
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={onPress} testID="btn" />);
    const btn = screen.getByRole("button", { name: "Play" });
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled and exposes the state", () => {
    const onPress = jest.fn();
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={onPress} disabled testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId("btn").props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("exposes selected state for toggles", () => {
    render(<ControlButton icon="play" accessibilityLabel="Autoplay on" onPress={jest.fn()} active testID="btn" />);
    expect(screen.getByTestId("btn").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("small buttons get hitSlop so the target is at least the minimum touch size", () => {
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={jest.fn()} size="sm" testID="btn" />);
    const expected = (playerTokens.size.minTouchTarget - playerTokens.size.controlSm) / 2;
    expect(screen.getByTestId("btn").props.hitSlop).toBe(expected);
  });

  it("medium and large buttons need no hitSlop", () => {
    render(<ControlButton icon="play" accessibilityLabel="Play" onPress={jest.fn()} size="lg" testID="btn" />);
    expect(screen.getByTestId("btn").props.hitSlop).toBe(0);
  });
});
