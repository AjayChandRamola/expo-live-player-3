# Increment 2 — Platform Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Increment 1 must be merged.

**Goal:** Implement every device capability the player needs behind small interfaces with a native and a web implementation, tested on both Jest projects, so no code above this layer ever branches on platform.

**Architecture:** `components/VideoPlayer/platform/<name>.native.ts` and `<name>.web.ts` export the same named adapter object (built by a `create…Adapter()` factory for testability). A suffix-less `<name>.ts` re-exports the native file so `tsc` resolves imports; Metro and Jest pick the platform file first. `platform/index.ts` is the only import path consumers use.

**Tech Stack:** expo-screen-orientation ~9.0.7, expo-brightness 14.0.x, expo-haptics ~15.0.7, react-native `StatusBar`, DOM APIs (web), Jest default project + `jest.web.config.js`.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §7; `docs/player/05-platform-adapters-spec.md` (interfaces §1, behaviour tables §2, keyboard map §3, tests §6); ADRs 0004, 0005, 0010.

## Global Constraints

See the index. Additionally:
- Adapters never throw: every rejection becomes `fail(reason)`.
- Adapters import no React and nothing from `engine/`, `ui/`, `gestures/`.
- Web files use `lib.dom` types only; no `as any`. Feature detection via `typeof document !== "undefined"` and property checks.
- Invariant R4 (no `Platform.OS` outside `platform/`) is activated in Task 9.

## File structure

```
components/VideoPlayer/platform/
  types.ts
  fullscreen.native.ts  fullscreen.web.ts  fullscreen.ts
  orientation.native.ts orientation.web.ts orientation.ts
  systemChrome.native.ts systemChrome.web.ts systemChrome.ts
  keyboard.native.ts    keyboard.web.ts    keyboard.ts
  pictureInPicture.native.ts pictureInPicture.web.ts pictureInPicture.ts
  brightness.native.ts  brightness.web.ts  brightness.ts
  haptics.native.ts     haptics.web.ts     haptics.ts
  index.ts
__tests__/player/platform/
  types.test.ts
  <name>.native.test.ts   (default project)
  <name>.web.test.ts      (web project)
__tests__/player/fakes/fakeAdapters.ts
app.json                  (ios.infoPlist.UIBackgroundModes)
```

Pattern for every `<name>.ts` fallback file (used by `tsc` only):
```ts
// components/VideoPlayer/platform/<name>.ts
// Type-resolution fallback. Metro and Jest resolve <name>.native.ts / <name>.web.ts first.
export * from "./<name>.native";
```

---

### Task 1: Adapter types and result helpers

**Files:**
- Create: `components/VideoPlayer/platform/types.ts`
- Test: `__tests__/player/platform/types.test.ts`

**Interfaces:**
- Produces: `AdapterResult`, `ok`, `fail(reason)`, `reasonOf(error)`, `Unsubscribe`, and all adapter interfaces used by Tasks 2–8 and by Increment 4.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/player/platform/types.test.ts
import { fail, ok, reasonOf } from "../../../components/VideoPlayer/platform/types";

describe("adapter result helpers", () => {
  it("ok is a frozen success", () => expect(ok).toEqual({ ok: true }));
  it("fail carries a reason", () => expect(fail("unsupported")).toEqual({ ok: false, reason: "unsupported" }));
  it("reasonOf uses the error name, falls back to unknown", () => {
    expect(reasonOf(new TypeError("x"))).toBe("TypeError");
    expect(reasonOf("string")).toBe("unknown");
    expect(reasonOf(undefined)).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- --testPathPattern=platform/types`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/platform/types.ts
// Interfaces for device capabilities. One .native.ts and one .web.ts per adapter.
// Spec: docs/player/05-platform-adapters-spec.md §1

export type AdapterResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };
export const ok: AdapterResult = Object.freeze({ ok: true }) as AdapterResult;
export const fail = (reason: string): AdapterResult => ({ ok: false, reason });
export const reasonOf = (error: unknown): string => (error instanceof Error ? error.name : "unknown");

export type Unsubscribe = () => void;

/** Web needs a DOM element to act on; native ignores the target. */
export interface ElementTarget {
  readonly getElement: () => unknown;
}

export interface FullscreenAdapter {
  enter(target?: ElementTarget): Promise<AdapterResult>;
  exit(): Promise<AdapterResult>;
  isActive(): boolean;
  subscribe(listener: (active: boolean) => void): Unsubscribe;
}

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
  subscribeHover(target: ElementTarget, onHover: () => void): Unsubscribe;
}

/** Native: the expo-video VideoView ref. Web: a getter for the surface element. */
export interface PictureInPictureTarget extends Partial<ElementTarget> {
  readonly startPictureInPicture?: () => Promise<void>;
  readonly stopPictureInPicture?: () => Promise<void>;
}
export interface PictureInPictureAdapter {
  isSupported(): boolean;
  start(target: PictureInPictureTarget): Promise<AdapterResult>;
  stop(target: PictureInPictureTarget): Promise<AdapterResult>;
  /** Web: listens to the <video> element's PiP events. Native: no-op (VideoView props carry them). */
  subscribe(target: PictureInPictureTarget, listener: (active: boolean) => void): Unsubscribe;
}

export interface BrightnessAdapter {
  /** Web only: registers the element that receives the CSS filter. Native: no-op. */
  attach(target: ElementTarget): void;
  get(): Promise<number>;
  set(level: number): Promise<AdapterResult>;
  restore(): Promise<AdapterResult>;
}

export interface HapticsAdapter {
  light(): void;
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern=platform/types`
Expected: 3 passed.

```bash
git checkout -b feature/player-2-platform
git add components/VideoPlayer/platform/types.ts __tests__/player/platform/types.test.ts
git commit -m "feat(player): add platform adapter interfaces and result helpers

Verified: npm test -- --testPathPattern=platform/types => 3 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Fullscreen adapter (native and web)

**Files:**
- Create: `platform/fullscreen.native.ts`, `platform/fullscreen.web.ts`, `platform/fullscreen.ts`
- Test: `__tests__/player/platform/fullscreen.native.test.ts`, `__tests__/player/platform/fullscreen.web.test.ts`

**Interfaces:**
- Produces: `createFullscreenAdapter(): FullscreenAdapter` and `fullscreenAdapter` (module singleton) from both platform files.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/fullscreen.native.test.ts
import { createFullscreenAdapter } from "../../../components/VideoPlayer/platform/fullscreen.native";

describe("fullscreen adapter (native)", () => {
  it("enter/exit flip isActive and notify listeners once per change", async () => {
    const adapter = createFullscreenAdapter();
    const listener = jest.fn();
    const unsubscribe = adapter.subscribe(listener);
    expect(adapter.isActive()).toBe(false);
    await expect(adapter.enter()).resolves.toEqual({ ok: true });
    expect(adapter.isActive()).toBe(true);
    await adapter.enter(); // idempotent
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(adapter.exit()).resolves.toEqual({ ok: true });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe();
    await adapter.enter();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
```

```ts
// __tests__/player/platform/fullscreen.web.test.ts
import { createFullscreenAdapter } from "../../../components/VideoPlayer/platform/fullscreen.web";

function setFullscreenEnabled(value: boolean) {
  Object.defineProperty(document, "fullscreenEnabled", { value, configurable: true });
}
function setFullscreenElement(value: Element | null) {
  Object.defineProperty(document, "fullscreenElement", { value, configurable: true });
}

describe("fullscreen adapter (web)", () => {
  let el: HTMLDivElement;
  beforeEach(() => {
    el = document.createElement("div");
    el.requestFullscreen = jest.fn().mockResolvedValue(undefined);
    document.exitFullscreen = jest.fn().mockResolvedValue(undefined);
    setFullscreenEnabled(true);
    setFullscreenElement(null);
  });

  it("fails when the Fullscreen API is unavailable", async () => {
    setFullscreenEnabled(false);
    await expect(createFullscreenAdapter().enter({ getElement: () => el })).resolves.toEqual({ ok: false, reason: "unsupported" });
  });

  it("fails without an element", async () => {
    await expect(createFullscreenAdapter().enter({ getElement: () => null })).resolves.toEqual({ ok: false, reason: "no-element" });
    await expect(createFullscreenAdapter().enter()).resolves.toEqual({ ok: false, reason: "no-element" });
  });

  it("requests fullscreen on the element and reports isActive from the document", async () => {
    const adapter = createFullscreenAdapter();
    await expect(adapter.enter({ getElement: () => el })).resolves.toEqual({ ok: true });
    expect(el.requestFullscreen).toHaveBeenCalledTimes(1);
    setFullscreenElement(el);
    expect(adapter.isActive()).toBe(true);
  });

  it("maps a rejected request to fail(name)", async () => {
    el.requestFullscreen = jest.fn().mockRejectedValue(new TypeError("nope"));
    await expect(createFullscreenAdapter().enter({ getElement: () => el })).resolves.toEqual({ ok: false, reason: "TypeError" });
  });

  it("exit is idempotent and calls document.exitFullscreen only when active", async () => {
    const adapter = createFullscreenAdapter();
    await expect(adapter.exit()).resolves.toEqual({ ok: true });
    expect(document.exitFullscreen).not.toHaveBeenCalled();
    setFullscreenElement(el);
    await adapter.exit();
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("subscribe mirrors fullscreenchange and unsubscribes", () => {
    const adapter = createFullscreenAdapter();
    const listener = jest.fn();
    const unsubscribe = adapter.subscribe(listener);
    setFullscreenElement(el);
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(listener).toHaveBeenCalledWith(true);
    unsubscribe();
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run both to confirm failure**

Run: `npm test -- --testPathPattern=platform/fullscreen.native` and `npm run test:web -- --testPathPattern=platform/fullscreen.web`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/platform/fullscreen.native.ts
// Native fullscreen is a layout mode (ADR 0004): this adapter only tracks the flag.
import { ok, type FullscreenAdapter } from "./types";

export function createFullscreenAdapter(): FullscreenAdapter {
  let active = false;
  const listeners = new Set<(active: boolean) => void>();
  const notify = () => {
    for (const listener of listeners) listener(active);
  };
  return {
    async enter() {
      if (!active) {
        active = true;
        notify();
      }
      return ok;
    },
    async exit() {
      if (active) {
        active = false;
        notify();
      }
      return ok;
    },
    isActive: () => active,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const fullscreenAdapter: FullscreenAdapter = createFullscreenAdapter();
```

```ts
// components/VideoPlayer/platform/fullscreen.web.ts
import { fail, ok, reasonOf, type FullscreenAdapter } from "./types";

const hasDocument = (): boolean => typeof document !== "undefined";
const isElement = (value: unknown): value is Element => typeof Element !== "undefined" && value instanceof Element;

export function createFullscreenAdapter(): FullscreenAdapter {
  return {
    async enter(target) {
      if (!hasDocument() || !document.fullscreenEnabled) return fail("unsupported");
      const element = target?.getElement();
      if (!isElement(element)) return fail("no-element");
      try {
        await element.requestFullscreen();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async exit() {
      if (!hasDocument() || document.fullscreenElement === null) return ok;
      try {
        await document.exitFullscreen();
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    isActive: () => hasDocument() && document.fullscreenElement !== null,
    subscribe(listener) {
      if (!hasDocument()) return () => undefined;
      const handler = () => listener(document.fullscreenElement !== null);
      document.addEventListener("fullscreenchange", handler);
      return () => document.removeEventListener("fullscreenchange", handler);
    },
  };
}

export const fullscreenAdapter: FullscreenAdapter = createFullscreenAdapter();
```

```ts
// components/VideoPlayer/platform/fullscreen.ts
// Type-resolution fallback. Metro and Jest resolve fullscreen.native.ts / fullscreen.web.ts first.
export * from "./fullscreen.native";
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern=platform/fullscreen.native` → 1 passed.
Run: `npm run test:web -- --testPathPattern=platform/fullscreen.web` → 6 passed.

```bash
git add components/VideoPlayer/platform/fullscreen.native.ts components/VideoPlayer/platform/fullscreen.web.ts components/VideoPlayer/platform/fullscreen.ts __tests__/player/platform/fullscreen.native.test.ts __tests__/player/platform/fullscreen.web.test.ts
git commit -m "feat(player): add fullscreen adapter for native and web

Verified: npm test -- --testPathPattern=platform/fullscreen.native => 1 passed
Verified: npm run test:web -- --testPathPattern=platform/fullscreen.web => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Orientation adapter

**Files:**
- Create: `platform/orientation.native.ts`, `platform/orientation.web.ts`, `platform/orientation.ts`
- Test: `__tests__/player/platform/orientation.native.test.ts`, `__tests__/player/platform/orientation.web.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/orientation.native.test.ts
import * as ScreenOrientation from "expo-screen-orientation";
import { orientationAdapter } from "../../../components/VideoPlayer/platform/orientation.native";

const lockAsync = ScreenOrientation.lockAsync as jest.Mock;
const unlockAsync = ScreenOrientation.unlockAsync as jest.Mock;
const addListener = ScreenOrientation.addOrientationChangeListener as jest.Mock;
const removeListener = ScreenOrientation.removeOrientationChangeListener as jest.Mock;

describe("orientation adapter (native)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("locks landscape and portrait with the right enum values", async () => {
    await expect(orientationAdapter.lock("landscape")).resolves.toEqual({ ok: true });
    expect(lockAsync).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.LANDSCAPE);
    await orientationAdapter.lock("portrait");
    expect(lockAsync).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  });

  it("unlocks", async () => {
    await expect(orientationAdapter.unlock()).resolves.toEqual({ ok: true });
    expect(unlockAsync).toHaveBeenCalledTimes(1);
  });

  it("maps a rejected lock to fail(name)", async () => {
    lockAsync.mockRejectedValueOnce(new RangeError("bad"));
    await expect(orientationAdapter.lock("landscape")).resolves.toEqual({ ok: false, reason: "RangeError" });
  });

  it("subscribe reports isPortrait and removes the native listener on unsubscribe", () => {
    const listener = jest.fn();
    const subscription = { remove: jest.fn() };
    addListener.mockReturnValueOnce(subscription);
    const unsubscribe = orientationAdapter.subscribe(listener);
    const nativeHandler = addListener.mock.calls[0][0] as (e: { orientationInfo: { orientation: number } }) => void;
    nativeHandler({ orientationInfo: { orientation: ScreenOrientation.Orientation.LANDSCAPE_LEFT } });
    expect(listener).toHaveBeenLastCalledWith(false);
    nativeHandler({ orientationInfo: { orientation: ScreenOrientation.Orientation.PORTRAIT_UP } });
    expect(listener).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(subscription);
  });
});
```

```ts
// __tests__/player/platform/orientation.web.test.ts
import { createOrientationAdapter } from "../../../components/VideoPlayer/platform/orientation.web";

describe("orientation adapter (web)", () => {
  it("fails to lock when screen.orientation.lock is unavailable", async () => {
    Object.defineProperty(window.screen, "orientation", { value: {}, configurable: true });
    await expect(createOrientationAdapter().lock("landscape")).resolves.toEqual({ ok: false, reason: "unsupported" });
  });

  it("locks and unlocks through screen.orientation when available", async () => {
    const lock = jest.fn().mockResolvedValue(undefined);
    const unlock = jest.fn();
    Object.defineProperty(window.screen, "orientation", { value: { lock, unlock }, configurable: true });
    const adapter = createOrientationAdapter();
    await expect(adapter.lock("landscape")).resolves.toEqual({ ok: true });
    expect(lock).toHaveBeenCalledWith("landscape");
    await expect(adapter.unlock()).resolves.toEqual({ ok: true });
    expect(unlock).toHaveBeenCalled();
  });

  it("subscribe uses matchMedia for portrait changes", () => {
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    const mql = {
      matches: true,
      addEventListener: jest.fn((_: string, l: (e: { matches: boolean }) => void) => listeners.push(l)),
      removeEventListener: jest.fn(),
    };
    window.matchMedia = jest.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
    const listener = jest.fn();
    const unsubscribe = createOrientationAdapter().subscribe(listener);
    listeners[0]({ matches: false });
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure** (both projects).

- [ ] **Step 3: Implement**

```ts
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
```

```ts
// components/VideoPlayer/platform/orientation.web.ts
import { fail, ok, reasonOf, type OrientationAdapter } from "./types";

type LockableOrientation = { lock?: (mode: "landscape" | "portrait") => Promise<void>; unlock?: () => void };

function orientationApi(): LockableOrientation | null {
  if (typeof window === "undefined" || typeof window.screen === "undefined") return null;
  const value: unknown = window.screen.orientation;
  return typeof value === "object" && value !== null ? (value as LockableOrientation) : null;
}

export function createOrientationAdapter(): OrientationAdapter {
  return {
    async lock(mode) {
      const api = orientationApi();
      if (!api || typeof api.lock !== "function") return fail("unsupported");
      try {
        await api.lock(mode);
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async unlock() {
      const api = orientationApi();
      if (api && typeof api.unlock === "function") api.unlock();
      return ok;
    },
    subscribe(listener) {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const query = window.matchMedia("(orientation: portrait)");
      const handler = (event: { matches: boolean }) => listener(event.matches);
      query.addEventListener("change", handler);
      return () => query.removeEventListener("change", handler);
    },
  };
}

export const orientationAdapter: OrientationAdapter = createOrientationAdapter();
```

```ts
// components/VideoPlayer/platform/orientation.ts
export * from "./orientation.native";
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --testPathPattern=platform/orientation.native` → 4 passed; `npm run test:web -- --testPathPattern=platform/orientation.web` → 3 passed.

```bash
git add components/VideoPlayer/platform/orientation.* __tests__/player/platform/orientation.*
git commit -m "feat(player): add orientation adapter for native and web

Verified: npm test -- --testPathPattern=platform/orientation.native => 4 passed
Verified: npm run test:web -- --testPathPattern=platform/orientation.web => 3 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: System chrome adapter

**Files:**
- Create: `platform/systemChrome.native.ts`, `platform/systemChrome.web.ts`, `platform/systemChrome.ts`
- Test: `__tests__/player/platform/systemChrome.native.test.ts`, `__tests__/player/platform/systemChrome.web.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/systemChrome.native.test.ts
import { StatusBar } from "react-native";
import { systemChromeAdapter } from "../../../components/VideoPlayer/platform/systemChrome.native";

describe("system chrome adapter (native)", () => {
  const setHidden = jest.spyOn(StatusBar, "setHidden").mockImplementation(() => undefined);
  beforeEach(() => setHidden.mockClear());

  it("hide/show toggle the status bar with a fade", async () => {
    await expect(systemChromeAdapter.hide()).resolves.toEqual({ ok: true });
    expect(setHidden).toHaveBeenLastCalledWith(true, "fade");
    await expect(systemChromeAdapter.show()).resolves.toEqual({ ok: true });
    expect(setHidden).toHaveBeenLastCalledWith(false, "fade");
  });

  it("maps a throwing StatusBar call to fail", async () => {
    setHidden.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    await expect(systemChromeAdapter.hide()).resolves.toEqual({ ok: false, reason: "Error" });
  });
});
```

```ts
// __tests__/player/platform/systemChrome.web.test.ts
import { systemChromeAdapter } from "../../../components/VideoPlayer/platform/systemChrome.web";

describe("system chrome adapter (web)", () => {
  it("is a no-op that succeeds", async () => {
    await expect(systemChromeAdapter.hide()).resolves.toEqual({ ok: true });
    await expect(systemChromeAdapter.show()).resolves.toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run to confirm failure** (both projects).

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/platform/systemChrome.native.ts
import { StatusBar } from "react-native";
import { fail, ok, reasonOf, type SystemChromeAdapter } from "./types";

function setHidden(hidden: boolean) {
  try {
    StatusBar.setHidden(hidden, "fade");
    return ok;
  } catch (error) {
    return fail(reasonOf(error));
  }
}

export const systemChromeAdapter: SystemChromeAdapter = {
  hide: async () => setHidden(true),
  show: async () => setHidden(false),
};
```

```ts
// components/VideoPlayer/platform/systemChrome.web.ts
import { ok, type SystemChromeAdapter } from "./types";

export const systemChromeAdapter: SystemChromeAdapter = {
  hide: async () => ok,
  show: async () => ok,
};
```

```ts
// components/VideoPlayer/platform/systemChrome.ts
export * from "./systemChrome.native";
```

- [ ] **Step 4: Run and commit**

```bash
git add components/VideoPlayer/platform/systemChrome.* __tests__/player/platform/systemChrome.*
git commit -m "feat(player): add system chrome adapter

Verified: npm test -- --testPathPattern=platform/systemChrome.native => 2 passed
Verified: npm run test:web -- --testPathPattern=platform/systemChrome.web => 1 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Keyboard adapter

**Files:**
- Create: `platform/keyboard.native.ts`, `platform/keyboard.web.ts`, `platform/keyboard.ts`
- Test: `__tests__/player/platform/keyboard.native.test.ts`, `__tests__/player/platform/keyboard.web.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/keyboard.native.test.ts
import { keyboardAdapter } from "../../../components/VideoPlayer/platform/keyboard.native";

describe("keyboard adapter (native)", () => {
  it("subscribe returns an unsubscribe and never calls the handler", () => {
    const handler = jest.fn();
    const unsubscribe = keyboardAdapter.subscribe(handler);
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
    expect(handler).not.toHaveBeenCalled();
  });
  it("subscribeHover is a no-op", () => {
    const unsubscribe = keyboardAdapter.subscribeHover({ getElement: () => null }, jest.fn());
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });
});
```

```ts
// __tests__/player/platform/keyboard.web.test.ts
import { keyboardAdapter, mapKeyEvent } from "../../../components/VideoPlayer/platform/keyboard.web";

function key(k: string, extra: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra });
}

describe("mapKeyEvent", () => {
  it.each([
    [" ", "togglePlay"], ["k", "togglePlay"], ["K", "togglePlay"],
    ["f", "fullscreen"], ["m", "mute"], ["Escape", "exit"],
    ["ArrowLeft", "seekBack5"], ["ArrowRight", "seekForward5"], ["j", "seekBack10"], ["l", "seekForward10"],
    ["0", "seekPercent0"], ["5", "seekPercent5"], ["9", "seekPercent9"],
    ["c", "captions"],
  ])("maps %p to %p", (k, expected) => {
    expect(mapKeyEvent(key(k))).toBe(expected);
  });
  it("maps shift+comma/period to rate keys", () => {
    expect(mapKeyEvent(key("<", { shiftKey: true }))).toBe("rateDown");
    expect(mapKeyEvent(key(">", { shiftKey: true }))).toBe("rateUp");
  });
  it("ignores unmapped keys and keys with ctrl/meta/alt", () => {
    expect(mapKeyEvent(key("x"))).toBeNull();
    expect(mapKeyEvent(key("k", { ctrlKey: true }))).toBeNull();
    expect(mapKeyEvent(key("k", { metaKey: true }))).toBeNull();
    expect(mapKeyEvent(key("k", { altKey: true }))).toBeNull();
  });
});

describe("keyboard adapter (web)", () => {
  it("dispatches mapped keys, prevents default, and unsubscribes", () => {
    const handler = jest.fn();
    const unsubscribe = keyboardAdapter.subscribe(handler);
    const event = key("f");
    window.dispatchEvent(event);
    expect(handler).toHaveBeenCalledWith("fullscreen");
    expect(event.defaultPrevented).toBe(true);
    unsubscribe();
    window.dispatchEvent(key("f"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores keys typed into inputs, textareas and contenteditable", () => {
    const handler = jest.fn();
    const unsubscribe = keyboardAdapter.subscribe(handler);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(key("k"));
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.appendChild(editable);
    editable.dispatchEvent(key("k"));
    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not prevent default for unmapped keys", () => {
    const unsubscribe = keyboardAdapter.subscribe(jest.fn());
    const event = key("x");
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    unsubscribe();
  });

  it("subscribeHover listens to mousemove on the element", () => {
    const el = document.createElement("div");
    const onHover = jest.fn();
    const unsubscribe = keyboardAdapter.subscribeHover({ getElement: () => el }, onHover);
    el.dispatchEvent(new MouseEvent("mousemove"));
    expect(onHover).toHaveBeenCalledTimes(1);
    unsubscribe();
    el.dispatchEvent(new MouseEvent("mousemove"));
    expect(onHover).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure** (both projects).

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/platform/keyboard.native.ts
import type { KeyboardAdapter } from "./types";

const noop = () => undefined;

export const keyboardAdapter: KeyboardAdapter = {
  subscribe: () => noop,
  subscribeHover: () => noop,
};
```

```ts
// components/VideoPlayer/platform/keyboard.web.ts
// Keyboard map: docs/player/05-platform-adapters-spec.md §3
import type { KeyboardAdapter, PlayerKey } from "./types";

const PLAIN_KEYS: Readonly<Record<string, PlayerKey>> = {
  " ": "togglePlay",
  k: "togglePlay",
  f: "fullscreen",
  m: "mute",
  Escape: "exit",
  ArrowLeft: "seekBack5",
  ArrowRight: "seekForward5",
  j: "seekBack10",
  l: "seekForward10",
  c: "captions",
  "0": "seekPercent0",
  "1": "seekPercent1",
  "2": "seekPercent2",
  "3": "seekPercent3",
  "4": "seekPercent4",
  "5": "seekPercent5",
  "6": "seekPercent6",
  "7": "seekPercent7",
  "8": "seekPercent8",
  "9": "seekPercent9",
};

const SHIFT_KEYS: Readonly<Record<string, PlayerKey>> = {
  "<": "rateDown",
  ">": "rateUp",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

export function mapKeyEvent(event: KeyboardEvent): PlayerKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.shiftKey) return SHIFT_KEYS[event.key] ?? null;
  const single = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return PLAIN_KEYS[single] ?? PLAIN_KEYS[event.key] ?? null;
}

export const keyboardAdapter: KeyboardAdapter = {
  subscribe(handler) {
    if (typeof window === "undefined") return () => undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const mapped = mapKeyEvent(event);
      if (mapped === null) return;
      event.preventDefault();
      handler(mapped);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  },
  subscribeHover(target, onHover) {
    const element = target.getElement();
    if (!(typeof HTMLElement !== "undefined" && element instanceof HTMLElement)) return () => undefined;
    element.addEventListener("mousemove", onHover);
    return () => element.removeEventListener("mousemove", onHover);
  },
};
```

```ts
// components/VideoPlayer/platform/keyboard.ts
export * from "./keyboard.native";
```

Note: `keyboard.ts` re-exports the native file, so `mapKeyEvent` is only reachable via the explicit `.web` import (tests) or on web bundles. The composition root imports `keyboardAdapter` only.

- [ ] **Step 4: Run and commit**

```bash
git add components/VideoPlayer/platform/keyboard.* __tests__/player/platform/keyboard.*
git commit -m "feat(player): add keyboard adapter with web shortcut map and hover

Verified: npm test -- --testPathPattern=platform/keyboard.native => 2 passed
Verified: npm run test:web -- --testPathPattern=platform/keyboard.web => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Picture-in-picture adapter and iOS background audio mode

**Files:**
- Create: `platform/pictureInPicture.native.ts`, `platform/pictureInPicture.web.ts`, `platform/pictureInPicture.ts`
- Modify: `app.json` (`expo.ios.infoPlist.UIBackgroundModes`)
- Test: `__tests__/player/platform/pictureInPicture.native.test.ts`, `__tests__/player/platform/pictureInPicture.web.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/pictureInPicture.native.test.ts
import { Platform } from "react-native";
import { createPictureInPictureAdapter } from "../../../components/VideoPlayer/platform/pictureInPicture.native";

describe("picture-in-picture adapter (native)", () => {
  const original = { OS: Platform.OS, Version: Platform.Version };
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: original.OS, configurable: true });
    Object.defineProperty(Platform, "Version", { value: original.Version, configurable: true });
  });
  function setPlatform(os: string, version: number | string) {
    Object.defineProperty(Platform, "OS", { value: os, configurable: true });
    Object.defineProperty(Platform, "Version", { value: version, configurable: true });
  }

  it("is supported on iOS 14+ and Android 26+ only", () => {
    setPlatform("ios", "14.0");
    expect(createPictureInPictureAdapter().isSupported()).toBe(true);
    setPlatform("ios", "13.7");
    expect(createPictureInPictureAdapter().isSupported()).toBe(false);
    setPlatform("android", 26);
    expect(createPictureInPictureAdapter().isSupported()).toBe(true);
    setPlatform("android", 25);
    expect(createPictureInPictureAdapter().isSupported()).toBe(false);
  });

  it("start/stop call the view methods; missing view fails", async () => {
    const view = { startPictureInPicture: jest.fn().mockResolvedValue(undefined), stopPictureInPicture: jest.fn().mockResolvedValue(undefined) };
    const adapter = createPictureInPictureAdapter();
    await expect(adapter.start(view)).resolves.toEqual({ ok: true });
    await expect(adapter.stop(view)).resolves.toEqual({ ok: true });
    await expect(adapter.start({})).resolves.toEqual({ ok: false, reason: "no-view" });
  });

  it("maps a rejected start to fail(name)", async () => {
    const view = { startPictureInPicture: jest.fn().mockRejectedValue(new Error("x")) };
    await expect(createPictureInPictureAdapter().start(view)).resolves.toEqual({ ok: false, reason: "Error" });
  });

  it("subscribe is a no-op on native", () => {
    const unsubscribe = createPictureInPictureAdapter().subscribe({}, jest.fn());
    expect(typeof unsubscribe).toBe("function");
  });
});
```

```ts
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
```

- [ ] **Step 2: Run to confirm failure** (both projects).

- [ ] **Step 3: Implement**

```ts
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
```

```ts
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
```

```ts
// components/VideoPlayer/platform/pictureInPicture.ts
export * from "./pictureInPicture.native";
```

- [ ] **Step 4: iOS background audio mode for PiP**

In `app.json`, change:
```json
"ios": {
  "supportsTablet": true
},
```
to:
```json
"ios": {
  "supportsTablet": true,
  "infoPlist": {
    "UIBackgroundModes": ["audio"]
  }
},
```
Run: `npx expo-doctor` → no new issues. This is configuration only (no native code, no prebuild).

- [ ] **Step 5: Run and commit**

```bash
git add components/VideoPlayer/platform/pictureInPicture.* __tests__/player/platform/pictureInPicture.* app.json
git commit -m "feat(player): add picture-in-picture adapter; enable iOS audio background mode for PiP

Verified: npm test -- --testPathPattern=platform/pictureInPicture.native => 4 passed
Verified: npm run test:web -- --testPathPattern=platform/pictureInPicture.web => 4 passed
Verified: npx expo-doctor => no issues

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Brightness adapter

**Files:**
- Create: `platform/brightness.native.ts`, `platform/brightness.web.ts`, `platform/brightness.ts`
- Test: `__tests__/player/platform/brightness.native.test.ts`, `__tests__/player/platform/brightness.web.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/brightness.native.test.ts
import * as Brightness from "expo-brightness";
import { createBrightnessAdapter } from "../../../components/VideoPlayer/platform/brightness.native";

const getBrightnessAsync = Brightness.getBrightnessAsync as jest.Mock;
const setBrightnessAsync = Brightness.setBrightnessAsync as jest.Mock;

describe("brightness adapter (native)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBrightnessAsync.mockResolvedValue(0.5);
  });

  it("get reads the level and remembers the first value", async () => {
    const adapter = createBrightnessAdapter();
    await expect(adapter.get()).resolves.toBe(0.5);
    getBrightnessAsync.mockResolvedValue(0.9);
    await adapter.get();
    await adapter.restore();
    expect(setBrightnessAsync).toHaveBeenLastCalledWith(0.5);
  });

  it("set clamps to 0..1", async () => {
    const adapter = createBrightnessAdapter();
    await expect(adapter.set(1.7)).resolves.toEqual({ ok: true });
    expect(setBrightnessAsync).toHaveBeenLastCalledWith(1);
    await adapter.set(-3);
    expect(setBrightnessAsync).toHaveBeenLastCalledWith(0);
  });

  it("restore without a prior get is a no-op success", async () => {
    await expect(createBrightnessAdapter().restore()).resolves.toEqual({ ok: true });
    expect(setBrightnessAsync).not.toHaveBeenCalled();
  });

  it("maps failures", async () => {
    setBrightnessAsync.mockRejectedValueOnce(new Error("denied"));
    await expect(createBrightnessAdapter().set(0.3)).resolves.toEqual({ ok: false, reason: "Error" });
    getBrightnessAsync.mockRejectedValueOnce(new Error("x"));
    await expect(createBrightnessAdapter().get()).resolves.toBe(1);
  });
});
```

```ts
// __tests__/player/platform/brightness.web.test.ts
import { createBrightnessAdapter } from "../../../components/VideoPlayer/platform/brightness.web";

describe("brightness adapter (web)", () => {
  it("applies a CSS brightness filter to the attached element and restores it", async () => {
    const el = document.createElement("div");
    const adapter = createBrightnessAdapter();
    adapter.attach({ getElement: () => el });
    await expect(adapter.get()).resolves.toBe(1);
    await expect(adapter.set(0.4)).resolves.toEqual({ ok: true });
    expect(el.style.filter).toBe("brightness(0.4)");
    await expect(adapter.get()).resolves.toBe(0.4);
    await adapter.restore();
    expect(el.style.filter).toBe("");
  });

  it("set without an attached element fails", async () => {
    await expect(createBrightnessAdapter().set(0.5)).resolves.toEqual({ ok: false, reason: "no-element" });
  });
});
```

- [ ] **Step 2: Run to confirm failure** (both projects).

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/platform/brightness.native.ts
// App-window brightness (no permission needed). expo-brightness is imported only here (ADR 0010).
import * as Brightness from "expo-brightness";
import { clamp } from "../engine/pure/clamp";
import { fail, ok, reasonOf, type BrightnessAdapter } from "./types";

export function createBrightnessAdapter(): BrightnessAdapter {
  let initial: number | undefined;
  return {
    attach: () => undefined,
    async get() {
      try {
        const level = await Brightness.getBrightnessAsync();
        if (initial === undefined) initial = level;
        return level;
      } catch {
        return 1;
      }
    },
    async set(level) {
      try {
        await Brightness.setBrightnessAsync(clamp(level, 0, 1));
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
    async restore() {
      if (initial === undefined) return ok;
      try {
        await Brightness.setBrightnessAsync(initial);
        return ok;
      } catch (error) {
        return fail(reasonOf(error));
      }
    },
  };
}

export const brightnessAdapter: BrightnessAdapter = createBrightnessAdapter();
```

Note: `platform/` importing `engine/pure/clamp` is allowed (pure helper, no cycle). If you prefer zero cross-folder imports, inline `Math.min(1, Math.max(0, level))`; either satisfies the rules.

```ts
// components/VideoPlayer/platform/brightness.web.ts
import { clamp } from "../engine/pure/clamp";
import { fail, ok, type BrightnessAdapter, type ElementTarget } from "./types";

export function createBrightnessAdapter(): BrightnessAdapter {
  let target: ElementTarget | null = null;
  let level = 1;
  const element = (): HTMLElement | null => {
    const value = target?.getElement();
    return typeof HTMLElement !== "undefined" && value instanceof HTMLElement ? value : null;
  };
  return {
    attach(next) {
      target = next;
    },
    async get() {
      return level;
    },
    async set(next) {
      const el = element();
      if (!el) return fail("no-element");
      level = clamp(next, 0, 1);
      el.style.filter = `brightness(${level})`;
      return ok;
    },
    async restore() {
      const el = element();
      if (el) el.style.filter = "";
      level = 1;
      return ok;
    },
  };
}

export const brightnessAdapter: BrightnessAdapter = createBrightnessAdapter();
```

```ts
// components/VideoPlayer/platform/brightness.ts
export * from "./brightness.native";
```

- [ ] **Step 4: Run and commit**

```bash
git add components/VideoPlayer/platform/brightness.* __tests__/player/platform/brightness.*
git commit -m "feat(player): add brightness adapter (expo-brightness native, CSS filter web)

Verified: npm test -- --testPathPattern=platform/brightness.native => 4 passed
Verified: npm run test:web -- --testPathPattern=platform/brightness.web => 2 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Haptics adapter

**Files:**
- Create: `platform/haptics.native.ts`, `platform/haptics.web.ts`, `platform/haptics.ts`
- Test: `__tests__/player/platform/haptics.native.test.ts`, `__tests__/player/platform/haptics.web.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/player/platform/haptics.native.test.ts
import * as Haptics from "expo-haptics";
import { hapticsAdapter } from "../../../components/VideoPlayer/platform/haptics.native";

describe("haptics adapter (native)", () => {
  it("fires a light impact and swallows rejections", async () => {
    const impact = Haptics.impactAsync as jest.Mock;
    impact.mockRejectedValueOnce(new Error("no haptics"));
    expect(() => hapticsAdapter.light()).not.toThrow();
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    await Promise.resolve();
  });
});
```

```ts
// __tests__/player/platform/haptics.web.test.ts
import { hapticsAdapter } from "../../../components/VideoPlayer/platform/haptics.web";

describe("haptics adapter (web)", () => {
  it("is a no-op", () => expect(() => hapticsAdapter.light()).not.toThrow());
});
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement**

```ts
// components/VideoPlayer/platform/haptics.native.ts
import * as Haptics from "expo-haptics";
import type { HapticsAdapter } from "./types";

export const hapticsAdapter: HapticsAdapter = {
  light() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
};
```

```ts
// components/VideoPlayer/platform/haptics.web.ts
import type { HapticsAdapter } from "./types";

export const hapticsAdapter: HapticsAdapter = { light: () => undefined };
```

```ts
// components/VideoPlayer/platform/haptics.ts
export * from "./haptics.native";
```

- [ ] **Step 4: Run and commit**

```bash
git add components/VideoPlayer/platform/haptics.* __tests__/player/platform/haptics.*
git commit -m "feat(player): add haptics adapter

Verified: npm test -- --testPathPattern=platform/haptics.native => 1 passed
Verified: npm run test:web -- --testPathPattern=platform/haptics.web => 1 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Barrel, fake adapters, invariant R4, gate, report

**Files:**
- Create: `components/VideoPlayer/platform/index.ts`
- Create: `__tests__/player/fakes/fakeAdapters.ts`
- Modify: `__tests__/player/invariants.test.ts` (`ACTIVE_RULES` adds `"R4"`)
- Create: `docs/superpowers/plans/2026-09-16-video-player-03-report.md`

**Interfaces:**
- Produces: `import { fullscreenAdapter, orientationAdapter, systemChromeAdapter, keyboardAdapter, pictureInPictureAdapter, brightnessAdapter, hapticsAdapter } from "../platform"` for Increment 4; `createFakeAdapters()` for root tests.

- [ ] **Step 1: Barrel**

```ts
// components/VideoPlayer/platform/index.ts
// The only import path consumers use. Metro resolves the platform file per target.
export { fullscreenAdapter } from "./fullscreen";
export { orientationAdapter } from "./orientation";
export { systemChromeAdapter } from "./systemChrome";
export { keyboardAdapter } from "./keyboard";
export { pictureInPictureAdapter } from "./pictureInPicture";
export { brightnessAdapter } from "./brightness";
export { hapticsAdapter } from "./haptics";
export * from "./types";
```

- [ ] **Step 2: Fake adapters for later root tests**

```ts
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
```

- [ ] **Step 3: Activate R4**

In `__tests__/player/invariants.test.ts`:
```ts
const ACTIVE_RULES: readonly RuleId[] = ["R1", "R2", "R3", "R4", "R6", "R7", "OLD_ROOT_FROZEN"];
```
Run: `npm test -- --testPathPattern=invariants` → 7 passed, 2 skipped. (R4 exempts `/platform/`, and only `pictureInPicture.native.ts` reads `Platform`.)

- [ ] **Step 4: Gate**

```bash
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -6
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx expo-doctor
```
Expected: all green; tsc count unchanged from Increment 1; if `tsc` cannot resolve `"./fullscreen"`-style imports, confirm every `<name>.ts` fallback exists.

- [ ] **Step 5: Report**

Create `docs/superpowers/plans/2026-09-16-video-player-03-report.md`:

```markdown
# Increment 2 — Platform Adapters Report

Date: <date>  Branch: feature/player-2-platform

## Gate
- npm test: <N> suites, <N> tests
- npm run test:web: <N> suites, <N> tests
- npm run lint: <N> errors, <N> warnings
- npx tsc --noEmit: <N> errors (pre-existing only)
- npx expo-doctor: <output>
- invariants: R1-R4, R6, R7, OLD_ROOT_FROZEN passing

## Platform notes
- PiP support gates: iOS >= 14, Android API >= 26 (version check only; runtime verification is a manual matrix row M19).
- app.json: ios.infoPlist.UIBackgroundModes = ["audio"] added for PiP continuity.
- Module resolution: <"tsc resolved suffix-less imports via fallback .ts files" | other>
- jest web preset used: <jest-expo/web | jest-expo + haste web>

## Not done
- Android immersive navigation bar (open item O4) — not implemented by design.
```

- [ ] **Step 6: Commit**

```bash
git add components/VideoPlayer/platform/index.ts __tests__/player/fakes/fakeAdapters.ts __tests__/player/invariants.test.ts docs/superpowers/plans/2026-09-16-video-player-03-report.md
git commit -m "feat(player): add platform barrel and fake adapters; activate invariant R4; Increment 2 report

Verified: npm test => <N> suites passed
Verified: npm run test:web => <N> suites passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Increment 2 exit criteria: §3.2 tests green on both projects, R4 active, PiP notes recorded. Merge to `main`; Increment 3 branches from `main`.
