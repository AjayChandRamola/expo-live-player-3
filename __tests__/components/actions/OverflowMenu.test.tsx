import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { OverflowMenu } from "../../../components/Video/actions/sheets/OverflowMenu";

describe("OverflowMenu", () => {
  const props = {
    visible: true,
    onClose: jest.fn(),
    videoId: "v1",
    channelId: "c1",
    onNotInterested: jest.fn(),
    onReport: jest.fn(),
    onDontRecommendChannel: jest.fn(),
  };

  it("shows Not interested, Report, and Don't recommend channel", () => {
    render(<OverflowMenu {...props} />);
    expect(screen.getByLabelText("Not interested")).toBeTruthy();
    expect(screen.getByLabelText("Report")).toBeTruthy();
    expect(screen.getByLabelText("Don't recommend channel")).toBeTruthy();
  });

  it("no longer shows Help, Quality or Captions", () => {
    render(<OverflowMenu {...props} />);
    expect(screen.queryByText(/Help|Quality|Captions/)).toBeNull();
  });

  it("each row calls its callback", () => {
    render(<OverflowMenu {...props} />);
    fireEvent.press(screen.getByLabelText("Not interested"));
    expect(props.onNotInterested).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Report"));
    expect(props.onReport).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Don't recommend channel"));
    expect(props.onDontRecommendChannel).toHaveBeenCalled();
  });
});
