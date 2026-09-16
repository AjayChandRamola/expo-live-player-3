// components/VideoPlayer/platform/pictureInPicture.native.ts
// The only file above expo-video allowed to read Platform.OS (R4 exempts platform/).
import { Platform } from "react-native";
import { fail, ok, reasonOf, type PictureInPictureAdapter } from "./types";

const IOS_MIN_MAJOR = 14;
const ANDROID_MIN_API = 26;

function majorVersion(version: string | number): number {
  return typeof version === "number" ? version : Number.parseInt(version.split(".")[0] ?? "0", 10);
}

export function createPictureInPictureAdapter(): PictureInPictureAdapter {
  return {
    isSupported() {
      if (Platform.OS === "ios") return majorVersion(Platform.Version) >= IOS_MIN_MAJOR;
      if (Platform.OS === "android") return majorVersion(Platform.Version) >= ANDROID_MIN_API;
      return false;
    },
    async start(target) {
      if (typeof target.startPictureInPicture !== "function") return fail("no-view");
      try {
        await target.startPictureInPicture();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async stop(target) {
      if (typeof target.stopPictureInPicture !== "function") return fail("no-view");
      try {
        await target.stopPictureInPicture();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    subscribe: () => () => undefined,
  };
}

export const pictureInPictureAdapter: PictureInPictureAdapter = createPictureInPictureAdapter();
