
# Video Player Engineering Rules

## 1. Protected Module
- The existing VideoPlayer is working and must be preserved.
- Read the relevant source before modifying the player.
- Understand its props, callbacks, state, controls, and lifecycle.
- Do not rewrite or replace the player without explicit approval.
- Do not create a second generic playback implementation.
- Do not duplicate playback logic in screens.
- Preserve MP4 and HLS playback.
- Preserve play/pause, mute, seek, buffering, loading, errors, fullscreen, and orientation behavior.
- Preserve advanced features unless the task explicitly changes them.
- Keep Shorts player decisions separate; do not automatically merge them with VideoPlayer.

## 2. Playback & Media Behavior
- Handle playback states explicitly: idle, loading, ready, playing, paused, buffering, ended, and error.
- Handle invalid sources, unsupported formats, network failures, and playback errors gracefully.
- Preserve playback position, volume, playback rate, and relevant state across lifecycle changes where required.
- Handle live streams, VOD, replay, and end-of-stream behavior according to requirements.
- Prevent conflicting playback sessions and unintended simultaneous playback.
- Ensure controls, gestures, seeking, and orientation behave consistently across supported devices.

## 3. Architecture & Ownership
- Keep player mechanics separate from application and domain operations.
- Keep catalog/content state separate from playback state.
- Define explicit ownership for Save, Like, Share, Thanks, Download, and other actions.
- Keep playback state, UI state, and server-persisted state distinct.
- Do not move business logic into the player without justification.
- Do not assume UI existence means end-to-end functionality is production-ready.

## 4. Reliability & Lifecycle
- Handle player mount, unmount, source changes, background, foreground, and orientation transitions safely.
- Release media resources and subscriptions when no longer needed.
- Prevent stale callbacks, duplicate listeners, race conditions, and conflicting source updates.
- Handle network interruptions, retries, and recovery without corrupting playback state.
- Avoid unexpected playback, audio, or resource leaks.

## 5. Change Workflow
1. Inspect exact source and all consumers.
2. Document current behavior and public API.
3. Identify risks and affected modules.
4. Propose the smallest safe change.
5. Implement incrementally.
6. Test playback, errors, lifecycle, and regressions.
7. Review git diff and report limitations.

## 6. Verification & Production Readiness
- Test MP4, HLS, live streams, VOD, loading, buffering, errors, seeking, and replay where applicable.
- Test controls, fullscreen, orientation, background/foreground, and unmount behavior.
- Verify behavior on supported Android and iOS devices.
- Treat Download, PiP, quality selection, Like, and Save as requiring production verification where applicable.
- Verify real media behavior, not just rendered UI.
- Any refactor requires reason, impact, tests, and rollback consideration.

## 7. Architecture (2026-09-16 redesign)

See `docs/player/03-architecture.md` for the full design. Dependency rules, enforced by `__tests__/player/invariants.test.ts`:

- **R1**: only `VideoPlaybackContainer` imports `components/VideoPlayer`.
- **R2**: the player imports no app contexts/services/hooks/app code at runtime.
- **R3**: only the engine and `PlayerSurface` import `expo-video`.
- **R4**: no `Platform.OS` / `Platform.select` outside `platform/`.
- **R5**: no legacy `Animated` or `react-native-paper` in the player.
- **R6**: no `any` in the player.
- **R7**: Shorts and `useShortsPlayer` are unchanged from main.
- **R9**: file line budgets, and `setInterval`/`setTimeout` confined to `engine`, `gestures`, `hooks`, and `ui/BufferingIndicator.tsx` (with `setInterval` itself limited to `hooks/useEndScreenCountdown.ts`).

Only the container imports the player. The player never imports contexts, services, hooks or app code. Only the engine and PlayerSurface import expo-video. No `Platform.OS` above `platform/`. Reanimated is the only animation library. No `any`. Shorts unchanged. File budgets apply.