// __tests__/player/engine/initialSnapshot.test.ts
import { createInitialSnapshot } from "../../../components/VideoPlayer/engine/initialSnapshot";

describe("createInitialSnapshot", () => {
  it("starts idle with zeroed numbers and nulls", () => {
    const s = createInitialSnapshot();
    expect(s).toEqual({
      status: "idle",
      positionMs: 0,
      durationMs: 0,
      bufferedMs: 0,
      isLive: false,
      liveOffsetMs: null,
      playbackRate: 1,
      muted: false,
      volume: 1,
      error: null,
      retryAttempt: 0,
      qualities: [],
      activeQuality: null,
      subtitleTracks: [],
      activeSubtitle: null,
      isPictureInPicture: false,
      isPlayingBeforeBackground: false,
    });
  });

  it("applies overrides", () => {
    expect(createInitialSnapshot({ status: "playing", positionMs: 5 }).status).toBe("playing");
    expect(createInitialSnapshot({ positionMs: 5 }).positionMs).toBe(5);
  });
});
