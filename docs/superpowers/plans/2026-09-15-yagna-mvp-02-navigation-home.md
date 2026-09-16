# Increment 2 — Navigation and Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first.**

**Goal:** Replace the three-tab template navigation with the MVP's four tabs plus three stack screens, and rebuild Home as three focused sections over the new services.

**Architecture:** One root stack containing the tab group. Video, Search, and Settings push over the tabs so the tab bar hides. Home calls `useHomeContent` and renders sections; it holds no data logic.

**Tech Stack:** Expo Router 6, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections D, E.1, and ADR 6.

**Depends on:** Increment 1 (tokens, `StateView`, `Screen`, `contentService`, `useLoadable`).

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- The Live and Saved tab screens are created as **placeholders** here so the tab bar is complete and navigable. Increment 4 fills in Saved, Increment 5 fills in Live. A placeholder renders a `Screen` with a `StateView` in the `empty` status and nothing else.
- Home must not import a service directly. It calls `useHomeContent`.
- Do not touch `app/video/[id].tsx` in this increment. Increment 3 owns it.

---

### Task 1: Remove the template screens and the unused navigation dependency

**Files:**
- Delete: `app/(tabs)/explore.tsx`, `app/modal.tsx`, `app/video/VideoCard.tsx`
- Delete: `components/parallax-scroll-view.tsx`, `components/hello-wave.tsx`, `components/ui/collapsible.tsx`, `components/external-link.tsx`
- Modify: `package.json` (drop `@react-navigation/drawer`)

**Why:** `explore.tsx` is the unmodified Expo template screen and takes a tab slot the MVP needs. `app/video/VideoCard.tsx` duplicates `components/VideoFeed/VideoCard.tsx` and contributes a type error by importing untyped `prop-types`. `@react-navigation/drawer` is in `dependencies` but no route uses it.

- [ ] **Step 1: Prove each file is unreferenced**

For each file, run the matching grep and confirm no output outside the file itself:

```bash
grep -rn "explore" app components --include=*.tsx --include=*.ts
grep -rn "app/modal\|\"modal\"\|'modal'" app --include=*.tsx
grep -rn "video/VideoCard" app components --include=*.tsx
grep -rn "parallax-scroll-view\|hello-wave\|ui/collapsible\|external-link" app components --include=*.tsx
grep -rn "@react-navigation/drawer" app components contexts hooks services --include=*.ts --include=*.tsx
```

`app/_layout.tsx` currently registers the modal route; that reference disappears in Task 2. If any other grep returns a hit, stop and report rather than deleting.

- [ ] **Step 2: Delete them**

```bash
git rm app/\(tabs\)/explore.tsx app/modal.tsx app/video/VideoCard.tsx
git rm components/parallax-scroll-view.tsx components/hello-wave.tsx components/ui/collapsible.tsx components/external-link.tsx
```

- [ ] **Step 3: Drop the unused dependency**

Remove the `"@react-navigation/drawer"` line from `dependencies` in `package.json`, then run:

```bash
npm install
```

- [ ] **Step 4: Verify**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm test
```
Expected: the error count drops by at least 1 (the `prop-types` error from `app/video/VideoCard.tsx`). The suite stays green.

The app will not start cleanly until Task 2 removes the modal route registration. That is expected.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Expo template screens and the unused drawer dependency

explore.tsx was the unmodified template and occupied a tab slot the MVP
needs. app/video/VideoCard.tsx duplicated the VideoFeed card and imported
untyped prop-types. No route used @react-navigation/drawer.

Verified: npm test => all suites pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Restructure navigation into four tabs and three stack screens

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/live.tsx` (placeholder)
- Create: `app/(tabs)/saved.tsx` (placeholder)
- Move: `app/(tabs)/settings.tsx` to `app/settings.tsx`
- Test: `__tests__/navigation/tabLayout.test.tsx`

**Interfaces:**
- Produces: routes `/(tabs)/index`, `/(tabs)/live`, `/(tabs)/shorts`, `/(tabs)/saved`, `/video/[id]`, `/search`, `/settings`. Later increments fill the screens behind them.

- [ ] **Step 1: Write the failing test**

Create `__tests__/navigation/tabLayout.test.tsx`:

```tsx
// __tests__/navigation/tabLayout.test.tsx
// Verifies the tab set is exactly the four the MVP defines, in order.
// Expo Router builds routes from the filesystem, so this test asserts on
// the filesystem rather than rendering the router.
import fs from "fs";
import path from "path";

const TABS_DIR = path.join(__dirname, "..", "..", "app", "(tabs)");
const APP_DIR = path.join(__dirname, "..", "..", "app");

describe("route structure", () => {
  it("has exactly four tab screens", () => {
    const screens = fs
      .readdirSync(TABS_DIR)
      .filter((f) => f.endsWith(".tsx") && !f.startsWith("_"))
      .map((f) => f.replace(".tsx", ""))
      .sort();
    expect(screens).toEqual(["index", "live", "saved", "shorts"]);
  });

  it("does not keep the template explore or modal routes", () => {
    expect(fs.existsSync(path.join(TABS_DIR, "explore.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(APP_DIR, "modal.tsx"))).toBe(false);
  });

  it("exposes settings as a stack screen, not a tab", () => {
    expect(fs.existsSync(path.join(APP_DIR, "settings.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(TABS_DIR, "settings.tsx"))).toBe(false);
  });

  it("keeps the dynamic video route", () => {
    expect(fs.existsSync(path.join(APP_DIR, "video", "[id].tsx"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=tabLayout
```
Expected: fails because `live.tsx` and `saved.tsx` do not exist and `settings.tsx` is still under `(tabs)`.

- [ ] **Step 3: Move settings out of the tab group**

```bash
git mv app/\(tabs\)/settings.tsx app/settings.tsx
```

Do not rewrite its contents yet. Increment 6 does that. It currently has three type errors from importing `useThemeColors`, which stay until then.

- [ ] **Step 4: Create the two placeholder tabs**

Create `app/(tabs)/live.tsx`:

```tsx
// app/(tabs)/live.tsx
// Placeholder. Increment 5 implements the live experience.
import React from "react";
import { Screen } from "../../components/ui/Screen";
import { StateView } from "../../components/ui/StateView";

export default function LiveScreen() {
  return (
    <Screen testID="live-screen">
      <StateView
        status="empty"
        emptyTitle="Live Yagna"
        emptyHint="Live sessions will appear here."
        testID="live-placeholder"
      />
    </Screen>
  );
}
```

Create `app/(tabs)/saved.tsx` with the same shape, using `testID="saved-screen"`, title `"Saved"`, and hint `"Videos you save will appear here."`.

- [ ] **Step 5: Rewrite the tab layout**

Replace `app/(tabs)/_layout.tsx` with:

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getColors, tokens } from "@/constants/tokens";

import ShortsActive from "@/assets/icons/shorts-active.svg";
import ShortsInactive from "@/assets/icons/shorts-inactive.svg";

export default function TabLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={tokens.iconSize.lg} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={tokens.iconSize.lg} name="dot.radiowaves.left.and.right" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: "Shorts",
          tabBarIcon: ({ focused }) =>
            focused ? (
              <ShortsActive width={tokens.iconSize.lg} height={tokens.iconSize.lg} />
            ) : (
              <ShortsInactive width={tokens.iconSize.lg} height={tokens.iconSize.lg} />
            ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={tokens.iconSize.lg} name="bookmark.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

If `IconSymbol` does not support `dot.radiowaves.left.and.right` or `bookmark.fill`, open `components/ui/icon-symbol.tsx`, read its mapping, and pick the closest available names. Record which you chose.

- [ ] **Step 6: Rewrite the root layout**

Replace `app/_layout.tsx` with:

```tsx
// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "react-native-reanimated";

import { PlayQueueProvider } from "@/contexts/PlayQueueContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <PlayQueueProvider>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="video/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ title: "Search" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PlayQueueProvider>
  );
}
```

`PlayQueueProvider` does not exist until Increment 3. **Until then, keep the existing `VideoPlayerProvider` import and wrapper in place** and change only the `Stack.Screen` entries. Increment 3 Task 2 swaps the provider. Note this in the task record so the swap is not forgotten.

`app/search.tsx` does not exist until Increment 6. Registering a `Stack.Screen` for a missing route is harmless in Expo Router, but if it warns, comment out that one line with a `TODO(Increment 6)` marker and restore it there.

- [ ] **Step 7: Run the tests**

Run:
```bash
npm test -- --testPathPattern=tabLayout
npm test
```
Expected: 4 passed in the navigation suite, and the whole suite green.

- [ ] **Step 8: Start the app and click every tab**

Run:
```bash
npm start
```
Confirm four tabs appear, each opens without crashing, and Shorts still behaves exactly as before.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: restructure navigation into four tabs and three stack screens

Home, Live, Shorts, Saved as tabs; Video, Search, Settings push over them so
the tab bar hides during playback. Live and Saved are placeholders until
Increments 5 and 4.

Verified: npm test => all suites pass
Verified: app starts, all four tabs open, Shorts unchanged

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The `useHomeContent` hook

**Files:**
- Create: `hooks/useHomeContent.ts`
- Test: `__tests__/hooks/useHomeContent.test.tsx`

**Interfaces:**
- Consumes: `getFeatured`, `getLatest` from `services/contentService`; `useLoadable` from `hooks/useLoadable`.
- Produces:

```ts
export interface HomeContent {
  readonly featured: Video | null;
  readonly latest: readonly Video[];
}
export interface UseHomeContentResult extends Loadable<HomeContent> {
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMore: () => void;
}
export function useHomeContent(): UseHomeContentResult;
```

**Partial success matters here.** The HLD requires that a failed section does not blank the whole screen. If `getFeatured` rejects but `getLatest` resolves, the hook reports `success` with `featured: null`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useHomeContent.test.tsx`:

```tsx
// __tests__/hooks/useHomeContent.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useHomeContent } from "../../hooks/useHomeContent";
import * as contentService from "../../services/contentService";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");

const mocked = contentService as jest.Mocked<typeof contentService>;

function video(id: string): Video {
  return {
    id,
    title: `Video ${id}`,
    thumbnailUrl: "https://cdn.test/t.jpg",
    durationSec: 60,
    publishedAt: "2026-01-01T00:00:00Z",
    channel: { id: "c1", name: "Yagna" },
    isLive: false,
    source: { kind: "mp4", url: "https://cdn.test/a.mp4" },
  };
}

describe("useHomeContent", () => {
  beforeEach(() => jest.resetAllMocks());

  it("loads featured and latest together", async () => {
    mocked.getFeatured.mockResolvedValue(video("f1"));
    mocked.getLatest.mockResolvedValue({ videos: [video("a"), video("b")], hasMore: true });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data?.featured?.id).toBe("f1");
    expect(result.current.data?.latest).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it("still succeeds when only the featured section fails", async () => {
    mocked.getFeatured.mockRejectedValue(makeError("unknown"));
    mocked.getLatest.mockResolvedValue({ videos: [video("a")], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.featured).toBeNull();
    expect(result.current.data?.latest).toHaveLength(1);
  });

  it("fails when the latest feed fails, because there is nothing to show", async () => {
    mocked.getFeatured.mockResolvedValue(video("f1"));
    mocked.getLatest.mockRejectedValue(makeError("unknown"));

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("reports offline when the feed fails with a network error", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockRejectedValue(makeError("network"));

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });

  it("reports empty when the feed returns nothing", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockResolvedValue({ videos: [], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("appends the next page on loadMore", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest
      .mockResolvedValueOnce({ videos: [video("a")], hasMore: true })
      .mockResolvedValueOnce({ videos: [video("b")], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.data?.latest).toHaveLength(1));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.latest).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
  });

  it("ignores loadMore when there is no more to load", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockResolvedValue({ videos: [video("a")], hasMore: false });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));

    const callsBefore = mocked.getLatest.mock.calls.length;
    act(() => result.current.loadMore());
    expect(mocked.getLatest.mock.calls.length).toBe(callsBefore);
  });

  it("does not issue a second page request while one is in flight", async () => {
    mocked.getFeatured.mockResolvedValue(null);
    mocked.getLatest.mockResolvedValue({ videos: [video("a")], hasMore: true });

    const { result } = renderHook(() => useHomeContent());
    await waitFor(() => expect(result.current.status).toBe("success"));

    const before = mocked.getLatest.mock.calls.length;
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    await waitFor(() => expect(mocked.getLatest.mock.calls.length).toBe(before + 1));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=useHomeContent
```
Expected: module-not-found.

- [ ] **Step 3: Implement the hook**

Create `hooks/useHomeContent.ts`. Build the first page on `useLoadable` with a `load` callback that runs both requests with `Promise.allSettled`, treating a rejected `getFeatured` as `null` and a rejected `getLatest` as a thrown error so `useLoadable` maps it to `error` or `offline`. Set `isEmpty` to `(d) => d.latest.length === 0 && d.featured === null`.

Hold appended pages in local state alongside the loadable data, and guard `loadMore` with an `isLoadingMore` flag and a `hasMore` check so a double tap cannot fire two requests.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=useHomeContent
```
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add hooks/useHomeContent.ts __tests__/hooks/useHomeContent.test.tsx
git commit -m "feat: add useHomeContent with per-section partial success

A failed featured section leaves the latest feed rendering rather than
blanking Home. Pagination is guarded so a double tap cannot fire two
concurrent page requests.

Verified: npm test -- --testPathPattern=useHomeContent => 8 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Home section components

**Files:**
- Create: `components/Home/SectionHeader.tsx`
- Create: `components/Home/FeaturedYagnaCard.tsx`
- Test: `__tests__/components/FeaturedYagnaCard.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface SectionHeaderProps {
  readonly title: string;
  readonly testID?: string;
}
export interface FeaturedYagnaCardProps {
  readonly video: Video;
  readonly onPress: (video: Video) => void;
  readonly testID?: string;
}
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/FeaturedYagnaCard.test.tsx`:

```tsx
// __tests__/components/FeaturedYagnaCard.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { FeaturedYagnaCard } from "../../components/Home/FeaturedYagnaCard";
import type { Video } from "../../types/domain";

const video: Video = {
  id: "f1",
  title: "Gayatri Yagya",
  description: "Morning offering",
  thumbnailUrl: "https://cdn.test/t.jpg",
  durationSec: 3600,
  publishedAt: "2026-01-01T00:00:00Z",
  channel: { id: "c1", name: "Yagna Vishnu Bhagwan" },
  isLive: false,
  source: { kind: "hls", url: "https://cdn.test/a.m3u8" },
};

describe("FeaturedYagnaCard", () => {
  it("shows the title and channel", () => {
    render(<FeaturedYagnaCard video={video} onPress={jest.fn()} testID="fc" />);
    expect(screen.getByText("Gayatri Yagya")).toBeTruthy();
    expect(screen.getByText("Yagna Vishnu Bhagwan")).toBeTruthy();
  });

  it("passes the video to onPress", () => {
    const onPress = jest.fn();
    render(<FeaturedYagnaCard video={video} onPress={onPress} testID="fc" />);
    fireEvent.press(screen.getByTestId("fc"));
    expect(onPress).toHaveBeenCalledWith(video);
  });

  it("is announced as a button with the title in its label", () => {
    render(<FeaturedYagnaCard video={video} onPress={jest.fn()} testID="fc" />);
    const card = screen.getByTestId("fc");
    expect(card.props.accessibilityRole).toBe("button");
    expect(String(card.props.accessibilityLabel)).toContain("Gayatri Yagya");
  });

  it("renders a long title without crashing", () => {
    const long = { ...video, title: "अ".repeat(300) };
    expect(() =>
      render(<FeaturedYagnaCard video={long} onPress={jest.fn()} testID="fc" />),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail, then build both components**

Run:
```bash
npm test -- --testPathPattern=FeaturedYagnaCard
```

`FeaturedYagnaCard` renders a `Pressable` with the `testID`, `accessibilityRole="button"`, and an `accessibilityLabel` containing the title. Inside: the thumbnail via `expo-image`, the title capped with `numberOfLines={2}`, and the channel name. All colours and sizes come from `constants/tokens`.

`SectionHeader` renders a `Text` at `tokens.typography.heading`.

- [ ] **Step 3: Run the tests and commit**

Run:
```bash
npm test -- --testPathPattern=FeaturedYagnaCard
```
Expected: 4 passed.

```bash
git add components/Home __tests__/components/FeaturedYagnaCard.test.tsx
git commit -m "feat: add Home section header and featured card

Verified: npm test -- --testPathPattern=FeaturedYagnaCard => 4 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Rebuild the Home screen

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Test: `__tests__/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `useHomeContent`, `SectionHeader`, `FeaturedYagnaCard`, `VideoFeed` (existing), `Screen`, `StateView`, `usePlayQueue` (Increment 3; until then keep `useVideoPlayerContext`).

**What changes and why:** today Home owns search state, a debounce timer, a video list ref, and a scroll position it pushes into a context. Search moves to its own screen in Increment 6, and the scroll position stops being shared state because the list already restores it. Home ends up rendering three sections and forwarding one press handler.

Today's screen also has four type errors from reading `theme.subtle` and `theme.placeholder`, which `constants/theme.ts` does not define. Moving to `getColors` from `constants/tokens` fixes them.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/HomeScreen.test.tsx`:

```tsx
// __tests__/screens/HomeScreen.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../app/(tabs)/index";
import * as useHomeContentModule from "../../hooks/useHomeContent";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

const push = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("../../hooks/useHomeContent");
jest.mock("../../components/VideoFeed", () => ({
  VideoFeed: () => null,
}));

const mockedHook = useHomeContentModule as jest.Mocked<typeof useHomeContentModule>;

function video(id: string): Video {
  return {
    id,
    title: `Video ${id}`,
    thumbnailUrl: "https://cdn.test/t.jpg",
    durationSec: 60,
    publishedAt: "2026-01-01T00:00:00Z",
    channel: { id: "c1", name: "Yagna" },
    isLive: false,
    source: { kind: "mp4", url: "https://cdn.test/a.mp4" },
  };
}

function mockState(overrides: Partial<ReturnType<typeof useHomeContentModule.useHomeContent>>) {
  mockedHook.useHomeContent.mockReturnValue({
    status: "success",
    data: { featured: null, latest: [] },
    error: null,
    retry: jest.fn(),
    hasMore: false,
    isLoadingMore: false,
    loadMore: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useHomeContentModule.useHomeContent>);
}

describe("HomeScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the branding", () => {
    mockState({});
    render(<HomeScreen />);
    expect(screen.getByText("Yagna Vishnu Bhagwan")).toBeTruthy();
    expect(screen.getByText("Divya Darshan")).toBeTruthy();
  });

  it("shows a loading state while content loads", () => {
    mockState({ status: "loading", data: null });
    render(<HomeScreen />);
    expect(screen.getByTestId("home-state-loading")).toBeTruthy();
  });

  it("shows an error state with a retry action", () => {
    const retry = jest.fn();
    mockState({ status: "error", data: null, error: makeError("unknown"), retry });
    render(<HomeScreen />);
    expect(screen.getByTestId("home-state-retry")).toBeTruthy();
  });

  it("shows an offline state when the feed is unreachable", () => {
    mockState({ status: "offline", data: null, error: makeError("network") });
    render(<HomeScreen />);
    expect(screen.getByText(makeError("network").message)).toBeTruthy();
  });

  it("renders the featured card when one is present", async () => {
    mockState({ data: { featured: video("f1"), latest: [video("a")] } });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId("home-featured")).toBeTruthy());
  });

  it("omits the featured section when there is no featured video", () => {
    mockState({ data: { featured: null, latest: [video("a")] } });
    render(<HomeScreen />);
    expect(screen.queryByTestId("home-featured")).toBeNull();
  });

  it("offers a way to reach search and settings", () => {
    mockState({});
    render(<HomeScreen />);
    expect(screen.getByTestId("home-search-button")).toBeTruthy();
    expect(screen.getByTestId("home-settings-button")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=HomeScreen
```

- [ ] **Step 3: Rewrite `app/(tabs)/index.tsx`**

Structure, in order:

1. `Screen` wrapper.
2. A header row: the two branding lines, then an `IconButton` with `testID="home-search-button"` pushing `/search`, and one with `testID="home-settings-button"` pushing `/settings`.
3. `StateView` with `status` from the hook, `testID="home-state"`, and `onRetry={retry}`. Return early when the status is not `success`.
4. When `data.featured` exists, a `SectionHeader` reading "Featured Yagna" and a `FeaturedYagnaCard` with `testID="home-featured"`.
5. A `SectionHeader` reading "Latest" and the existing `VideoFeed`, passing `initialVideos={data.latest}`.
6. A press handler that sets the play queue from `data.latest` and pushes `/video/${encodeURIComponent(id)}`.

Remove the search input, the debounce effect, `allVideos` state, the `lastVideoListRef`, and every call to `saveHomeScrollPosition`. Read colours from `getColors`, not `Colors`.

Keep using `useVideoPlayerContext().setVideoList` until Increment 3 introduces `usePlayQueue`; leave a `TODO(Increment 3)` comment at that line.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=HomeScreen
npx tsc --noEmit 2>&1 | grep -c "app/(tabs)/index"
```
Expected: 7 passed, and `0` type errors in the Home screen (was 4).

- [ ] **Step 5: Start the app and check Home**

Run:
```bash
npm start
```
Confirm the branding renders, the latest feed loads, tapping a card opens the video screen, and the search and settings buttons navigate.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/index.tsx __tests__/screens/HomeScreen.test.tsx
git commit -m "feat: rebuild Home as three sections over useHomeContent

Home no longer owns search state, a debounce timer, or a shared scroll
position. It renders a live-ready header, an optional featured card, and the
latest feed, with every load state handled by StateView.

Verified: npm test -- --testPathPattern=HomeScreen => 7 passed
Verified: type errors in app/(tabs)/index.tsx 4 => 0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] Four tabs render: Home, Live, Shorts, Saved.
- [ ] Video, Search, and Settings are stack routes; the tab bar hides on the video screen.
- [ ] `app/(tabs)/explore.tsx`, `app/modal.tsx`, and `app/video/VideoCard.tsx` are gone.
- [ ] `@react-navigation/drawer` is no longer a dependency.
- [ ] Home has zero type errors and renders loading, empty, error, and offline states.
- [ ] Shorts behaves exactly as it did before this increment.
- [ ] `npm test` passes.
