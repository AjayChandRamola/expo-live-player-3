// __tests__/components/VideoMeta.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { VideoMeta } from "../../components/Video/VideoMeta";
import type { Video } from "../../types/domain";

const video: Video = {
  id: "v1",
  title: "Gayatri Yagya",
  description: "A long description. ".repeat(40),
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 600,
  publishedAt: "2026-01-01T00:00:00Z",
  viewCount: 1234,
  channel: { id: "c1", name: "Yagna Vishnu Bhagwan" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

describe("VideoMeta", () => {
  it("shows the title and channel", () => {
    render(<VideoMeta video={video} testID="meta" />);
    expect(screen.getByText("Gayatri Yagya")).toBeTruthy();
    expect(screen.getByText("Yagna Vishnu Bhagwan")).toBeTruthy();
  });

  it("expands and collapses the description", () => {
    render(<VideoMeta video={video} testID="meta" />);
    const toggle = screen.getByTestId("meta-description-toggle");

    const collapsed = screen.getByTestId("meta-description").props.numberOfLines;
    fireEvent.press(toggle);
    expect(screen.getByTestId("meta-description").props.numberOfLines).not.toBe(collapsed);
  });

  it("omits the description section when there is none", () => {
    render(<VideoMeta video={{ ...video, description: undefined }} testID="meta" />);
    expect(screen.queryByTestId("meta-description")).toBeNull();
  });

  it("renders without a view count", () => {
    expect(() =>
      render(<VideoMeta video={{ ...video, viewCount: undefined }} testID="meta" />),
    ).not.toThrow();
  });

  it("does not crash on an unparseable published date", () => {
    expect(() =>
      render(<VideoMeta video={{ ...video, publishedAt: "not-a-date" }} testID="meta" />),
    ).not.toThrow();
  });
});
