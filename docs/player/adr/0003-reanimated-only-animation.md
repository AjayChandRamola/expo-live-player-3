# ADR 0003 — Reanimated 4 is the only animation library in the player

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | section 2, section 6 |

## Context

The player folder uses three animation mechanisms: React Native's legacy `Animated` (`PlayPauseButton`, `PreviousVideoButton`, `NextVideoButton`, `MinimizeButton`, `AutoplayNotification`, `usePlayPauseController`), Reanimated (`VideoActionButton`, `VideoDownloadModal`), and `react-native-paper`'s `IconButton` with its own ripple (`AutoplayToggle`, `FullscreenButton`). `react-native-paper` is imported nowhere else in the app (verified by grep on 2026-09-16). `react-native-reanimated ~4.1.1` and `react-native-worklets 0.5.1` are already installed and initialised in `app/_layout.tsx`.

## Decision

All motion inside `components/VideoPlayer/` uses Reanimated 4: `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`. Controls visibility is one shared value driving opacity on the UI thread. RN `Animated` and `react-native-paper` are not imported anywhere under `components/VideoPlayer/`.

`react-native-paper` stays in `package.json` for now. Removing a dependency is a separate decision (spec open item O3) because it touches the lockfile and the Expo doctor baseline.

## Alternatives considered

1. **Legacy `Animated` only.** Rejected: JS-thread driven; control fades would compete with `timeUpdate` handling on low-end devices.
2. **Keep the mix.** Rejected: inconsistent motion curves, three mental models, larger bundle.

## Consequences

- Positive: UI-thread animations (P7 target), one primitive `ControlButton` with one press animation, smaller bundle.
- Negative: Reanimated requires the Babel plugin and mocks in Jest; jest-expo already provides `react-native-reanimated/mock` handling, and the test plan documents the setup.

## Verification

- Invariant R5: `grep -rn "from \"react-native-paper\"\|Animated\." components/VideoPlayer | grep -v reanimated` is empty.
