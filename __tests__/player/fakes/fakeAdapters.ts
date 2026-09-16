// __tests__/player/fakes/fakeAdapters.ts
// Recording fakes for every platform adapter. Root tests inject these.
import type {
  AdapterResult,
  BrightnessAdapter,
  FullscreenAdapter,
  HapticsAdapter,
  KeyboardAdapter,
  OrientationAdapter,
  PictureInPictureAdapter,
  PlayerKey,
  SystemChromeAdapter,
} from "../../../components/VideoPlayer/platform/types";

const ok: AdapterResult = { ok: true };

export function createFakeAdapters() {
  let fullscreenActive = false;
  const fullscreenListeners = new Set<(a: boolean) => void>();
  const orientationListeners = new Set<(p: boolean) => void>();
  let keyHandler: ((key: PlayerKey) => void) | null = null;
  let pipListener: ((active: boolean) => void) | null = null;

  const fullscreen: FullscreenAdapter & { nextResult: AdapterResult } = {
    nextResult: ok,
    enter: jest.fn(async () => {
      fullscreenActive = true;
      fullscreenListeners.forEach((l) => l(true));
      return fullscreen.nextResult;
    }),
    exit: jest.fn(async () => {
      fullscreenActive = false;
      fullscreenListeners.forEach((l) => l(false));
      return fullscreen.nextResult;
    }),
    isActive: () => fullscreenActive,
    subscribe: (l) => {
      fullscreenListeners.add(l);
      return () => fullscreenListeners.delete(l);
    },
  };
  const orientation: OrientationAdapter & { nextResult: AdapterResult; emit(isPortrait: boolean): void } = {
    nextResult: ok,
    lock: jest.fn(async () => orientation.nextResult),
    unlock: jest.fn(async () => orientation.nextResult),
    subscribe: (l) => {
      orientationListeners.add(l);
      return () => orientationListeners.delete(l);
    },
    emit: (isPortrait) => orientationListeners.forEach((l) => l(isPortrait)),
  };
  const systemChrome: SystemChromeAdapter = { hide: jest.fn(async () => ok), show: jest.fn(async () => ok) };
  const keyboard: KeyboardAdapter & { press(key: PlayerKey): void } = {
    subscribe: (h) => {
      keyHandler = h;
      return () => {
        keyHandler = null;
      };
    },
    subscribeHover: () => () => undefined,
    press: (key) => keyHandler?.(key),
  };
  const pictureInPicture: PictureInPictureAdapter & { supported: boolean; emit(active: boolean): void } = {
    supported: true,
    isSupported: () => pictureInPicture.supported,
    start: jest.fn(async () => ok),
    stop: jest.fn(async () => ok),
    subscribe: (_t, l) => {
      pipListener = l;
      return () => {
        pipListener = null;
      };
    },
    emit: (active) => pipListener?.(active),
  };
  const brightness: BrightnessAdapter & { level: number } = {
    level: 0.5,
    attach: jest.fn(),
    get: jest.fn(async () => brightness.level),
    set: jest.fn(async (v: number) => {
      brightness.level = v;
      return ok;
    }),
    restore: jest.fn(async () => ok),
  };
  const haptics: HapticsAdapter = { light: jest.fn() };

  return { fullscreen, orientation, systemChrome, keyboard, pictureInPicture, brightness, haptics };
}

export type FakeAdapters = ReturnType<typeof createFakeAdapters>;
