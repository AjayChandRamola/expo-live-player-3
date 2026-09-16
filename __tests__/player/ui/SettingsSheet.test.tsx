// __tests__/player/ui/SettingsSheet.test.tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SettingsSheet, type SettingsSheetProps } from "../../../components/VideoPlayer/ui/SettingsSheet";
import { PLAYBACK_RATES } from "../../../components/VideoPlayer/constants";

function props(overrides: Partial<SettingsSheetProps> = {}): SettingsSheetProps {
  return {
    visible: true, onClose: jest.fn(), rate: 1, onRate: jest.fn(),
    captionsAvailable: true, captionsEnabled: false, onToggleCaptions: jest.fn(),
    subtitleTracks: [], activeSubtitle: null, onSelectSubtitle: jest.fn(),
    activeQualityLabel: null, testID: "sheet", ...overrides,
  };
}

describe("SettingsSheet", () => {
  it("lists every rate, marks the active one, and selects", () => {
    const p = props({ rate: 1.5 });
    render(<SettingsSheet {...p} />);
    for (const rate of PLAYBACK_RATES) expect(screen.getByLabelText(`Speed ${rate}×`)).toBeTruthy();
    expect(screen.getByLabelText("Speed 1.5×").props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText("Speed 2×"));
    expect(p.onRate).toHaveBeenCalledWith(2);
  });
  it("captions switch toggles; hidden when unavailable", () => {
    const p = props();
    const { rerender } = render(<SettingsSheet {...p} />);
    fireEvent(screen.getByLabelText("Captions"), "valueChange", true);
    expect(p.onToggleCaptions).toHaveBeenCalledWith(true);
    rerender(<SettingsSheet {...props({ captionsAvailable: false })} />);
    expect(screen.queryByLabelText("Captions")).toBeNull();
  });
  it("lists subtitle tracks with Off and selects", () => {
    const p = props({ subtitleTracks: [{ id: "hi", language: "hi", label: "Hindi" }], activeSubtitle: null });
    render(<SettingsSheet {...p} />);
    fireEvent.press(screen.getByLabelText("Subtitles Hindi"));
    expect(p.onSelectSubtitle).toHaveBeenCalledWith({ id: "hi", language: "hi", label: "Hindi" });
    fireEvent.press(screen.getByLabelText("Subtitles Off"));
    expect(p.onSelectSubtitle).toHaveBeenLastCalledWith(null);
  });
  it("shows the quality label read-only or hides the row", () => {
    const { rerender } = render(<SettingsSheet {...props({ activeQualityLabel: "Auto · 720p" })} />);
    expect(screen.getByText("Auto · 720p")).toBeTruthy();
    rerender(<SettingsSheet {...props({ activeQualityLabel: null })} />);
    expect(screen.queryByText(/Quality/)).toBeNull();
  });
  it("backdrop press and Close call onClose; hidden when not visible", () => {
    const p = props();
    const { rerender } = render(<SettingsSheet {...p} />);
    fireEvent.press(screen.getByLabelText("Close settings"));
    expect(p.onClose).toHaveBeenCalledTimes(1);
    rerender(<SettingsSheet {...props({ visible: false })} />);
    expect(screen.queryByTestId("sheet")).toBeNull();
  });
});
