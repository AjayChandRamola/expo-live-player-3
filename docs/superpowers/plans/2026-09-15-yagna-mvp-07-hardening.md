# Increment 7 — Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first.**

**Goal:** Make the MVP survive bad networks and hostile input, clear the remaining repository debt, and prove the whole thing works on real devices.

**Architecture:** An offline signal derived from error codes and app-state resumes, validated deep links, a repository cleanup, and a final verification pass whose results are recorded rather than assumed.

**Tech Stack:** Expo Linking 8, React Native `AppState`, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections D, H.3, and the manual matrix in LLD index section 8.

**Depends on:** Increments 0A through 6.

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- **Do not weaken a test or a validator to make the gate pass.** If something fails here, it is a real defect and gets fixed or reported.
- The final report must state what was verified, what was skipped, and what is known broken. An unverified item reported as done is worse than an open one.

---

### Task 1: The offline signal

**Files:**
- Create: `hooks/useIsOnline.ts`
- Create: `components/ui/OfflineBanner.tsx`
- Test: `__tests__/hooks/useIsOnline.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface OnlineState {
  readonly isOnline: boolean;
  /** Feature hooks call this when a request fails with code "network". */
  reportNetworkFailure(): void;
  /** Called after any successful request. */
  reportSuccess(): void;
}
export function useIsOnline(): OnlineState;
```

**Why no new dependency:** `@react-native-community/netinfo` would report link state, which is not the same as reachability, and adding it needs an ADR. Deriving the signal from actual request outcomes plus a re-check when the app returns to the foreground answers the question the UI actually asks: did the last thing we tried work?

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useIsOnline.test.tsx`:

```tsx
// __tests__/hooks/useIsOnline.test.tsx
import { AppState } from "react-native";
import { renderHook, act } from "@testing-library/react-native";
import { useIsOnline } from "../../hooks/useIsOnline";

describe("useIsOnline", () => {
  it("assumes online until something fails", () => {
    const { result } = renderHook(() => useIsOnline());
    expect(result.current.isOnline).toBe(true);
  });

  it("goes offline after a reported network failure", () => {
    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportNetworkFailure());
    expect(result.current.isOnline).toBe(false);
  });

  it("comes back online after a reported success", () => {
    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportNetworkFailure());
    act(() => result.current.reportSuccess());
    expect(result.current.isOnline).toBe(true);
  });

  it("optimistically returns online when the app comes to the foreground", () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    const { result } = renderHook(() => useIsOnline());
    act(() => result.current.reportNetworkFailure());
    expect(result.current.isOnline).toBe(false);

    act(() => listeners.forEach((cb) => cb("active")));
    expect(result.current.isOnline).toBe(true);
  });

  it("removes its app-state listener on unmount", () => {
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove } as never);
    const { unmount } = renderHook(() => useIsOnline());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, implement both, run again**

`OfflineBanner` renders nothing when online, and otherwise a bar in `colors.danger` with `accessibilityRole="alert"`. Add it inside `components/ui/Screen.tsx` so every screen inherits it without each one remembering.

Run:
```bash
npm test -- --testPathPattern=useIsOnline
```
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add hooks/useIsOnline.ts components/ui/OfflineBanner.tsx components/ui/Screen.tsx __tests__/hooks/useIsOnline.test.tsx
git commit -m "feat: derive an offline signal from request outcomes

Reports what the UI actually needs, whether the last request worked, without
adding a dependency for link state. Re-checks optimistically when the app
returns to the foreground.

Verified: npm test -- --testPathPattern=useIsOnline => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Deep link validation

**Files:**
- Create: `services/deepLinkService.ts`
- Modify: `app/_layout.tsx`
- Test: `__tests__/services/deepLinkService.test.ts`

**Interfaces:**
- Produces:

```ts
export type DeepLinkTarget =
  | { readonly kind: "video"; readonly id: string }
  | { readonly kind: "live" }
  | { readonly kind: "home" };
export function parseDeepLink(url: string): DeepLinkTarget;
```

**Rule:** anything unrecognised, malformed, or hostile resolves to `home`. The user lands somewhere sensible and sees no error dialog, while the attempt is logged.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/deepLinkService.test.ts`:

```ts
// __tests__/services/deepLinkService.test.ts
import { parseDeepLink } from "../../services/deepLinkService";
import { LINKS } from "../../constants/config";

const S = LINKS.scheme;

describe("parseDeepLink", () => {
  it("parses a video link", () => {
    expect(parseDeepLink(`${S}://video/abc123`)).toEqual({ kind: "video", id: "abc123" });
  });

  it("parses the live link", () => {
    expect(parseDeepLink(`${S}://live`)).toEqual({ kind: "live" });
  });

  it("decodes a percent-encoded id", () => {
    expect(parseDeepLink(`${S}://video/a%20b`)).toEqual({ kind: "video", id: "a b" });
  });

  it.each([
    [""],
    ["not a url"],
    [`${S}://`],
    [`${S}://video`],
    [`${S}://video/`],
    [`${S}://unknown/path`],
    ["https://evil.test/video/abc"],
    ["javascript:alert(1)"],
    [`${S}://video/${"x".repeat(500)}`],
  ])("falls back to home for %p", (url) => {
    expect(parseDeepLink(url)).toEqual({ kind: "home" });
  });

  it("rejects an id that tries to traverse the path", () => {
    expect(parseDeepLink(`${S}://video/..%2F..%2Fadmin`)).toEqual({ kind: "home" });
  });

  it("rejects a foreign scheme even with a valid-looking path", () => {
    expect(parseDeepLink("otherapp://video/abc123")).toEqual({ kind: "home" });
  });
});
```

- [ ] **Step 2: Run it, implement, run again**

Parse with `URL`. Require the scheme to equal `LINKS.scheme` exactly. Require the host to be `video` or `live`. For `video`, decode the single path segment, then reject it unless it matches `/^[A-Za-z0-9_-]{1,64}$/`. Anything else returns `home` and logs a warning without the raw URL.

Wire it in `app/_layout.tsx` with `Linking.useURL()` from `expo-linking`, routing to `/video/${id}`, the Live tab, or Home.

Run:
```bash
npm test -- --testPathPattern=deepLinkService
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add services/deepLinkService.ts app/_layout.tsx __tests__/services/deepLinkService.test.ts
git commit -m "feat: validate deep links before routing

Every incoming link is scheme-checked, host-checked, and id-pattern-checked.
Anything unrecognised lands on Home with a log and no error dialog, so a
crafted link cannot traverse or inject into a route.

Verified: npm test -- --testPathPattern=deepLinkService => all passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Repository cleanup

**Files:**
- Move: ~45 root-level `*.md` delivery notes to `docs/history/`
- Move: `hooks/useVoiceSearch.ts` to `docs/history/unused/`
- Delete: `App.tsx` and `constants/index.ts` if unreferenced
- Modify: `app.json` (fill `allowedMediaHosts`)

- [ ] **Step 1: Move the delivery notes**

These are build logs from the previous effort, not requirements. Keeping them at the repository root buries `README.md` and `CLAUDE.md`.

```bash
mkdir -p docs/history/delivery-notes
git mv AUTOPLAY_NOTIFICATION_COMPLETE.md AUTOPLAY_TOGGLE_IMPLEMENTATION.md COMMENTS_REPLY_FIX_COMPLETE.md COMMENTS_SYSTEM_COMPLETE.md COMPLETE_SHORTS_WITH_COMMENTS_DELIVERY.md docs/history/delivery-notes/
```

Continue for every remaining root `*.md` **except** `README.md` and `CLAUDE.md`, which stay. List them first to be sure:

```bash
ls *.md | grep -v -E "^(README|CLAUDE)\.md$"
```

- [ ] **Step 2: Quarantine the unusable voice search hook**

`hooks/useVoiceSearch.ts` imports `expo-speech`, which is not installed, so it contributes a lint error and can never run. Voice search is classified Later.

```bash
grep -rn "useVoiceSearch" app components hooks --include=*.ts --include=*.tsx
mkdir -p docs/history/unused
git mv hooks/useVoiceSearch.ts docs/history/unused/
```

If the grep finds a consumer, stop and report instead.

- [ ] **Step 3: Remove other unreferenced files**

Check each before removing:

```bash
grep -rn "from \"./App\"\|from './App'\|constants/index" app components contexts hooks services --include=*.ts --include=*.tsx
```

`App.tsx` is superseded by `expo-router/entry`, which `package.json` already names as `main`. `constants/index.ts` is a barrel no file imports. Remove each only if its grep is empty.

- [ ] **Step 4: Restrict media hosts for production**

In `app.json`, fill `extra.allowedMediaHosts` with the hosts the app is allowed to stream from, and make `mediaSourceResolver.resolvePlayable` enforce it when `mode` is `production` and the list is non-empty. Add a test for the new rejection path:

```ts
it("rejects a host outside the production allowlist", () => {
  // with mode "production" and allowedMediaHosts ["cdn.yagna.example"]
  expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url: "https://other.test/a.mp4" }))))
    .toBe("invalid_source");
});
```

If the production hosts are not yet known, leave the list empty, keep the code path, and record the gap in the final report rather than inventing a host.

- [ ] **Step 5: Verify and commit**

Run:
```bash
npm test
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
```

```bash
git add -A
git commit -m "chore: move delivery notes to docs/history and quarantine dead code

Root-level build logs from the previous effort move under docs/history so
README and CLAUDE.md are visible. useVoiceSearch imported an uninstalled
expo-speech and could never run.

Verified: npm test => all suites pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Pull to refresh on every list

**Files:**
- Modify: `app/(tabs)/index.tsx`, `app/(tabs)/live.tsx`, `app/(tabs)/saved.tsx`
- Test: `__tests__/screens/pullToRefresh.test.tsx`

**Why:** the HLD lists pull to refresh as a Should-Have and names it in the actions for Home, Live, and Saved. Each screen's hook already exposes `retry`, so this wires an existing capability to the standard gesture rather than adding one.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/pullToRefresh.test.tsx`:

```tsx
// __tests__/screens/pullToRefresh.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SavedScreen from "../../app/(tabs)/saved";
import * as savedVideos from "../../hooks/useSavedVideos";
import type { Video } from "../../types/domain";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: ["a"],
    hydrated: true,
    isSaved: () => true,
    isLiked: () => false,
    toggleSave: jest.fn(),
    toggleLike: jest.fn(),
  }),
}));
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setQueue: jest.fn() }),
}));
jest.mock("../../hooks/useSavedVideos");

const mocked = savedVideos as jest.Mocked<typeof savedVideos>;

const video: Video = {
  id: "a",
  title: "Video a",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 60,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna" },
  isLive: false,
  source: { kind: "mp4", url: "https://cdn.test/a.mp4" },
};

describe("pull to refresh", () => {
  it("re-runs the hook's retry when the Saved list is pulled", () => {
    const retry = jest.fn();
    mocked.useSavedVideos.mockReturnValue({
      status: "success",
      data: [video],
      error: null,
      retry,
      missingIds: [],
    } as ReturnType<typeof savedVideos.useSavedVideos>);

    render(<SavedScreen />);
    const list = screen.getByTestId("saved-list");
    fireEvent(list, "refresh");
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, wire the three screens, run again**

Give each list a `testID` (`home-list`, `live-list`, `saved-list`) and a `RefreshControl` whose `onRefresh` calls the hook's `retry` and whose `refreshing` is true while the status is `loading`.

Add the equivalent test for Home and Live, following the same shape. Do not copy the Saved test verbatim; each screen mocks a different hook.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/index.tsx app/\(tabs\)/live.tsx app/\(tabs\)/saved.tsx __tests__/screens/pullToRefresh.test.tsx
git commit -m "feat: add pull to refresh to Home, Live, and Saved

Wires the standard gesture to the retry each feature hook already exposes.

Verified: npm test -- --testPathPattern=pullToRefresh => passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Full automated verification

**Files:**
- Create: `docs/superpowers/plans/verification-report-<date>.md`

- [ ] **Step 1: Run every gate and record the real numbers**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx eslint . --ext .js,.jsx,.ts,.tsx 2>&1 | tail -3
npm test 2>&1 | tail -20
```

Write the actual output into the report. Do not round, summarise, or omit a failure.

- [ ] **Step 2: Check the architectural invariants**

Each of these must return nothing. A hit is an architecture violation and gets fixed before release.

```bash
# Only the container may import the player
grep -rn "components/VideoPlayer" app components --include=*.tsx | grep -v "VideoPlaybackContainer" | grep -v "components/VideoPlayer/"

# Only the adapter may import AsyncStorage
grep -rn "@react-native-async-storage" app components contexts hooks services --include=*.ts --include=*.tsx | grep -v "asyncStorageAdapter"

# Only httpClient may call fetch
grep -rn "fetch(" app components contexts hooks services --include=*.ts --include=*.tsx | grep -v "httpClient"

# No screen may import a service directly
grep -rn "from \"../../services/\|from \"../services/" app --include=*.tsx

# No suppressed types in new code
grep -rn "@ts-ignore\|@ts-nocheck\|: any" components/ui components/Video components/Live components/Home components/Saved components/Search hooks services contexts types --include=*.ts --include=*.tsx

# No demo data outside services
grep -rn "DEMO_VIDEOS\|demoContentProvider" app components contexts hooks --include=*.ts --include=*.tsx
```

- [ ] **Step 3: Record the report**

The report states, for each item: the command, its output, and whether it passed. Where something did not pass, say so plainly and note whether it is fixed, deferred, or open.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/verification-report-*.md
git commit -m "docs: record the automated verification results

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Manual device verification

**A human runs this.** Automated tests mock `expo-video` and the network, so they prove wiring, not playback. Nothing in the MVP is done until this passes on a physical Android device and a physical iOS device.

- [ ] **Step 1: Run the matrix**

Work through the sixteen checks in LLD index section 8 on each device. Record pass, fail, or not-run per row per platform.

- [ ] **Step 2: Add the playback-specific rows**

| # | Check | Pass criterion |
|---|---|---|
| 17 | Play a video with the screen locked, then unlock | No crash, playback state sensible |
| 18 | Receive a call during playback | Audio pauses and resumes cleanly |
| 19 | Switch from wifi to mobile data mid-stream | Playback recovers or shows an error with retry |
| 20 | Open the Live tab, leave it for five minutes, return | No battery warning, polling resumed |
| 21 | Save twenty videos, open Saved | List renders without visible delay |
| 22 | Rotate during a live stream | No crash, orientation behaves as on VOD |

- [ ] **Step 3: Record every result honestly**

Append the outcomes to the verification report. A row that was not run is recorded as not run, never as passed. Any failure is filed with the device, the OS version, and the reproduction steps.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/verification-report-*.md
git commit -m "docs: record manual device verification results

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] Every screen shows an offline state and recovers when connectivity returns.
- [ ] Deep links are validated; an invalid one lands on Home without a dialog.
- [ ] The repository root holds only `README.md` and `CLAUDE.md` as Markdown.
- [ ] Every architectural invariant grep in Task 5 Step 2 returns nothing.
- [ ] `npm test` passes and the type error count is recorded.
- [ ] The manual matrix is complete on both platforms, with every result recorded as pass, fail, or not run.
- [ ] Known limitations are listed explicitly, including anything the team chose not to fix.

## Known Limitations to State in the Final Report

Carry these forward rather than letting them look solved:

1. The existing player still has the design, functional, and performance issues the team flagged. Increment 0B fixed only type errors and one crash.
2. Download, picture-in-picture, quality selection, the clip editor, Thanks, Report, and Dislike are hidden behind flags, not implemented.
3. Likes are local to the device with no server and no count.
4. Comments exist in the codebase but are not wired into any MVP screen.
5. There are no user accounts, so nothing syncs across devices.
6. Shorts was reused unchanged and has no Save integration.
7. `npx expo install --check` reports 18 packages behind their Expo SDK 54 expected versions. Upgrading them was deliberately out of scope.
8. Content services run against demo data until a production API exists; `allowedMediaHosts` cannot be enforced until those hosts are known.
