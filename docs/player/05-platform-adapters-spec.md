# 05 — Platform Adapters Specification

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 7 |
| ADRs | 0004, 0005, 0010 |
| Folder | `components/VideoPlayer/platform/` |
| Resolution | Metro picks `<name>.native.ts` for iOS and Android and `<name>.web.ts` for web. Jest's default project (jest-expo preset, iOS platform) resolves `.native.ts`; `jest.web.config.js` resolves `.web.ts`. Consumers import from `"../platform"` (`platform/index.ts`) and never from a platform-suffixed file. |

## 1. Shared types (`platform/types.ts`)

```ts
export type AdapterResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };
export const ok: AdapterResult = { ok: true };
export const fail = (reason: string): AdapterResult => ({ ok: false, reason });

export type Unsubscribe = () => void;

export interface FullscreenAdapter {
  enter(target?: FullscreenTarget): Promise<AdapterResult>;
  exit(): Promise<AdapterResult>;
  isActive(): boolean;
  subscribe(listener: (active: boolean) => void): Unsubscribe;
}
/** Web needs the DOM element to request fullscreen on; native ignores it. */
export type FullscreenTarget = { readonly getElement: () => unknown };

export type OrientationMode = "landscape" | "portrait";
export interface OrientationAdapter {
  lock(mode: OrientationMode): Promise<AdapterResult>;
  unlock(): Promise<AdapterResult>;
  subscribe(listener: (isPortrait: boolean) => void): Unsubscribe;
}

export interface SystemChromeAdapter {
  hide(): Promise<AdapterResult>;
  show(): Promise<AdapterResult>;
}

export type PlayerKey =
  | "togglePlay" | "fullscreen" | "mute" | "exit"
  | "seekBack5" | "seekForward5" | "seekBack10" | "seekForward10"
  | "seekPercent0" | "seekPercent1" | "seekPercent2" | "seekPercent3" | "seekPercent4"
  | "seekPercent5" | "seekPercent6" | "seekPercent7" | "seekPercent8" | "seekPercent9"
  | "rateDown" | "rateUp" | "captions";
export interface KeyboardAdapter {
  subscribe(handler: (key: PlayerKey) => void): Unsubscribe;
  subscribeHover(target: FullscreenTarget, onHover: () => void): Unsubscribe;
}

export interface PictureInPictureAdapter {
  isSupported(): boolean;
  start(view: PictureInPictureTarget): Promise<AdapterResult>;
  stop(view: PictureInPictureTarget): Promise<AdapterResult>;
}
/** Native: the expo-video VideoView ref. Web: a getter for the container element. */
export type PictureInPictureTarget = {
  readonly startPictureInPicture?: () => Promise<void>;
  readonly stopPictureInPicture?: () => Promise<void>;
  readonly getElement?: () => unknown;
};

export interface BrightnessAdapter {
  get(): Promise<number>;                       // 0..1; on failure returns 1 and logs
  set(level: number): Promise<AdapterResult>;   // clamps 0..1
  restore(): Promise<AdapterResult>;            // back to the first value read in this session
}

export interface HapticsAdapter {
  light(): void;                                // fire-and-forget
}
```

## 2. Adapter behaviour tables

### 2.1 `fullscreen`

| Method | Native (`fullscreen.native.ts`) | Web (`fullscreen.web.ts`) |
|---|---|---|
| `enter` | Set internal `active = true`; notify listeners; return `ok`. The composition root switches layout. No native API is called here (orientation and chrome are separate adapters). | Get element via `target.getElement()`; if not an `Element` → `fail("no-element")`; if `!document.fullscreenEnabled` → `fail("unsupported")`; `await element.requestFullscreen()`; on throw → `fail(error.name)`. `active` follows `fullscreenchange`. |
| `exit` | `active = false`; notify; `ok`. | If `document.fullscreenElement` → `await document.exitFullscreen()`; else `ok` (idempotent). |
| `isActive` | internal flag | `document.fullscreenElement !== null` |
| `subscribe` | add to a `Set`; return remover | add `fullscreenchange` listener on `document` that calls listener with `isActive()`; remover removes it |

Proof: native — enter/exit flip `isActive`, listeners called once per change, remover stops calls. Web (jsdom) — mock `requestFullscreen`/`exitFullscreen` on the element and `document`; `fullscreenEnabled` false → fail; dispatch `fullscreenchange` → listener called.

### 2.2 `orientation`

| Method | Native | Web |
|---|---|---|
| `lock("landscape")` | `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE)` (both landscape directions so the user can flip the phone) | `screen.orientation?.lock?.("landscape")` if present; `fail("unsupported")` otherwise. Errors → `fail(name)`. |
| `lock("portrait")` | `lockAsync(OrientationLock.PORTRAIT_UP)` | same pattern with `"portrait"` |
| `unlock` | `ScreenOrientation.unlockAsync()` | `screen.orientation?.unlock?.()`; `ok` |
| `subscribe` | `addOrientationChangeListener(e => listener(isPortraitOf(e.orientationInfo.orientation)))`; remover `removeOrientationChangeListener` | `matchMedia("(orientation: portrait)")`; `change` listener; remover removes |

`isPortraitOf(o)`: `PORTRAIT_UP`, `PORTRAIT_DOWN` → true; else false.

### 2.3 `systemChrome`

| Method | Native | Web |
|---|---|---|
| `hide` | `StatusBar.setHidden(true, "fade")`; `ok` | `ok` (no-op) |
| `show` | `StatusBar.setHidden(false, "fade")`; `ok` | `ok` |

Android navigation bar immersion is not implemented (open item O4).

### 2.4 `keyboard`

| Method | Native | Web |
|---|---|---|
| `subscribe` | returns a no-op unsubscribe | `window.addEventListener("keydown", onKey)`; `onKey` ignores when `event.defaultPrevented`, when `event.target` is `HTMLInputElement`, `HTMLTextAreaElement`, or `isContentEditable`, or when a modifier other than Shift is held; maps per §3; calls `event.preventDefault()` on a mapped key |
| `subscribeHover` | no-op | `element.addEventListener("mousemove", onHover)`; remover removes |

### 2.5 `pictureInPicture`

| Method | Native | Web |
|---|---|---|
| `isSupported` | `Platform.OS === "ios" ? Number(Platform.Version) >= 14 : Platform.OS === "android" ? Number(Platform.Version) >= 26 : false` | `typeof document !== "undefined" && document.pictureInPictureEnabled === true` |
| `start` | `await view.startPictureInPicture?.()`; missing → `fail("no-view")`; throw → `fail(name)` | `const video = element.querySelector("video")`; missing → `fail("no-video")`; `await video.requestPictureInPicture()` |
| `stop` | `view.stopPictureInPicture?.()` | `document.pictureInPictureElement ? document.exitPictureInPicture() : ok` |

PiP start/stop *events* come from `VideoView`'s `onPictureInPictureStart`/`Stop` props (native) or the `<video>` element's `enterpictureinpicture`/`leavepictureinpicture` events (web; subscribed in `PlayerSurface.web` behaviour via the adapter's `subscribeEvents(element, on)` helper — add `subscribeEvents?(target, listener: (active: boolean) => void): Unsubscribe` to the interface; native returns no-op because the props carry it).

iOS config (Increment 2, `app.json`): `"ios": { "infoPlist": { "UIBackgroundModes": ["audio"] } }` so PiP survives backgrounding. This is a managed-workflow config change, not native code.

### 2.6 `brightness`

| Method | Native | Web |
|---|---|---|
| `get` | `Brightness.getBrightnessAsync()`; first successful read stored as `initial`; failure → log once, return 1 | read `initial ??= 1`; return current CSS level stored in module state |
| `set(level)` | `clamp(level, 0, 1)`; `Brightness.setBrightnessAsync(level)`; throw → `fail(name)` | set `element.style.filter = \`brightness(${level})\`` on the surface element registered via `attach(target)` (add `attach?(target: FullscreenTarget): void` to the interface, native no-op) |
| `restore` | if `initial !== undefined` → `set(initial)`; else `ok` | reset filter to `""` |

`expo-brightness` is imported only in `brightness.native.ts`. App-window brightness needs no permission.

### 2.7 `haptics`

| Method | Native | Web |
|---|---|---|
| `light` | `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)` | no-op |

## 3. Keyboard mapping (web)

| Key (`event.key`) | Shift? | `PlayerKey` |
|---|---|---|
| `" "` (Space), `k`, `K` | any | `togglePlay` |
| `f`, `F` | no | `fullscreen` |
| `m`, `M` | no | `mute` |
| `Escape` | no | `exit` |
| `ArrowLeft` | no | `seekBack5` |
| `ArrowRight` | no | `seekForward5` |
| `j`, `J` | no | `seekBack10` |
| `l`, `L` | no | `seekForward10` |
| `0`–`9` | no | `seekPercent0`–`seekPercent9` |
| `<` (Shift + `,`) | yes | `rateDown` |
| `>` (Shift + `.`) | yes | `rateUp` |
| `c`, `C` | no | `captions` |

Unmapped keys are ignored without `preventDefault`.

## 4. `platform/index.ts`

```ts
export { fullscreenAdapter } from "./fullscreen";
export { orientationAdapter } from "./orientation";
export { systemChromeAdapter } from "./systemChrome";
export { keyboardAdapter } from "./keyboard";
export { pictureInPictureAdapter } from "./pictureInPicture";
export { brightnessAdapter } from "./brightness";
export { hapticsAdapter } from "./haptics";
export * from "./types";
```

Each `<name>.native.ts` and `<name>.web.ts` exports the same named const. TypeScript resolves the import without a suffix by the `expo/tsconfig.base` `moduleSuffixes` setting; if `tsc` cannot resolve `"./fullscreen"`, add a `fullscreen.ts` that re-exports the native file (`export * from "./fullscreen.native"`) — Metro still prefers the platform file at bundle time. Record which approach was needed in the Increment 2 report.

## 5. Failure handling contract

- Adapters never throw. Every rejection is converted to `fail(reason)`.
- The composition root logs a failed result once per (adapter, method) via `devLog` and continues. Fullscreen entry proceeds even if orientation lock or chrome hide fails.
- Adapters keep no React state; module-level state is limited to `initial` brightness, the `Set` of listeners, and the fullscreen flag.

## 6. Tests

| File | Config | Cases |
|---|---|---|
| `__tests__/player/platform/fullscreen.native.test.ts` | default | flag, listeners, remover |
| `__tests__/player/platform/fullscreen.web.test.ts` | web | unsupported, no element, success, exit idempotent, change event |
| `orientation.native.test.ts` | default | `lockAsync` called with the right enum; `unlockAsync`; listener add/remove |
| `orientation.web.test.ts` | web | missing API → fail; matchMedia listener |
| `systemChrome.native.test.ts` | default | `StatusBar.setHidden` called with true/false |
| `keyboard.web.test.ts` | web | every mapping; ignore in input; preventDefault on mapped; unsubscribe removes |
| `keyboard.native.test.ts` | default | subscribe returns a function; handler never called |
| `pictureInPicture.native.test.ts` | default | version gate; start/stop call the view; missing view → fail |
| `pictureInPicture.web.test.ts` | web | `pictureInPictureEnabled` false → unsupported; no video → fail; success |
| `brightness.native.test.ts` | default | clamp; restore returns to initial; failure → fail |
| `brightness.web.test.ts` | web | filter string; restore clears |
| `haptics.native.test.ts` | default | `impactAsync` called once; rejection swallowed |

Mocks: `expo-screen-orientation`, `expo-brightness`, `expo-haptics` are mocked in `__tests__/harness/setup.ts` (extend the existing harness; do not create a second setup file).
