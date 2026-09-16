// __tests__/player/platform/pictureInPicture.web.test.ts
import { createPictureInPictureAdapter } from "../../../components/VideoPlayer/platform/pictureInPicture.web";

function setPipEnabled(value: boolean) {
  Object.defineProperty(document, "pictureInPictureEnabled", { value, configurable: true });
}

describe("picture-in-picture adapter (web)", () => {
  let container: HTMLDivElement;
  let video: HTMLVideoElement & { requestPictureInPicture: jest.Mock };
  beforeEach(() => {
    setPipEnabled(true);
    container = document.createElement("div");
    video = Object.assign(document.createElement("video"), { requestPictureInPicture: jest.fn().mockResolvedValue(undefined) });
    container.appendChild(video);
    Object.defineProperty(document, "pictureInPictureElement", { value: null, configurable: true });
    document.exitPictureInPicture = jest.fn().mockResolvedValue(undefined);
  });

  it("unsupported when the document flag is false", () => {
    setPipEnabled(false);
    expect(createPictureInPictureAdapter().isSupported()).toBe(false);
  });

  it("starts on the <video> inside the container; fails without one", async () => {
    const adapter = createPictureInPictureAdapter();
    await expect(adapter.start({ getElement: () => container })).resolves.toEqual({ ok: true });
    expect(video.requestPictureInPicture).toHaveBeenCalled();
    await expect(adapter.start({ getElement: () => document.createElement("div") })).resolves.toEqual({ ok: false, reason: "no-video" });
  });

  it("stop exits only when a PiP element exists", async () => {
    const adapter = createPictureInPictureAdapter();
    await expect(adapter.stop({ getElement: () => container })).resolves.toEqual({ ok: true });
    expect(document.exitPictureInPicture).not.toHaveBeenCalled();
    Object.defineProperty(document, "pictureInPictureElement", { value: video, configurable: true });
    await adapter.stop({ getElement: () => container });
    expect(document.exitPictureInPicture).toHaveBeenCalled();
  });

  it("subscribe mirrors enter/leave events and unsubscribes", () => {
    const listener = jest.fn();
    const unsubscribe = createPictureInPictureAdapter().subscribe({ getElement: () => container }, listener);
    video.dispatchEvent(new Event("enterpictureinpicture"));
    video.dispatchEvent(new Event("leavepictureinpicture"));
    expect(listener.mock.calls).toEqual([[true], [false]]);
    unsubscribe();
    video.dispatchEvent(new Event("enterpictureinpicture"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
