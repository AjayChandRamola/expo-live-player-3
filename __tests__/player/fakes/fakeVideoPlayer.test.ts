// __tests__/player/fakes/fakeVideoPlayer.test.ts
import { createFakeVideoPlayer } from "./fakeVideoPlayer";

describe("fakeVideoPlayer", () => {
  it("records listeners and emits to them; remove() detaches", () => {
    const fake = createFakeVideoPlayer();
    const handler = jest.fn();
    const sub = fake.addListener("playToEnd", handler);
    expect(fake.listenerCount("playToEnd")).toBe(1);
    fake.emit("playToEnd", undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    sub.remove();
    expect(fake.listenerCount("playToEnd")).toBe(0);
  });

  it("play() and pause() flip playing and emit playingChange", () => {
    const fake = createFakeVideoPlayer();
    const handler = jest.fn();
    fake.addListener("playingChange", handler);
    fake.play();
    expect(fake.playing).toBe(true);
    expect(handler).toHaveBeenLastCalledWith({ isPlaying: true, oldIsPlaying: false });
    fake.pause();
    expect(fake.playing).toBe(false);
  });

  it("replace() records the source, sets status loading and emits statusChange", () => {
    const fake = createFakeVideoPlayer();
    const handler = jest.fn();
    fake.addListener("statusChange", handler);
    fake.replace({ uri: "https://x/v.mp4" });
    expect(fake.replaceCalls).toHaveLength(1);
    expect(fake.status).toBe("loading");
    expect(handler).toHaveBeenCalledWith({ status: "loading", oldStatus: "idle" });
  });

  it("seekBy clamps to duration", () => {
    const fake = createFakeVideoPlayer({ duration: 10, currentTime: 8 });
    fake.seekBy(5);
    expect(fake.currentTime).toBe(10);
  });
});
