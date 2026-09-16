// __tests__/components/FeaturedYagnaCard.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { FeaturedYagnaCard } from "../../components/Home/FeaturedYagnaCard";
import type { Video } from "../../types/domain";

const video: Video = {
  id: "f1",
  title: "Gayatri Yagya",
  description: "Morning offering",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 3600,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna Vishnu Bhagwan" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

describe("FeaturedYagnaCard", () => {
  it("shows the title and channel", () => {
    render(<FeaturedYagnaCard video={video} onPress={jest.fn()} testID="fc" />);
    expect(screen.getByText("Gayatri Yagya")).toBeTruthy();
    expect(screen.getByText("Yagna Vishnu Bhagwan")).toBeTruthy();
  });

  it("passes the video to onPress", () => {
    const onPress = jest.fn();
    render(<FeaturedYagnaCard video={video} onPress={onPress} testID="fc" />);
    fireEvent.press(screen.getByTestId("fc"));
    expect(onPress).toHaveBeenCalledWith(video);
  });

  it("is announced as a button with the title in its label", () => {
    render(<FeaturedYagnaCard video={video} onPress={jest.fn()} testID="fc" />);
    const card = screen.getByTestId("fc");
    expect(card.props.accessibilityRole).toBe("button");
    expect(String(card.props.accessibilityLabel)).toContain("Gayatri Yagya");
  });

  it("renders a long title without crashing", () => {
    const long = { ...video, title: "अ".repeat(300) };
    expect(() =>
      render(<FeaturedYagnaCard video={long} onPress={jest.fn()} testID="fc" />),
    ).not.toThrow();
  });
});
