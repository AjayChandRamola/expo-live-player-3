# ADR 0004 — In-place fullscreen without a Modal

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | section 6.1, section 7 |

## Context

Today `index.tsx:896` renders a second `Modal` when fullscreen on native, which unmounts and remounts `VideoView`. To hide the gap, the code saves position and playing state, then restores them in a `setTimeout(…, 200)` (`index.tsx:407`, `:463`). This produces a black flash, a position jump, and a race when the player is buffering. expo-video also offers `VideoView.enterFullscreen()`, which uses the platform's native fullscreen presenter with native controls.

## Decision

Fullscreen is a layout mode of the same component tree. The composition root switches the container style to absolute, full-window, high z-index; the `VideoView` element keeps the same key and parent and never remounts. The `FullscreenAdapter` (native) only tracks the flag and emits; `OrientationAdapter` locks landscape; `SystemChromeAdapter` hides the status bar. On web, `FullscreenAdapter` calls `requestFullscreen()` on the container element and mirrors `fullscreenchange`.

`VideoView.enterFullscreen()` is not used because it shows native controls, which conflicts with the custom overlay and with web parity.

## Alternatives considered

1. **Keep the Modal.** Rejected: remount is the root cause of D5.
2. **expo-video native fullscreen.** Rejected: native controls, no custom overlay, different UI per platform.
3. **A separate fullscreen route via Expo Router.** Rejected: navigation would unmount the player.

## Consequences

- Positive: continuous playback across the transition; no restore timers; simpler code.
- Negative: the absolute layout must sit above the screen's other content; the screen already hides `VideoMeta` and `UpNextList` when `isFullscreen` (see `app/video/[id].tsx`), and the z-index token is set high enough to cover the tab bar. Android hardware back must be intercepted with `BackHandler` in the composition root to exit fullscreen.

## Verification

- Root test asserts that the `VideoView` test node identity is the same before and after toggling fullscreen.
- Manual matrix rows: rotate during playback, position continuous, no black flash.
