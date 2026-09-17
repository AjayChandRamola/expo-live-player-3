import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReportSheet } from "../../../components/Video/actions/sheets/ReportSheet";

describe("ReportSheet", () => {
  it("Submit is disabled until a reason is chosen", () => {
    const onSubmit = jest.fn();
    render(<ReportSheet visible onClose={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByLabelText("Submit report"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("choosing Spam and submitting calls onSubmit with no details", () => {
    const onSubmit = jest.fn();
    render(<ReportSheet visible onClose={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByLabelText("Spam"));
    fireEvent.press(screen.getByLabelText("Submit report"));
    expect(onSubmit).toHaveBeenCalledWith("spam", undefined);
  });

  it("typing details passes them", () => {
    const onSubmit = jest.fn();
    render(<ReportSheet visible onClose={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByLabelText("Other"));
    fireEvent.changeText(screen.getByLabelText("Details"), "extra context");
    fireEvent.press(screen.getByLabelText("Submit report"));
    expect(onSubmit).toHaveBeenCalledWith("other", "extra context");
  });

  it("renders nothing when not visible", () => {
    render(<ReportSheet visible={false} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByText("Report video")).toBeNull();
  });
});
