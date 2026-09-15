# Increment 0B — Player Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first.** Complete Increment 0A before starting: every task here is test-first and `npm test` does not work until 0A lands.

**Goal:** Make the existing `components/VideoPlayer` type-clean and free of its latent runtime defect, without changing any playback behavior.

**Architecture:** Fix in place. No file is restructured, no prop is added to the public surface, no control is redesigned. The component's rendered output and behavior must be identical before and after, except that unverified actions become hidden behind flags.

**Tech Stack:** TypeScript 5.9 strict, expo-video 3.0.11, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, ADR 9 and section M.

## Scope discipline

The user has stated the player has broader design, functional, and performance problems that will be fixed later. **This increment is not that work.** It fixes only what blocks the project's own quality gate: type errors, one latent crash, and UI for features that do not work. Everything else goes to the HLD's section M list untouched.

**Do not** refactor the controls, change the layout, rename a file, split a component, or "improve" anything you were not told to touch here.

---

## Stop and Read: Conflict Requiring Human Approval

**D4 — Eleven files in `components/VideoPlayer/` are unreachable dead code, but CLAUDE.md names six of them as part of the authoritative player structure.**

CLAUDE.md section 1 says the player "is composed of many focused files (`index.tsx`, `Controls.tsx`, `hooks/useVideoPlayer.ts`, `modals/`, `tokens.ts`, `styles.ts`, `types.ts`, `utils.ts`, etc.) — do not collapse this into a single file."

An import-graph reachability analysis from the Expo Router entry points under `app/` proves otherwise. The live player tree rooted at `components/VideoPlayer/index.tsx` reaches only: `PlayPauseButton`, `PreviousVideoButton`, `NextVideoButton`, `MinimizeButton`, `AutoplayToggle`, `AutoplayNotification`, `FullscreenButton`, `usePlayPauseController`, `VideoProgressBar`, `VideoTimeOverlay`, `VideoActionBar` (which reaches `VideoActionButton`), and the five files under `modals/`.

These eleven are reachable from nothing:

| File | Named in CLAUDE.md? | Type errors it contributes |
|---|---|---|
| `Controls.tsx` | Yes | 7 |
| `ControlsWithNavigation.example.tsx` | No | 7 |
| `hooks/useVideoPlayer.ts` | Yes | 1 (imports uninstalled expo-av) |
| `types.ts` | Yes | 0 |
| `tokens.ts` | Yes | 0 |
| `styles.ts` | Yes | 0 |
| `utils.ts` | Yes | 0 |
| `VideoView.tsx` | No | 0 |
| `NavigationButtons.ts` | No | 0 |
| `AutoplayToggleDemo.tsx` | No | 0 (2 lint errors) |
| `YouTubeControlsDemo.tsx` | No | 0 |

Together they account for **15 of the 68 project type errors** and **3 of the 8 lint errors**, none of which affect anything the app runs.

Per CLAUDE.md section 2.1, a conflict between the rules and the source is flagged, not silently resolved. **Task 7 is therefore gated: do not start it until a human answers.** Tasks 1 through 6 are unaffected and should proceed.

The question for the human is: *delete the eleven unreachable files, or keep them and accept that the repo cannot reach a zero-error type gate?* A middle option is moving them to `docs/history/videoplayer-unused/` so they remain readable but leave the TypeScript project.

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- **Behavior must not change.** If a fix would alter what a user sees or how playback behaves, stop and report instead.
- **The public prop surface is frozen.** Tasks here may add the four already-destructured props to the `Props` *type*. They may not add a new prop.
- No change to `components/Shorts/`.

## Verified Starting State

```
npx tsc --noEmit                 68 errors  (12 in VideoPlayer/index.tsx)
npx eslint . --ext .js,.jsx,.ts,.tsx    8 errors, 421 warnings
npm test                         passes (after Increment 0A)
```

The twelve errors in `components/VideoPlayer/index.tsx`:

| Line | Code | Problem |
|---|---|---|
| 112, 113, 114, 115 | TS2339 | `videoId`, `videoTitle`, `videoUrl`, `channelId` destructured but absent from `Props` |
| 173 | TS2448, TS2454 | `isPlaying` read at line 173, declared at line 207 |
| 250 | TS2869 | `??` right operand unreachable, caused by operator precedence |
| 768 | TS2322 | `touchableStyle` object not assignable to `StyleProp<ViewStyle>` |
| 772 | TS2769 | No overload matches, consequence of the line 768 style typing |
| 774 | TS2367 | `resizeMode === "cover"` can never be true |
| 1010 | TS2322, TS7006 | `onDontRecommendChannel` handler takes an argument the prop type does not provide |

---

### Task 1: Characterization test that exposes the latent crash

**Files:**
- Create: `__tests__/player/VideoPlayer.render.test.tsx`

**Interfaces:**
- Consumes: `components/VideoPlayer` default export.
- Produces: a regression test every later task must keep green. Increment 3 reuses the `expo-video` mock written here.

**Why first:** line 173 reads `isPlaying` before its `const` declaration on line 207. In JavaScript that is a temporal dead zone access, which throws `ReferenceError: Cannot access 'isPlaying' before initialization` the moment the component renders. TypeScript reports it as TS2448. A test that renders the component turns a compiler complaint into proof.

- [ ] **Step 1: Write the failing test**

Create `__tests__/player/VideoPlayer.render.test.tsx`:

```tsx
// __tests__/player/VideoPlayer.render.test.tsx
// Characterization tests for the existing VideoPlayer.
// These lock in current behavior so stabilization cannot change it.
import React from "react";
import { render, screen } from "@testing-library/react-native";
import VideoPlayer from "../../components/VideoPlayer";

// expo-video drives native playback, which does not exist under Jest.
// This mock gives the component a player object shaped like the real one.
jest.mock("expo-video", () => {
  const React = require("react");
  return {
    useVideoPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      replace: jest.fn(),
      playing: false,
      muted: false,
      loop: false,
      currentTime: 0,
      duration: 100,
      playbackRate: 1,
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeAllListeners: jest.fn(),
      release: jest.fn(),
    })),
    VideoView: (props: Record<string, unknown>) =>
      React.createElement("VideoView", { testID: "expo-video-view", ...props }),
  };
});

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: {
    PORTRAIT_UP: "PORTRAIT_UP",
    LANDSCAPE_RIGHT: "LANDSCAPE_RIGHT",
  },
}));

const MP4 = "https://example.test/video.mp4";

describe("VideoPlayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders without throwing", () => {
    expect(() => render(<VideoPlayer sourceUrl={MP4} />)).not.toThrow();
  });

  it("mounts the expo-video surface", () => {
    render(<VideoPlayer sourceUrl={MP4} />);
    expect(screen.getByTestId("expo-video-view")).toBeTruthy();
  });

  it("accepts the full documented prop surface without a type or runtime error", () => {
    expect(() =>
      render(
        <VideoPlayer
          sourceUrl={MP4}
          autoplay={false}
          hasPreviousVideo
          hasNextVideo
          onNavigateToPrevious={jest.fn()}
          onNavigateToNext={jest.fn()}
          isMinimized={false}
          onToggleMinimize={jest.fn()}
          onFullscreenChange={jest.fn()}
          isAutoplayEnabled
          onVideoFinished={jest.fn()}
          videoId="v1"
          videoTitle="Gayatri Yagya"
          videoUrl={MP4}
          channelId="c1"
        />,
      ),
    ).not.toThrow();
  });

  it("renders an HLS source the same way as MP4", () => {
    expect(() =>
      render(<VideoPlayer sourceUrl="https://example.test/stream.m3u8" videoId="v2" />),
    ).not.toThrow();
  });
});
```

Note on the mock: `VideoView` is mocked as a host component named `"VideoView"` carrying a `testID`, because the real one renders a native view that Jest cannot instantiate. The `useVideoPlayer` mock returns the subset of the player object that `index.tsx` actually reads: `play`, `pause`, `playing`, `muted`, `loop`, `currentTime`, `duration`, and `playbackRate`. If a later change makes the component read another property, add it here rather than loosening the test.

- [ ] **Step 2: Run the test to confirm the crash is real**

Run:
```bash
npm test -- --testPathPattern=VideoPlayer.render
```
Expected: failures mentioning `Cannot access 'isPlaying' before initialization`.

If instead every test passes, the temporal dead zone is being masked (for example by a Babel transform). Record that in the task notes and continue: Task 3 still has to run, because the TypeScript error blocks the gate either way.

- [ ] **Step 3: Commit the failing test**

```bash
git add __tests__/player/VideoPlayer.render.test.tsx
git commit -m "test: add characterization tests for VideoPlayer

Documents current render behavior before stabilization. Currently failing:
isPlaying is read at index.tsx:173 but declared at :207, a temporal dead
zone access that TypeScript reports as TS2448.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Add the four missing props to the `Props` type

**Files:**
- Modify: `components/VideoPlayer/index.tsx` (the `Props` type at lines 58-80)

**Interfaces:**
- Produces: the frozen prop surface recorded in LLD index section 5.9, now type-checked. `VideoPlaybackContainer` in Increment 3 depends on these four being typed.

**Why:** lines 112-115 destructure `videoId`, `videoTitle`, `videoUrl`, and `channelId`, but the `Props` type never declared them. Any caller passing them fails to type-check, which is exactly what `app/video/[id].tsx` does today.

- [ ] **Step 1: Add the properties**

In `components/VideoPlayer/index.tsx`, find the `Props` type that ends at line 80 with `};`. Immediately before that closing brace, after the existing `theme?: string;` line, add:

```ts
  // Video metadata — consumed by the action bar, share sheet, and overflow menu.
  // videoId must be a non-empty string for the action bar and progress bar to render
  // (see the guards at the `!isFullscreen && !isMinimized && videoId` conditions below).
  videoId?: string;
  videoTitle?: string;
  videoUrl?: string;
  channelId?: string;
```

Change nothing else in the type.

- [ ] **Step 2: Verify those four errors are gone**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "VideoPlayer/index.tsx" | grep -c "TS2339"
```
Expected: `0` (was 4).

- [ ] **Step 3: Confirm tests still behave the same**

Run:
```bash
npm test -- --testPathPattern=VideoPlayer.render
```
Expected: still failing on `isPlaying`, which Task 3 fixes. No new failure kind.

- [ ] **Step 4: Commit**

```bash
git add components/VideoPlayer/index.tsx
git commit -m "fix(player): declare videoId, videoTitle, videoUrl, channelId in Props

These four were destructured at index.tsx:112-115 but missing from the
Props type, so any caller passing them failed to type-check.

Verified: TS2339 count in VideoPlayer/index.tsx 4 => 0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Fix the temporal dead zone crash

**Files:**
- Modify: `components/VideoPlayer/index.tsx` (move the declaration currently at line 207)

**Interfaces:**
- Produces: a component that renders. Every later task and increment depends on this.

- [ ] **Step 1: Confirm the test still fails**

Run:
```bash
npm test -- --testPathPattern=VideoPlayer.render
```
Expected: still red on `isPlaying`.

- [ ] **Step 2: Move the declaration above its first use**

Find this line, currently at line 207, in the block commented `// Track playback status`:

```ts
  const [isPlaying, setIsPlaying] = useState(autoplay);
```

Cut it. Paste it **above** the `useVideoProgress` call that begins at line 171, so the order becomes:

```ts
  // Track playback status. Declared before useVideoProgress because that hook
  // reads isPlaying in its options object.
  const [isPlaying, setIsPlaying] = useState(autoplay);

  // Video progress tracking
  const { position, duration, buffered, isLoaded: progressLoaded, seek } = useVideoProgress({
    player,
    isPlaying: isPlaying,
  });
```

Leave `const [isLoaded, setIsLoaded] = useState(false);` where it is. Leave the `useEffect` that calls `setIsPlaying` where it is. Move only the one line.

- [ ] **Step 3: Run the tests**

Run:
```bash
npm test -- --testPathPattern=VideoPlayer.render
```
Expected: all 4 tests pass.

- [ ] **Step 4: Verify the type errors are gone**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "index.tsx(173"
```
Expected: `0` (was 2: TS2448 and TS2454).

- [ ] **Step 5: Commit**

```bash
git add components/VideoPlayer/index.tsx
git commit -m "fix(player): resolve temporal dead zone on isPlaying

isPlaying was read at index.tsx:173 by the useVideoProgress options object
but declared with const at :207, throwing ReferenceError on every render.
Moved the declaration above its first use. No behavior change intended.

Verified: npm test -- --testPathPattern=VideoPlayer.render => 4 passed
Verified: TS2448 and TS2454 at index.tsx:173 => gone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fix the remaining six type errors in `index.tsx`

**Files:**
- Modify: `components/VideoPlayer/index.tsx` (lines 250, 697-708, 749-760, 774, 1010)

**Interfaces:**
- Produces: `components/VideoPlayer/index.tsx` with zero type errors.

Each fix below is separate. Apply them in order and re-run the type check after each.

- [ ] **Step 1: Fix the operator precedence bug at line 250**

Current code inside `onVideoAreaPress`:

```ts
          const isLeft =
            typeof locX === "number"
              ? locX < (evt.currentTarget as any)?.clientWidth / 2 ?? 200
              : typeof pageX === "number"
              ? pageX < 200
              : false;
```

`??` binds looser than `<`, so this parses as `(locX < clientWidth / 2) ?? 200`. The left side is always a boolean, so the fallback is dead and the intended default width is never applied. Replace that one expression with:

```ts
          const isLeft =
            typeof locX === "number"
              ? locX < ((evt.currentTarget as any)?.clientWidth ?? 400) / 2
              : typeof pageX === "number"
              ? pageX < 200
              : false;
```

`400` is the intended half-screen default the original `?? 200` was reaching for, doubled because it now divides by two. This changes double-tap seek behavior only on the path where `clientWidth` is undefined, which previously compared against `NaN` and always produced `false`.

- [ ] **Step 2: Fix the style typing at lines 697 and 749**

Both `videoStyle` and `touchableStyle` are built as object literals whose `width: "100%"` infers as `string` rather than React Native's `DimensionValue`. Add an explicit annotation to each.

At the top of the file, extend the existing `react-native` import to include the two types:

```ts
import type { StyleProp, ViewStyle } from "react-native";
```

Then annotate both declarations:

```ts
  const videoStyle: StyleProp<ViewStyle> = isFullscreen
```

```ts
  const touchableStyle: StyleProp<ViewStyle> = isFullscreen
```

Change nothing inside either object.

- [ ] **Step 3: Fix the impossible comparison at line 774**

`resizeMode` is declared at line 718 as `isFullscreen ? "fill" : "contain"`, so its type is `"fill" | "contain"` and the `=== "cover"` branch can never run. Replace line 774:

```ts
          contentFit={resizeMode === "contain" ? "contain" : "fill"}
```

- [ ] **Step 4: Fix the overflow menu handler at line 1010**

`VideoOverflowMenu`'s prop is typed `onDontRecommendChannel?: () => void` (see `modals/VideoOverflowMenu.tsx:54`), but the handler here declares a parameter, which also makes it implicitly `any`. The `channelId` it needs is already in scope. Replace that one line:

```tsx
            onDontRecommendChannel={() => dontRecommendChannel(channelId ?? "")}
```

- [ ] **Step 5: Verify the file is clean**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "VideoPlayer/index.tsx"
```
Expected: `0` (was 12).

- [ ] **Step 6: Confirm no behavior regression**

Run:
```bash
npm test -- --testPathPattern=VideoPlayer.render
```
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add components/VideoPlayer/index.tsx
git commit -m "fix(player): clear remaining type errors in VideoPlayer index

- line 250: ?? bound looser than <, making the default width unreachable
- lines 697, 749: annotate style objects as StyleProp<ViewStyle>
- line 774: drop the resizeMode === 'cover' branch, unreachable since
  resizeMode is 'fill' | 'contain'
- line 1010: onDontRecommendChannel takes no argument; read channelId
  from scope instead

Verified: type errors in VideoPlayer/index.tsx 12 => 0
Verified: npm test -- --testPathPattern=VideoPlayer.render => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Fix the two other live player files

**Files:**
- Modify: `components/VideoPlayer/AutoplayNotification.tsx:74`
- Modify: `components/VideoPlayer/VideoProgressBar.tsx:25`

**Interfaces:**
- Produces: zero type errors across every reachable file in `components/VideoPlayer/`.

- [ ] **Step 1: Write a test for the notification's visibility rule**

Create `__tests__/player/AutoplayNotification.test.tsx`:

```tsx
// __tests__/player/AutoplayNotification.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import AutoplayNotification from "../../components/VideoPlayer/AutoplayNotification";

describe("AutoplayNotification", () => {
  it("renders its message when visible", () => {
    render(
      <AutoplayNotification visible message="Autoplay is on" onDismiss={jest.fn()} />,
    );
    expect(screen.getByText("Autoplay is on")).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    render(
      <AutoplayNotification visible={false} message="Autoplay is off" onDismiss={jest.fn()} />,
    );
    expect(screen.queryByText("Autoplay is off")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it**

Run:
```bash
npm test -- --testPathPattern=AutoplayNotification
```
Expected: both pass. They characterize the behavior the next step must preserve.

- [ ] **Step 3: Replace the private Animated API call**

Line 74 reads:

```ts
  if (!visible && fadeAnim.__getValue() === 0) {
```

`__getValue()` is a private React Native internal, absent from the public `Animated.Value` type and free to disappear in any release. Track the same fact in component state instead.

Add a ref alongside the existing animation values near the top of the component:

```ts
  const hasAnimatedOutRef = React.useRef(true);
```

In the existing `useEffect`, in the `else` branch that already resets the animations, set the ref:

```ts
    } else {
      // Reset animations when not visible
      hasAnimatedOutRef.current = true;
      fadeAnim.setValue(0);
      translateYAnim.setValue(-20);
    }
```

And in the `if (visible)` branch of that same effect, at the top, clear it:

```ts
      hasAnimatedOutRef.current = false;
```

Then replace line 74 with:

```ts
  if (!visible && hasAnimatedOutRef.current) {
```

- [ ] **Step 4: Confirm the tests still pass and the error is gone**

Run:
```bash
npm test -- --testPathPattern=AutoplayNotification
npx tsc --noEmit 2>&1 | grep -c "AutoplayNotification"
```
Expected: 2 passed, and `0` type errors.

- [ ] **Step 5: Remove the dead Reanimated import**

`components/VideoPlayer/VideoProgressBar.tsx:25` imports `useAnimatedGestureHandler`, which React Native Reanimated 4 removed. Grep confirms the file never calls it; the import alone breaks the type check.

Delete just that one line from the import block:

```diff
 import Animated, {
   useSharedValue,
   useAnimatedStyle,
-  useAnimatedGestureHandler,
   withSpring,
   runOnJS,
 } from "react-native-reanimated";
```

- [ ] **Step 6: Verify**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "VideoProgressBar"
npm test
```
Expected: `0` type errors in that file, and the whole suite green.

- [ ] **Step 7: Commit**

```bash
git add components/VideoPlayer/AutoplayNotification.tsx components/VideoPlayer/VideoProgressBar.tsx __tests__/player/AutoplayNotification.test.tsx
git commit -m "fix(player): drop private Animated API and removed Reanimated export

AutoplayNotification called the private fadeAnim.__getValue(); replaced with
a ref that tracks the same state. VideoProgressBar imported
useAnimatedGestureHandler, removed in Reanimated 4 and never called here.

Verified: npm test => all suites pass
Verified: type errors in both files => 0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Hide player actions that have no working implementation

**Files:**
- Create: `constants/config.ts` (the `PLAYER_FEATURE_FLAGS` export only; Increment 1 adds the rest)
- Modify: `components/VideoPlayer/VideoActionBar.tsx`
- Test: `__tests__/player/VideoActionBar.test.tsx`

**Interfaces:**
- Consumes: `PLAYER_FEATURE_FLAGS` from `constants/config.ts` as defined in LLD index section 5.4.
- Produces: an action bar showing only Like, Share, and Save. Increment 4 rewires Save to `SavedContext`.

**Why:** the HLD's section F.5 and CLAUDE.md section 6 both require that Download, picture-in-picture, quality selection, clips, Thanks, and Report are not presented as working until each is verified end to end. Today they render as ordinary buttons backed by in-memory stubs, which tells users a feature exists when it does not.

- [ ] **Step 1: Create the flags file**

Create `constants/config.ts` containing **only** the `PLAYER_FEATURE_FLAGS` block copied verbatim from LLD index section 5.4. Increment 1 appends `TIMING`, `LIMITS`, `STORAGE_KEYS`, `MEDIA`, `LINKS`, and `YOUTUBE_EMBED` to the same file.

- [ ] **Step 2: Write the failing test**

Create `__tests__/player/VideoActionBar.test.tsx`:

```tsx
// __tests__/player/VideoActionBar.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { VideoActionBar } from "../../components/VideoPlayer/VideoActionBar";

const baseProps = {
  videoId: "v1",
  videoTitle: "Gayatri Yagya",
  videoUrl: "https://example.test/video.mp4",
  channelId: "c1",
  isLiked: false,
  isDisliked: false,
  likeCount: 0,
  dislikeCount: 0,
  isSaved: false,
  onLike: jest.fn(),
  onDislike: jest.fn(),
  onShare: jest.fn(),
  onDownload: jest.fn(),
  onClip: jest.fn(),
  onSave: jest.fn(),
  onMore: jest.fn(),
};

describe("VideoActionBar feature gating", () => {
  it("shows the actions that work", () => {
    render(<VideoActionBar {...baseProps} />);
    expect(screen.getByLabelText(/like/i)).toBeTruthy();
    expect(screen.getByLabelText(/share/i)).toBeTruthy();
    expect(screen.getByLabelText(/save/i)).toBeTruthy();
  });

  it("hides actions that have no verified implementation", () => {
    render(<VideoActionBar {...baseProps} />);
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    expect(screen.queryByLabelText(/clip/i)).toBeNull();
    expect(screen.queryByLabelText(/dislike/i)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=VideoActionBar
```
Expected: the second test fails because Download, Clip, and Dislike currently render.

If the first test fails on a label mismatch, open `components/VideoPlayer/VideoActionBar.tsx`, read the real `accessibilityLabel` values, and correct the regular expressions in the test to match. Do not rename the component's labels.

- [ ] **Step 4: Gate the buttons**

In `components/VideoPlayer/VideoActionBar.tsx`, import the flags:

```ts
import { PLAYER_FEATURE_FLAGS } from "../../constants/config";
```

Then wrap each unverified button in a conditional. For example, where the Download button is rendered:

```tsx
{PLAYER_FEATURE_FLAGS.download && (
  <VideoActionButton ... />
)}
```

Apply the same pattern with `PLAYER_FEATURE_FLAGS.clipEditor` for Clip and `PLAYER_FEATURE_FLAGS.dislike` for Dislike. Leave Like, Share, Save, and More rendering unconditionally.

Do not delete the button code or its callbacks. Flags are reversible; deletion is not, and each of these becomes real work in a later release.

- [ ] **Step 5: Run the tests**

Run:
```bash
npm test -- --testPathPattern=VideoActionBar
```
Expected: both pass.

- [ ] **Step 6: Gate the overflow menu entries**

Open `components/VideoPlayer/modals/VideoOverflowMenu.tsx`. Wrap the Report entry in `PLAYER_FEATURE_FLAGS.report` and any quality-selection entry in `PLAYER_FEATURE_FLAGS.qualitySelection`, using the same pattern. If the menu has no such entries, record that in the task notes and move on.

- [ ] **Step 7: Verify the whole suite and the type gate**

Run:
```bash
npm test
npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: all suites pass. The error count should now be **53 or lower** (68 minus the 12 from `index.tsx`, minus 1 from `AutoplayNotification`, minus 1 from `VideoProgressBar`, minus the 2 test-import errors already cleared in Increment 0A).

- [ ] **Step 8: Commit**

```bash
git add constants/config.ts components/VideoPlayer/VideoActionBar.tsx components/VideoPlayer/modals/VideoOverflowMenu.tsx __tests__/player/VideoActionBar.test.tsx
git commit -m "feat(player): gate unverified actions behind feature flags

Download, Clip, Dislike, Report, and quality selection render UI backed by
in-memory stubs. All are now hidden behind PLAYER_FEATURE_FLAGS, which are
false for MVP, so the app stops advertising features that do not work.
Button code is retained, not deleted, so each can be enabled once verified.

Verified: npm test => all suites pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Remove unreachable player files — BLOCKED ON HUMAN APPROVAL

**Do not start this task until a human has answered the D4 question at the top of this plan.** Record their answer in the commit body.

**Files:**
- Delete or relocate: `components/VideoPlayer/Controls.tsx`, `ControlsWithNavigation.example.tsx`, `AutoplayToggleDemo.tsx`, `YouTubeControlsDemo.tsx`, `NavigationButtons.ts`, `VideoView.tsx`, `styles.ts`, `tokens.ts`, `types.ts`, `utils.ts`, `hooks/useVideoPlayer.ts`
- Move: the seven `components/VideoPlayer/*.md` files to `docs/history/videoplayer/`

- [ ] **Step 1: Re-verify unreachability yourself**

Do not trust this document. For each of the eleven files, run:

```bash
grep -rn "Controls\b" app components contexts hooks services utils __tests__ --include=*.ts --include=*.tsx | grep -v "^components/VideoPlayer/Controls.tsx"
```

Repeat with each basename. A file is safe to remove only when the sole remaining references are from other files on the removal list, or from Markdown.

If any file turns out to be reachable, **stop** and report. The analysis was wrong and the plan needs revision.

- [ ] **Step 2: Move the Markdown out of the source tree**

```bash
mkdir -p docs/history/videoplayer
git mv components/VideoPlayer/AUTOPLAY_NOTIFICATION_README.md docs/history/videoplayer/
git mv components/VideoPlayer/AUTOPLAY_TOGGLE_README.md docs/history/videoplayer/
git mv components/VideoPlayer/AUTOPLAY_TOGGLE_VISUAL_GUIDE.md docs/history/videoplayer/
git mv components/VideoPlayer/IMPLEMENTATION_SUMMARY.md docs/history/videoplayer/
git mv components/VideoPlayer/MINIMIZE_BUTTON_GUIDE.md docs/history/videoplayer/
git mv components/VideoPlayer/QUICKSTART.md docs/history/videoplayer/
git mv components/VideoPlayer/VISUAL_OVERVIEW.md docs/history/videoplayer/
git mv components/VideoPlayer/YOUTUBE_CONTROLS_README.md docs/history/videoplayer/
```

If a filename above does not exist, skip it and note which.

- [ ] **Step 3: Relocate the eleven unreachable source files**

Prefer relocation over deletion, so the code stays readable but leaves the TypeScript project:

```bash
mkdir -p docs/history/videoplayer-unused
git mv components/VideoPlayer/Controls.tsx docs/history/videoplayer-unused/
git mv components/VideoPlayer/ControlsWithNavigation.example.tsx docs/history/videoplayer-unused/
git mv components/VideoPlayer/AutoplayToggleDemo.tsx docs/history/videoplayer-unused/
git mv components/VideoPlayer/YouTubeControlsDemo.tsx docs/history/videoplayer-unused/
git mv components/VideoPlayer/NavigationButtons.ts docs/history/videoplayer-unused/
git mv components/VideoPlayer/VideoView.tsx docs/history/videoplayer-unused/
git mv components/VideoPlayer/styles.ts docs/history/videoplayer-unused/
git mv components/VideoPlayer/tokens.ts docs/history/videoplayer-unused/
git mv components/VideoPlayer/types.ts docs/history/videoplayer-unused/
git mv components/VideoPlayer/utils.ts docs/history/videoplayer-unused/
git mv components/VideoPlayer/hooks/useVideoPlayer.ts docs/history/videoplayer-unused/
```

If the human chose outright deletion instead, use `git rm` for the same eleven paths. Git history preserves them either way.

- [ ] **Step 4: Exclude the relocated code from the TypeScript project**

`tsconfig.json` currently has `"include": ["**/*.ts", "**/*.tsx", ...]`, which would pick the files back up from their new home. Add an exclude:

```json
  "exclude": ["node_modules", "docs/history"]
```

- [ ] **Step 5: Verify everything still builds and runs**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm test
npm run lint 2>&1 | tail -3
```
Expected: the type error count drops by 15 more, to **38 or lower**. All test suites pass. Lint errors drop to **3 or lower** (only `ThemeTest.tsx` and `useVoiceSearch.ts` remain, both cleared in later increments).

- [ ] **Step 6: Start the app and confirm playback is untouched**

Run:
```bash
npm start
```
Open the app, play a video, and confirm the player still renders and plays. A reachability analysis is strong evidence but not proof; this is the check that catches a dynamic import the grep missed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(player): move unreachable player files out of the source tree

Import-graph analysis from the app/ entry points shows these eleven files
are reachable from nothing. Together they contributed 15 type errors and
3 lint errors to a player that never loads them. Moved to docs/history
rather than deleted so they stay readable, and excluded from tsconfig.

CLAUDE.md names six of them as part of the player structure; human
approved this removal on <date> with the reason: <record it here>.

Verified: npx tsc --noEmit error count => <record>
Verified: npm test => all suites pass
Verified: app starts and plays a video

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] `components/VideoPlayer/index.tsx` has zero type errors (was 12).
- [ ] `AutoplayNotification.tsx` and `VideoProgressBar.tsx` have zero type errors.
- [ ] `npm test` passes, including the four VideoPlayer characterization tests.
- [ ] Download, Clip, Dislike, Report, and quality selection no longer render.
- [ ] Project type errors are at or below 53, or at or below 38 if Task 7 was approved and completed.
- [ ] No public prop was added or removed.
- [ ] Task 7 is either complete with the human's decision recorded, or explicitly deferred with that noted in the increment report.

## Manual Verification — a human must run this

Automated tests mock `expo-video`, so they prove the component renders, not that video plays. Before declaring this increment done, run `npm start` and check on a real device:

| # | Check | Pass criterion |
|---|---|---|
| 1 | Play an MP4 | Plays, controls respond |
| 2 | Play an HLS `.m3u8` | Plays, controls respond |
| 3 | Play, pause, seek, mute | All behave as before the increment |
| 4 | Double-tap left and right | Quick-seek still works in both directions |
| 5 | Enter and leave fullscreen | Orientation and restore behave as before |
| 6 | Toggle autoplay | The notification appears and disappears |
| 7 | Action bar | Only Like, Share, Save, and More are visible |
| 8 | Next and previous | Still navigate the queue |

Report any difference from pre-increment behavior as a regression. This increment is not allowed to change any of it.
