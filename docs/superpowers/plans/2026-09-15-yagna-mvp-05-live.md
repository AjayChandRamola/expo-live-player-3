# Increment 5 — Live Yagna Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first.**

**Goal:** Let a user join a live Yagna, see when the next one starts, and watch replays, with a source model that works whether the stream is our own HLS or a YouTube broadcast.

**Architecture:** `liveService` returns a `LiveStatus` carrying a `SourceDescriptor`. When the kind is `hls`, the existing `VideoPlaybackContainer` plays it. When the kind is `youtube`, a constrained `LiveEmbedView` renders it. The player never learns that YouTube exists.

**Tech Stack:** react-native-webview 13.15 (already installed), React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections B.7, E.3, and ADR 4.

**Depends on:** Increment 1 (resolver, `useLoadable`, `StateView`), Increment 3 (`VideoPlaybackContainer`).

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- **The WebView is a trust boundary.** It loads exactly one URL built by `resolveEmbed`, blocks navigation to anything outside the origin allowlist, and never evaluates injected script that came from a server response.
- **Polling must not run unattended.** It stops when the tab loses focus and when the app leaves the foreground. An unbounded poll drains battery and mobile data, which the HLD's performance rules forbid.
- Live status is data, not player state. The live badge is an overlay in `components/Live`, not a player change.

---

### Task 1: `liveService`

**Files:**
- Create: `services/liveService.ts`
- Modify: `services/demoContentProvider.ts` (add live fixtures)
- Test: `__tests__/services/liveService.test.ts`

**Interfaces:**
- Produces: `getLiveStatus(signal?)` and `getRecentSessions()` as declared in LLD index section 5.6.

- [ ] **Step 1: Add live fixtures to the demo provider**

Export three constants alongside `DEMO_VIDEOS`:

- `DEMO_LIVE_HLS: LiveSession` with `source: { kind: "hls", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" }` and a `startsAt` in the past.
- `DEMO_LIVE_UPCOMING: LiveSession` with a `startsAt` roughly two hours in the future, computed at read time rather than hard-coded so the fixture does not expire.
- `DEMO_RECENT_SESSIONS: LiveSession[]` with at least three entries, each carrying a `replayVideoId` matching a real id in `DEMO_VIDEOS`.

- [ ] **Step 2: Write the failing test**

Create `__tests__/services/liveService.test.ts`:

```ts
// __tests__/services/liveService.test.ts
import { getLiveStatus, getRecentSessions } from "../../services/liveService";

jest.mock("../../services/contentSourceConfig", () => ({
  getContentSourceConfig: () => ({
    mode: "development",
    apiBaseUrl: "",
    allowedMediaHosts: [],
    liveSourceFallback: "youtube",
  }),
}));

describe("liveService in development mode", () => {
  it("returns a status with a known state", async () => {
    const status = await getLiveStatus();
    expect(["live", "upcoming", "ended", "none"]).toContain(status.state);
  });

  it("stamps the check time as a valid ISO date", async () => {
    const status = await getLiveStatus();
    expect(Number.isNaN(Date.parse(status.checkedAt))).toBe(false);
  });

  it("includes a session whenever the state is not none", async () => {
    const status = await getLiveStatus();
    if (status.state !== "none") {
      expect(status.session).toBeDefined();
      expect(typeof status.session?.id).toBe("string");
    }
  });

  it("gives any session an https source", async () => {
    const status = await getLiveStatus();
    if (status.session) {
      expect(status.session.source.url.startsWith("https://")).toBe(true);
      expect(["hls", "mp4", "youtube"]).toContain(status.session.source.kind);
    }
  });

  it("returns recent sessions that each point at a replay", async () => {
    const sessions = await getRecentSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      expect(typeof session.replayVideoId).toBe("string");
    }
  });

  it("gives an upcoming session a start time in the future", async () => {
    const status = await getLiveStatus();
    if (status.state === "upcoming" && status.session) {
      expect(Date.parse(status.session.startsAt)).toBeGreaterThan(Date.now());
    }
  });

  it("accepts an abort signal without throwing", async () => {
    const controller = new AbortController();
    await expect(getLiveStatus(controller.signal)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 3: Run it, implement, run again**

In `development`, return `DEMO_LIVE_HLS` as `live`. In `production`, call `httpGet` with a guard that validates `state`, `session.id`, `session.startsAt`, and `session.source`. A response failing the guard becomes `validation`, which the hook shows as an error rather than a fake "no live session".

Run:
```bash
npm test -- --testPathPattern=liveService
```
Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add services/liveService.ts services/demoContentProvider.ts __tests__/services/liveService.test.ts
git commit -m "feat: add liveService with a source-agnostic status model

LiveStatus carries a SourceDescriptor, so the same model serves an HLS
stream we control and a YouTube broadcast we do not.

Verified: npm test -- --testPathPattern=liveService => 7 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `useLiveStatus` with a bounded polling lifecycle

**Files:**
- Create: `hooks/useLiveStatus.ts`
- Test: `__tests__/hooks/useLiveStatus.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface UseLiveStatusOptions {
  /** Poll only while the screen using this hook is focused. */
  readonly enabled: boolean;
}
export function useLiveStatus(options?: UseLiveStatusOptions): Loadable<LiveStatus>;
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useLiveStatus.test.tsx`:

```tsx
// __tests__/hooks/useLiveStatus.test.tsx
import { AppState } from "react-native";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useLiveStatus } from "../../hooks/useLiveStatus";
import * as liveService from "../../services/liveService";
import { makeError } from "../../services/appError";
import { TIMING } from "../../constants/config";

jest.mock("../../services/liveService");
const live = liveService as jest.Mocked<typeof liveService>;

const status = {
  state: "live" as const,
  session: {
    id: "s1",
    title: "Gayatri Yagya",
    thumbnailUrl: "https://cdn.test/t.jpg",
    startsAt: "2026-01-01T00:00:00Z",
    source: { kind: "hls" as const, url: "https://cdn.test/live.m3u8" },
  },
  checkedAt: "2026-01-01T00:00:00Z",
};

describe("useLiveStatus", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    live.getLiveStatus.mockResolvedValue(status);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads the status on mount", async () => {
    const { result } = renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.state).toBe("live");
  });

  it("polls on the configured interval", async () => {
    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs);
    });
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(2));
  });

  it("does not poll when disabled", async () => {
    renderHook(() => useLiveStatus({ enabled: false }));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 3);
    });
    expect(live.getLiveStatus).not.toHaveBeenCalled();
  });

  it("stops polling after unmount", async () => {
    const { unmount } = renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 3);
    });
    expect(live.getLiveStatus).toHaveBeenCalledTimes(1);
  });

  it("stops polling when the app leaves the foreground", async () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    act(() => listeners.forEach((cb) => cb("background")));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 2);
    });
    expect(live.getLiveStatus).toHaveBeenCalledTimes(1);
  });

  it("backs off after an error instead of hammering the endpoint", async () => {
    live.getLiveStatus.mockRejectedValue(makeError("network"));
    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs);
    });
    const afterFirstInterval = live.getLiveStatus.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs);
    });
    // With backoff the second interval must not add another call yet.
    expect(live.getLiveStatus.mock.calls.length).toBe(afterFirstInterval);
  });

  it("keeps only one request in flight", async () => {
    let resolve: (v: typeof status) => void = () => {};
    live.getLiveStatus.mockReturnValue(new Promise((r) => { resolve = r; }));

    renderHook(() => useLiveStatus({ enabled: true }));
    await waitFor(() => expect(live.getLiveStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(TIMING.liveStatusPollMs * 2);
    });
    expect(live.getLiveStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve(status);
    });
  });
});
```

- [ ] **Step 2: Run it, implement, run again**

Track an `inFlightRef` so a slow request cannot overlap the next tick. Track a `failureCountRef` and compute the next delay as `min(pollMs * 2 ** failures, liveStatusBackoffMaxMs)`, resetting on success.

Subscribe to `AppState` and clear the timer on anything other than `active`. Clear the timer and abort any in-flight request on unmount.

Run:
```bash
npm test -- --testPathPattern=useLiveStatus
```
Expected: 7 passed.

- [ ] **Step 3: Commit**

```bash
git add hooks/useLiveStatus.ts __tests__/hooks/useLiveStatus.test.tsx
git commit -m "feat: add useLiveStatus with a bounded polling lifecycle

Polls only while enabled and foregrounded, keeps one request in flight,
backs off exponentially on failure, and clears everything on unmount, so
the live tab cannot drain battery or data in the background.

Verified: npm test -- --testPathPattern=useLiveStatus => 7 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `LiveEmbedView`, the constrained WebView

**Files:**
- Create: `components/Live/LiveEmbedView.tsx`
- Test: `__tests__/components/LiveEmbedView.test.tsx`

**Interfaces:**
- Consumes: `EmbedTarget` from `types/domain`.
- Produces:

```ts
export interface LiveEmbedViewProps {
  readonly target: EmbedTarget;
  readonly testID?: string;
}
```

**Security posture:** this component renders remote HTML. It must load only the resolver-built URL, refuse navigation outside `target.allowedOrigins`, disable file access, and inject no script. Treat every setting here as load-bearing.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/LiveEmbedView.test.tsx`:

```tsx
// __tests__/components/LiveEmbedView.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { LiveEmbedView } from "../../components/Live/LiveEmbedView";

const webViewProps: Record<string, unknown>[] = [];
jest.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    webViewProps.push(props);
    const React = require("react");
    return React.createElement("WebView", { testID: "webview" });
  },
}));

const target = {
  embedUrl: "https://www.youtube-nocookie.com/embed/abc12345678?playsinline=1",
  allowedOrigins: ["https://www.youtube.com", "https://www.youtube-nocookie.com"] as const,
};

function last() {
  return webViewProps[webViewProps.length - 1];
}

describe("LiveEmbedView", () => {
  beforeEach(() => {
    webViewProps.length = 0;
  });

  it("loads exactly the resolver-built url", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().source).toEqual({ uri: target.embedUrl });
  });

  it("passes the origin allowlist to the WebView", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().originWhitelist).toEqual(expect.arrayContaining([...target.allowedOrigins]));
  });

  it("refuses file and universal access", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().allowFileAccess).toBe(false);
    expect(last().allowUniversalAccessFromFileURLs).toBe(false);
  });

  it("injects no javascript", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().injectedJavaScript).toBeUndefined();
  });

  it("allows navigation within the allowlist", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    const guard = last().onShouldStartLoadWithRequest as (r: { url: string }) => boolean;
    expect(guard({ url: "https://www.youtube-nocookie.com/embed/abc12345678" })).toBe(true);
  });

  it.each([
    ["https://evil.test/phish"],
    ["https://youtube.evil.test/watch"],
    ["http://www.youtube.com/embed/a"],
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
  ])("blocks navigation to %s", (url) => {
    render(<LiveEmbedView target={target} testID="embed" />);
    const guard = last().onShouldStartLoadWithRequest as (r: { url: string }) => boolean;
    expect(guard({ url })).toBe(false);
  });

  it("renders the webview", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(screen.getByTestId("webview")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, implement, run again**

Implement `onShouldStartLoadWithRequest` by parsing the candidate URL and comparing `origin` against `target.allowedOrigins` with exact equality. A `startsWith` check would accept `https://www.youtube.com.evil.test`. Return `false` for anything unparseable.

Set `originWhitelist={[...target.allowedOrigins]}`, `allowFileAccess={false}`, `allowUniversalAccessFromFileURLs={false}`, `javaScriptEnabled` (the embed needs it), `mediaPlaybackRequiresUserAction={false}`, and `allowsInlineMediaPlayback`.

Run:
```bash
npm test -- --testPathPattern=LiveEmbedView
```
Expected: all pass, including the five blocked-navigation cases.

- [ ] **Step 3: Commit**

```bash
git add components/Live/LiveEmbedView.tsx __tests__/components/LiveEmbedView.test.tsx
git commit -m "feat: add the constrained live embed WebView

Loads only the resolver-built URL and enforces the origin allowlist by exact
origin match, so a look-alike host such as youtube.evil.test is refused.
File access is off and no script is injected.

Verified: npm test -- --testPathPattern=LiveEmbedView => all passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Live presentation components

**Files:**
- Create: `components/Live/LiveBadge.tsx`, `UpcomingCard.tsx`, `LiveEndedOverlay.tsx`, `RecentSessionsList.tsx`, `LiveNowBanner.tsx`
- Test: `__tests__/components/UpcomingCard.test.tsx`

**Interfaces:**

```ts
export interface LiveBadgeProps { readonly testID?: string }
export interface UpcomingCardProps {
  readonly session: LiveSession;
  readonly now?: Date;            // injectable for deterministic tests
  readonly testID?: string;
}
export interface LiveEndedOverlayProps {
  readonly replayVideoId?: string;
  readonly onWatchReplay: (videoId: string) => void;
  readonly testID?: string;
}
export interface RecentSessionsListProps {
  readonly sessions: readonly LiveSession[];
  readonly onSelect: (session: LiveSession) => void;
  readonly testID?: string;
}
export interface LiveNowBannerProps {
  readonly status: LiveStatus;
  readonly onPress: () => void;
  readonly testID?: string;
}
```

- [ ] **Step 1: Write the failing countdown test**

Create `__tests__/components/UpcomingCard.test.tsx`:

```tsx
// __tests__/components/UpcomingCard.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { UpcomingCard } from "../../components/Live/UpcomingCard";
import type { LiveSession } from "../../types/domain";

const now = new Date("2026-01-01T10:00:00Z");

function session(startsAt: string): LiveSession {
  return {
    id: "s1",
    title: "Gayatri Yagya",
    thumbnailUrl: "https://cdn.test/t.jpg",
    startsAt,
    source: { kind: "hls", url: "https://cdn.test/live.m3u8" },
  };
}

describe("UpcomingCard", () => {
  it("shows the session title", () => {
    render(<UpcomingCard session={session("2026-01-01T12:00:00Z")} now={now} testID="up" />);
    expect(screen.getByText("Gayatri Yagya")).toBeTruthy();
  });

  it("counts down in hours and minutes", () => {
    render(<UpcomingCard session={session("2026-01-01T12:30:00Z")} now={now} testID="up" />);
    expect(screen.getByTestId("up-countdown")).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();
  });

  it("counts down in minutes when under an hour away", () => {
    render(<UpcomingCard session={session("2026-01-01T10:20:00Z")} now={now} testID="up" />);
    expect(screen.getByText(/20/)).toBeTruthy();
  });

  it("says starting soon when the start time has passed", () => {
    render(<UpcomingCard session={session("2026-01-01T09:00:00Z")} now={now} testID="up" />);
    expect(screen.getByTestId("up-countdown")).toBeTruthy();
  });

  it("does not crash on an unparseable start time", () => {
    expect(() =>
      render(<UpcomingCard session={session("not-a-date")} now={now} testID="up" />),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it, build all five components, run again**

`UpcomingCard` takes `now` as a prop defaulting to `new Date()` so the countdown is testable without fake timers. Guard the date parse and render "Starting soon" for a past or unparseable time.

`LiveBadge` renders a pill in `colors.live` with the text "LIVE" and `accessibilityLabel="Live now"`.

`LiveEndedOverlay` shows an ended message and, when `replayVideoId` is set, a button calling `onWatchReplay`.

`RecentSessionsList` renders a `FlatList` keyed on `session.id`.

`LiveNowBanner` renders nothing when `status.state` is `none`; otherwise a pressable row with the badge, the title, and the countdown for an upcoming session.

Run:
```bash
npm test -- --testPathPattern=UpcomingCard
```
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add components/Live __tests__/components/UpcomingCard.test.tsx
git commit -m "feat: add live badge, upcoming card, ended overlay, and session list

Verified: npm test -- --testPathPattern=UpcomingCard => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `LiveHero` and the Live screen

**Files:**
- Create: `components/Live/LiveHero.tsx`
- Modify: `app/(tabs)/live.tsx` (replace the Increment 2 placeholder)
- Modify: `app/(tabs)/index.tsx` (add `LiveNowBanner`)
- Test: `__tests__/screens/LiveScreen.test.tsx`

**Interfaces:**

```ts
export interface LiveHeroProps {
  readonly status: LiveStatus;
  readonly onWatchReplay: (videoId: string) => void;
  readonly testID?: string;
}
```

`LiveHero` is the state switch. Given a status it renders exactly one of: the playback container for an HLS live source, `LiveEmbedView` for a YouTube source, `UpcomingCard`, `LiveEndedOverlay`, or a no-session message. It resolves the source itself and renders an error state if resolution fails.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/LiveScreen.test.tsx`:

```tsx
// __tests__/screens/LiveScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import LiveScreen from "../../app/(tabs)/live";
import * as liveStatus from "../../hooks/useLiveStatus";
import * as liveService from "../../services/liveService";
import { makeError } from "../../services/appError";
import type { LiveStatus } from "../../types/domain";

const push = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push }) }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));

jest.mock("../../components/Video/VideoPlaybackContainer", () => ({
  VideoPlaybackContainer: () => {
    const React = require("react");
    return React.createElement("View", { testID: "live-player" });
  },
}));
jest.mock("../../components/Live/LiveEmbedView", () => ({
  LiveEmbedView: () => {
    const React = require("react");
    return React.createElement("View", { testID: "live-embed" });
  },
}));

jest.mock("../../hooks/useLiveStatus");
jest.mock("../../services/liveService");

const mockedStatus = liveStatus as jest.Mocked<typeof liveStatus>;
const mockedService = liveService as jest.Mocked<typeof liveService>;

function status(overrides: Partial<LiveStatus>): LiveStatus {
  return {
    state: "none",
    checkedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as LiveStatus;
}

const hlsSession = {
  id: "s1",
  title: "Gayatri Yagya",
  thumbnailUrl: "https://cdn.test/t.jpg",
  startsAt: "2026-01-01T00:00:00Z",
  source: { kind: "hls" as const, url: "https://cdn.test/live.m3u8" },
};

function mockHook(overrides: Record<string, unknown>) {
  mockedStatus.useLiveStatus.mockReturnValue({
    status: "success",
    data: status({}),
    error: null,
    retry: jest.fn(),
    ...overrides,
  } as ReturnType<typeof liveStatus.useLiveStatus>);
}

describe("LiveScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.getRecentSessions.mockResolvedValue([]);
  });

  it("plays an HLS live stream through the shared container", () => {
    mockHook({ data: status({ state: "live", session: hlsSession }) });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-player")).toBeTruthy();
    expect(screen.queryByTestId("live-embed")).toBeNull();
  });

  it("uses the embed view for a YouTube source", () => {
    mockHook({
      data: status({
        state: "live",
        session: {
          ...hlsSession,
          source: { kind: "youtube", url: "https://www.youtube.com/watch?v=abc12345678" },
        },
      }),
    });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-embed")).toBeTruthy();
    expect(screen.queryByTestId("live-player")).toBeNull();
  });

  it("shows a countdown when a session is upcoming", () => {
    mockHook({
      data: status({
        state: "upcoming",
        session: { ...hlsSession, startsAt: new Date(Date.now() + 3_600_000).toISOString() },
      }),
    });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-upcoming")).toBeTruthy();
  });

  it("offers the replay when a session has ended", () => {
    mockHook({
      data: status({ state: "ended", session: { ...hlsSession, replayVideoId: "v9" } }),
    });
    render(<LiveScreen />);
    fireEvent.press(screen.getByTestId("live-replay-button"));
    expect(push).toHaveBeenCalledWith("/video/v9");
  });

  it("says nothing is scheduled when there is no session", () => {
    mockHook({ data: status({ state: "none" }) });
    render(<LiveScreen />);
    expect(screen.getByTestId("live-none")).toBeTruthy();
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockHook({ status: "offline", data: null, error: makeError("network"), retry });
    render(<LiveScreen />);
    fireEvent.press(screen.getByTestId("live-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows an error state rather than the player when the source cannot be resolved", () => {
    mockHook({
      data: status({
        state: "live",
        session: { ...hlsSession, source: { kind: "hls", url: "http://insecure.test/a.m3u8" } },
      }),
    });
    render(<LiveScreen />);
    expect(screen.queryByTestId("live-player")).toBeNull();
    expect(screen.getByTestId("live-source-error")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, build `LiveHero` and the screen, run again**

The screen passes `enabled` to `useLiveStatus` from `useIsFocused()`, so polling stops when the user switches tabs.

`LiveHero` calls `resolvePlayable` inside a `try` for an `hls` or `mp4` source and `resolveEmbed` for a `youtube` source, rendering a state with `testID="live-source-error"` when either throws. A live stream must never be handed to the player unresolved.

Fire `track("live_join", { sessionId })` once when a live session first renders.

Add `LiveNowBanner` to the top of Home, fed by `useLiveStatus({ enabled: true })`, pushing to the Live tab on press. It renders nothing when the state is `none`, so Home stays uncluttered.

Run:
```bash
npm test -- --testPathPattern=LiveScreen
```
Expected: 7 passed.

- [ ] **Step 3: Verify on a device**

Run:
```bash
npm start
```
Confirm the Live tab plays the demo HLS stream with a live badge, the tab stops polling when you switch away (watch the logs), and a replay opens the video screen.

- [ ] **Step 4: Commit**

```bash
git add components/Live app/\(tabs\)/live.tsx app/\(tabs\)/index.tsx __tests__/screens/LiveScreen.test.tsx
git commit -m "feat: add the Live tab with HLS and YouTube paths

LiveHero switches on the resolved source: our own HLS plays through the
shared container, a YouTube broadcast through the constrained embed view,
and an unresolvable source renders an error instead of reaching the player.
Polling is tied to tab focus.

Verified: npm test -- --testPathPattern=LiveScreen => 7 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] The Live tab renders live, upcoming, ended-with-replay, none, loading, error, and offline states.
- [ ] An HLS live source plays through `VideoPlaybackContainer`; a YouTube source never touches the player.
- [ ] The embed WebView refuses navigation outside its origin allowlist, including look-alike hosts.
- [ ] Polling stops on tab blur, on backgrounding, and on unmount, verified by test.
- [ ] Home shows a live banner only when something is live or upcoming.
- [ ] `npm test` passes.
