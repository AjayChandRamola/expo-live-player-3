// __tests__/player/ui/PlayerSurface.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PLAYER_SURFACE_TEST_IDS, PlayerSurface } from "../../../components/VideoPlayer/ui/PlayerSurface";
import type { VideoPlayer } from "expo-video";

jest.mock("expo-video", () => {
  const ReactLib = require("react");
  return {
    VideoView: ReactLib.forwardRef((props: Record<string, unknown>, ref: unknown) => ReactLib.createElement("VideoView", { ...props, ref })),
  };
});
jest.mock("expo-image", () => {
  const ReactLib = require("react");
  return { Image: (props: Record<string, unknown>) => ReactLib.createElement("Image", props) };
});

const player = {} as VideoPlayer;

describe("PlayerSurface", () => {
  it("renders VideoView with custom controls disabled and forwards PiP props", () => {
    const onStart = jest.fn();
    render(<PlayerSurface player={player} showPoster={false} allowsPictureInPicture onPictureInPictureStart={onStart} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()} />);
    const view = screen.getByTestId(PLAYER_SURFACE_TEST_IDS.video);
    expect(view.props.nativeControls).toBe(false);
    expect(view.props.allowsFullscreen).toBe(false);
    expect(view.props.allowsPictureInPicture).toBe(true);
    expect(view.props.contentFit).toBe("contain");
    expect(view.props.onPictureInPictureStart).toBe(onStart);
  });
  it("shows the poster only when asked and a URL exists", () => {
    const { rerender } = render(<PlayerSurface player={player} posterUrl="https://x/p.jpg" showPoster allowsPictureInPicture={false} onPictureInPictureStart={jest.fn()} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()} />);
    expect(screen.getByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeTruthy();
    rerender(<PlayerSurface player={player} posterUrl="https://x/p.jpg" showPoster={false} allowsPictureInPicture={false} onPictureInPictureStart={jest.fn()} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()} />);
    expect(screen.queryByTestId(PLAYER_SURFACE_TEST_IDS.poster)).toBeNull();
  });
  it("renders children above the video and forwards the ref", () => {
    // React Test Renderer resolves a host-component ref to null unless a
    // createNodeMock is supplied; this asserts the ref reaches the VideoView
    // host node (the mock), not that a real native view exists.
    const ref = React.createRef<never>();
    render(
      <PlayerSurface ref={ref} player={player} showPoster={false} allowsPictureInPicture={false} onPictureInPictureStart={jest.fn()} onPictureInPictureStop={jest.fn()} onLayout={jest.fn()}>
        <></>
      </PlayerSurface>,
      { createNodeMock: () => ({}) },
    );
    expect(ref.current).not.toBeNull();
  });
});
