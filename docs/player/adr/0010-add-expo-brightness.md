# ADR 0010 — Add expo-brightness for the brightness swipe gesture

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 (human approved in brainstorming) |
| Spec | F23, section 7 |

## Context

The brightness swipe gesture (left half of the surface) needs to read and set the app window brightness. No installed package does this. `expo-brightness` is an Expo SDK module; for SDK 54 the compatible line is 14.0.x (`npm view expo-brightness` on 2026-09-16 lists 14.0.6 to 14.0.8; `npx expo install expo-brightness` picks the SDK-matched version). It works in the managed workflow with no config plugin; app-window brightness needs no permission on iOS or Android (system brightness would need `WRITE_SETTINGS` and is not used).

## Decision

Install with `npx expo install expo-brightness` in Increment 0. Use only `getBrightnessAsync` and `setBrightnessAsync` (app-window scope) inside `platform/brightness.native.ts`. Record the initial value on first read and restore it when the player unmounts or leaves fullscreen, so the device is never left dimmed.

## Alternatives considered

1. **Web-only brightness via CSS filter and no native brightness.** Rejected: the gesture is most useful on phones.
2. **Overlay a translucent black view to simulate dimming.** Rejected: cannot brighten, wastes GPU, fake.

## Consequences

- Positive: standard gesture parity with mainstream players.
- Negative: one new dependency; `npx expo-doctor` must remain clean; the Jest setup mocks `expo-brightness`.

## Verification

- `package.json` shows `expo-brightness` in the 14.0.x line; `npx expo-doctor` passes.
- `__tests__/player/platform/brightness.test.ts`: set clamps to 0..1, restore returns to the initial value.
