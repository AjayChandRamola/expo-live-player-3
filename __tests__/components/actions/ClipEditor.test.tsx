import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ClipEditor } from "../../../components/Video/actions/sheets/ClipEditor";

describe("ClipEditor", () => {
  it("validates the range and calls onCreate with a valid one", async () => {
    const onCreate = jest.fn().mockResolvedValue({ id: "c1" });
    const onClose = jest.fn();
    render(<ClipEditor visible onClose={onClose} videoId="v1" durationMs={100_000} currentPositionMs={10_000} onCreate={onCreate} />);
    fireEvent.press(screen.getByLabelText("Set start")); // start = 10_000
    fireEvent.press(screen.getByLabelText("Save clip")); // end not set → validation
    expect(screen.getByText("That input is not valid.")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("saves a valid range and closes", async () => {
    const onCreate = jest.fn().mockResolvedValue({ id: "c1" });
    const onClose = jest.fn();
    const { rerender } = render(<ClipEditor visible onClose={onClose} videoId="v1" durationMs={100_000} currentPositionMs={10_000} onCreate={onCreate} />);
    fireEvent.press(screen.getByLabelText("Set start")); // start = 10_000
    rerender(<ClipEditor visible onClose={onClose} videoId="v1" durationMs={100_000} currentPositionMs={20_000} onCreate={onCreate} />);
    fireEvent.press(screen.getByLabelText("Set end")); // end = 20_000
    await fireEvent.press(screen.getByLabelText("Save clip"));
    expect(onCreate).toHaveBeenCalledWith(10_000, 20_000);
  });
});
