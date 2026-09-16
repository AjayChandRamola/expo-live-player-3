// __tests__/player/ui/TimeLabel.test.tsx
import { render, screen } from "@testing-library/react-native";
import { TimeLabel } from "../../../components/VideoPlayer/ui/TimeLabel";

describe("TimeLabel", () => {
  it("VOD shows position / duration", () => {
    render(<TimeLabel positionMs={65_000} durationMs={3_600_000} isLive={false} liveOffsetMs={null} chapterTitle={null} />);
    expect(screen.getByText("1:05 / 1:00:00")).toBeTruthy();
  });
  it("live at the edge shows LIVE; behind shows a negative offset", () => {
    const { rerender } = render(<TimeLabel positionMs={0} durationMs={0} isLive liveOffsetMs={2_000} chapterTitle={null} />);
    expect(screen.getByText("LIVE")).toBeTruthy();
    rerender(<TimeLabel positionMs={0} durationMs={0} isLive liveOffsetMs={35_000} chapterTitle={null} />);
    expect(screen.getByText("-0:35")).toBeTruthy();
  });
  it("appends the chapter title", () => {
    render(<TimeLabel positionMs={0} durationMs={10_000} isLive={false} liveOffsetMs={null} chapterTitle="Aarti" />);
    expect(screen.getByText("0:00 / 0:10 · Aarti")).toBeTruthy();
  });
});
