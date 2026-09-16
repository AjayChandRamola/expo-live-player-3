// components/VideoPlayer/platform/pictureInPicture.web.ts
import { fail, ok, reasonOf, type PictureInPictureAdapter, type PictureInPictureTarget } from "./types";

function videoOf(target: PictureInPictureTarget): HTMLVideoElement | null {
  const element = target.getElement?.();
  if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) return null;
  return element.querySelector("video");
}

export function createPictureInPictureAdapter(): PictureInPictureAdapter {
  return {
    isSupported: () => typeof document !== "undefined" && document.pictureInPictureEnabled === true,
    async start(target) {
      const video = videoOf(target);
      if (!video) return fail("no-video");
      try {
        await video.requestPictureInPicture();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async stop() {
      if (typeof document === "undefined" || document.pictureInPictureElement === null) return ok;
      try {
        await document.exitPictureInPicture();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    subscribe(target, listener) {
      const video = videoOf(target);
      if (!video) return () => undefined;
      const onEnter = () => listener(true);
      const onLeave = () => listener(false);
      video.addEventListener("enterpictureinpicture", onEnter);
      video.addEventListener("leavepictureinpicture", onLeave);
      return () => {
        video.removeEventListener("enterpictureinpicture", onEnter);
        video.removeEventListener("leavepictureinpicture", onLeave);
      };
    },
  };
}

export const pictureInPictureAdapter: PictureInPictureAdapter = createPictureInPictureAdapter();
