// components/VideoPlayer/platform/orientation.native.ts
import * as ScreenOrientation from "expo-screen-orientation";
import { fail, ok, reasonOf, type OrientationAdapter } from "./types";

function isPortraitOf(orientation: ScreenOrientation.Orientation): boolean {
  return orientation === ScreenOrientation.Orientation.PORTRAIT_UP || orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;
}

export function createOrientationAdapter(): OrientationAdapter {
  return {
    async lock(mode) {
      try {
        await ScreenOrientation.lockAsync(
          mode === "landscape" ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async unlock() {
      try {
        await ScreenOrientation.unlockAsync();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    subscribe(listener) {
      const subscription = ScreenOrientation.addOrientationChangeListener((event) =>
        listener(isPortraitOf(event.orientationInfo.orientation)),
      );
      return () => ScreenOrientation.removeOrientationChangeListener(subscription);
    },
  };
}

export const orientationAdapter: OrientationAdapter = createOrientationAdapter();
