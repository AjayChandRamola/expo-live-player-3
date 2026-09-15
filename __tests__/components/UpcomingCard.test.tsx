// __tests__/components/UpcomingCard.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { UpcomingCard } from "../../components/Live/UpcomingCard";
import type { LiveSession } from "../../types/domain";

const now = new Date("2026-01-01T10:00:00Z");

function session(startsAt: string): LiveSession {
  return {
    id: "s1",
    title: "Gayatri Yagya",
    thumbnailUrl: "https://cdn.test/t.jpg",
    startsAt,
    source: { kind: "hls", url: "https://cdn.test/live.m3u8" },
  };
}

describe("UpcomingCard", () => {
  it("shows the session title", () => {
    render(<UpcomingCard session={session("2026-01-01T12:00:00Z")} now={now} testID="up" />);
    expect(screen.getByText("Gayatri Yagya")).toBeTruthy();
  });

  it("counts down in hours and minutes", () => {
    render(<UpcomingCard session={session("2026-01-01T12:30:00Z")} now={now} testID="up" />);
    expect(screen.getByTestId("up-countdown")).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();
  });

  it("counts down in minutes when under an hour away", () => {
    render(<UpcomingCard session={session("2026-01-01T10:20:00Z")} now={now} testID="up" />);
    expect(screen.getByText(/20/)).toBeTruthy();
  });

  it("says starting soon when the start time has passed", () => {
    render(<UpcomingCard session={session("2026-01-01T09:00:00Z")} now={now} testID="up" />);
    expect(screen.getByTestId("up-countdown")).toBeTruthy();
  });

  it("does not crash on an unparseable start time", () => {
    expect(() =>
      render(<UpcomingCard session={session("not-a-date")} now={now} testID="up" />),
    ).not.toThrow();
  });
});
