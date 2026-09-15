# Increment 6 — Search and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first**, including deviation D1 about the third context.

**Goal:** Give search its own screen with recent queries, and make the theme and autoplay preferences real and persistent.

**Architecture:** `useSearch` debounces input and runs through `contentService`. `SettingsContext` holds the two preferences app-wide, hydrated from and written to `settingsStorage`, and seeds the play queue's autoplay flag.

**Tech Stack:** Expo Router 6, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections E.6, E.7, and deviation D1 in the LLD index.

**Depends on:** Increment 1 (storage, `contentService`, `useLoadable`, `StateView`), Increment 2 (navigation, Home header buttons), Increment 3 (`PlayQueueContext`).

---

## Blocked Until Answered

**Deviation D1 requires approval before Task 3.** The HLD's ADR 2 says two contexts; this increment adds a third, `SettingsContext`, because the theme preference must be readable by `app/_layout.tsx`, writable by the Settings screen, and the autoplay default must seed `PlayQueueContext`. A hook cannot share state across the tree.

Tasks 1 and 2 (search) do not depend on this and can proceed. If the reviewer rejects a third context, drop the theme toggle from MVP, keep autoplay inside `PlayQueueContext` seeded by a one-shot read, and record that decision.

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- Search input is untrusted. Trim it, strip control characters, enforce the length bounds in `LIMITS`, and never interpolate it into a URL without encoding.
- Voice search stays out. `hooks/useVoiceSearch.ts` imports `expo-speech`, which is not installed; Increment 7 relocates it.

---

### Task 1: `useSearch`

**Files:**
- Create: `hooks/useSearch.ts`
- Test: `__tests__/hooks/useSearch.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface UseSearchResult extends Loadable<Video[]> {
  readonly query: string;
  setQuery(next: string): void;
  /** Commits the current query to recent searches. Called on submit. */
  commit(): void;
  readonly recent: readonly string[];
  clearRecent(): void;
}
export function useSearch(): UseSearchResult;
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useSearch.test.tsx`:

```tsx
// __tests__/hooks/useSearch.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useSearch } from "../../hooks/useSearch";
import * as contentService from "../../services/contentService";
import * as settingsStorage from "../../services/storage/settingsStorage";
import { makeError } from "../../services/appError";
import { TIMING, LIMITS } from "../../constants/config";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");
jest.mock("../../services/storage/settingsStorage");

const content = contentService as jest.Mocked<typeof contentService>;
const storage = settingsStorage as jest.Mocked<typeof settingsStorage>;

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

describe("useSearch", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    storage.readRecentSearches.mockResolvedValue([]);
    storage.writeRecentSearches.mockResolvedValue(undefined);
    content.search.mockResolvedValue({ videos: [video("a")], hasMore: false });
  });

  afterEach(() => jest.useRealTimers());

  it("starts idle with no query", () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.status).toBe("idle");
    expect(content.search).not.toHaveBeenCalled();
  });

  it("waits for the debounce before searching", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    expect(content.search).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(content.search).toHaveBeenCalledWith("yagna", 0));
  });

  it("issues one request for rapid typing", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => {
      result.current.setQuery("y");
      result.current.setQuery("ya");
      result.current.setQuery("yag");
    });
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(content.search).toHaveBeenCalledTimes(1));
    expect(content.search).toHaveBeenCalledWith("yag", 0);
  });

  it("does not search below the minimum query length", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("a"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    expect(content.search).not.toHaveBeenCalled();
  });

  it("returns to idle when the query is cleared", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => result.current.setQuery(""));
    await waitFor(() => expect(result.current.status).toBe("idle"));
  });

  it("reports empty when nothing matches", async () => {
    content.search.mockResolvedValue({ videos: [], hasMore: false });
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("zzzz"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("reports offline on a network failure", async () => {
    content.search.mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });

  it("strips control characters from the query", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yag\u0000na"));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => expect(content.search).toHaveBeenCalledWith("yagna", 0));
  });

  it("caps the query at the configured maximum length", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("y".repeat(LIMITS.searchQueryMaxLength + 50)));
    await act(async () => {
      jest.advanceTimersByTime(TIMING.searchDebounceMs);
    });
    await waitFor(() => {
      const sent = String(content.search.mock.calls[0][0]);
      expect(sent.length).toBeLessThanOrEqual(LIMITS.searchQueryMaxLength);
    });
  });

  it("records a committed query in recent searches, newest first", async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery("yagna"));
    act(() => result.current.commit());
    await waitFor(() =>
      expect(storage.writeRecentSearches).toHaveBeenCalledWith(
        expect.arrayContaining(["yagna"]),
      ),
    );
  });

  it("does not record a duplicate recent query twice", async () => {
    storage.readRecentSearches.mockResolvedValue(["yagna"]);
    const { result } = renderHook(() => useSearch());
    await waitFor(() => expect(result.current.recent).toEqual(["yagna"]));

    act(() => result.current.setQuery("yagna"));
    act(() => result.current.commit());
    await waitFor(() => {
      const written = storage.writeRecentSearches.mock.calls.at(-1)?.[0] as string[];
      expect(written.filter((q) => q === "yagna")).toHaveLength(1);
    });
  });

  it("clears recent searches", async () => {
    storage.readRecentSearches.mockResolvedValue(["yagna"]);
    const { result } = renderHook(() => useSearch());
    await waitFor(() => expect(result.current.recent).toHaveLength(1));

    act(() => result.current.clearRecent());
    await waitFor(() => expect(result.current.recent).toEqual([]));
    expect(storage.writeRecentSearches).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run it, implement, run again**

Hold the raw `query` in state. Derive a sanitized value with `useMemo`: trim, strip control characters with `/[\u0000-\u001F\u007F]/g`, slice to `LIMITS.searchQueryMaxLength`. Keep a separate debounced value updated by an effect with a cleared timeout.

Build the request on `useLoadable`, enabled only when the debounced value meets `LIMITS.searchQueryMinLength`. `useLoadable` already discards stale responses, so a slow early query cannot overwrite a newer one.

`commit` prepends the sanitized query to `recent`, removes any existing duplicate, and writes through `writeRecentSearches`, which caps the list.

Run:
```bash
npm test -- --testPathPattern=useSearch
```
Expected: 12 passed.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSearch.ts __tests__/hooks/useSearch.test.tsx
git commit -m "feat: add useSearch with debounce, sanitisation, and recent queries

Input is trimmed, stripped of control characters, and length-bounded before
it reaches a service. Stale responses are discarded by useLoadable, so a slow
early query cannot overwrite a newer one.

Verified: npm test -- --testPathPattern=useSearch => 12 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The Search screen

**Files:**
- Create: `components/Search/SearchInput.tsx`
- Create: `components/Search/RecentSearches.tsx`
- Create: `app/search.tsx`
- Test: `__tests__/screens/SearchScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/SearchScreen.test.tsx`:

```tsx
// __tests__/screens/SearchScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SearchScreen from "../../app/search";
import * as searchHook from "../../hooks/useSearch";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

const push = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push, back: jest.fn() }),
  Stack: { Screen: () => null },
}));

const setQueue = jest.fn();
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setQueue }),
}));

jest.mock("../../hooks/useSearch");
const mocked = searchHook as jest.Mocked<typeof searchHook>;

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

const setQuery = jest.fn();
const commit = jest.fn();
const clearRecent = jest.fn();

function mockState(overrides: Record<string, unknown>) {
  mocked.useSearch.mockReturnValue({
    status: "idle",
    data: null,
    error: null,
    retry: jest.fn(),
    query: "",
    setQuery,
    commit,
    recent: [],
    clearRecent,
    ...overrides,
  } as ReturnType<typeof searchHook.useSearch>);
}

describe("SearchScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows recent searches when idle", () => {
    mockState({ recent: ["yagna", "gayatri"] });
    render(<SearchScreen />);
    expect(screen.getByText("yagna")).toBeTruthy();
    expect(screen.getByText("gayatri")).toBeTruthy();
  });

  it("forwards typing to the hook", () => {
    mockState({});
    render(<SearchScreen />);
    fireEvent.changeText(screen.getByTestId("search-input"), "yag");
    expect(setQuery).toHaveBeenCalledWith("yag");
  });

  it("commits on submit", () => {
    mockState({ query: "yagna" });
    render(<SearchScreen />);
    fireEvent(screen.getByTestId("search-input"), "submitEditing");
    expect(commit).toHaveBeenCalled();
  });

  it("re-runs a recent query when tapped", () => {
    mockState({ recent: ["yagna"] });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("recent-yagna"));
    expect(setQuery).toHaveBeenCalledWith("yagna");
  });

  it("clears recent searches", () => {
    mockState({ recent: ["yagna"] });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("recent-clear"));
    expect(clearRecent).toHaveBeenCalled();
  });

  it("lists results", () => {
    mockState({ status: "success", data: [video("a")], query: "yagna" });
    render(<SearchScreen />);
    expect(screen.getByText("Video a")).toBeTruthy();
  });

  it("sets the queue from results before opening a video", () => {
    mockState({ status: "success", data: [video("a")], query: "yagna" });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("search-result-a"));
    expect(setQueue).toHaveBeenCalledWith([video("a")], "a");
    expect(push).toHaveBeenCalledWith("/video/a");
  });

  it("shows an empty state naming the query", () => {
    mockState({ status: "empty", data: [], query: "zzzz" });
    render(<SearchScreen />);
    expect(screen.getByTestId("search-state")).toBeTruthy();
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockState({ status: "offline", data: null, error: makeError("network"), retry, query: "y" });
    render(<SearchScreen />);
    fireEvent.press(screen.getByTestId("search-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, build the screen, run again**

`SearchInput` renders a `TextInput` with `testID="search-input"`, `autoFocus`, `returnKeyType="search"`, a clear button, and an `accessibilityLabel`.

`RecentSearches` renders one pressable per query with `testID={`recent-${query}`}` plus a clear action with `testID="recent-clear"`. It renders nothing when the list is empty.

The screen shows `RecentSearches` while the status is `idle` and results otherwise, with `StateView` carrying `testID="search-state"`. Result rows reuse `components/VideoFeed/VideoCard` and carry `testID={`search-result-${id}`}`.

Run:
```bash
npm test -- --testPathPattern=SearchScreen
```
Expected: 9 passed.

- [ ] **Step 3: Commit**

```bash
git add components/Search app/search.tsx __tests__/screens/SearchScreen.test.tsx
git commit -m "feat: add the Search screen with recent queries

Search moves off Home onto its own stack screen, keeping Home to three
sections and giving search room for recents and every load state.

Verified: npm test -- --testPathPattern=SearchScreen => 9 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `SettingsContext` — needs the D1 decision first

**Files:**
- Create: `contexts/SettingsContext.tsx`
- Modify: `app/_layout.tsx`
- Modify: `contexts/PlayQueueContext.tsx` (seed autoplay)
- Test: `__tests__/contexts/SettingsContext.test.tsx`

**Interfaces:**
- Produces: `SettingsProvider` and `useSettings()` exactly as declared in LLD index section 5.7.

- [ ] **Step 1: Confirm the D1 decision is recorded**

Do not start until a human has approved adding a third context, or has chosen the fallback. Write their answer into the task notes and the eventual commit body.

- [ ] **Step 2: Write the failing test**

Create `__tests__/contexts/SettingsContext.test.tsx`:

```tsx
// __tests__/contexts/SettingsContext.test.tsx
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { SettingsProvider, useSettings } from "../../contexts/SettingsContext";
import * as settingsStorage from "../../services/storage/settingsStorage";

jest.mock("../../services/storage/settingsStorage");
const storage = settingsStorage as jest.Mocked<typeof settingsStorage>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe("SettingsContext", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    storage.writeSettings.mockResolvedValue(undefined);
  });

  it("hydrates stored settings", async () => {
    storage.readSettings.mockResolvedValue({ theme: "dark", autoplayDefault: false });
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.hydrated).toBe(false);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.theme).toBe("dark");
    expect(result.current.autoplayDefault).toBe(false);
  });

  it("falls back to defaults when the read fails", async () => {
    storage.readSettings.mockRejectedValue(new Error("disk"));
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.theme).toBe("system");
    expect(result.current.autoplayDefault).toBe(true);
  });

  it("persists a theme change", async () => {
    storage.readSettings.mockResolvedValue({ theme: "system", autoplayDefault: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
    await waitFor(() =>
      expect(storage.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" }),
      ),
    );
  });

  it("persists an autoplay change", async () => {
    storage.readSettings.mockResolvedValue({ theme: "system", autoplayDefault: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setAutoplayDefault(false));
    await waitFor(() =>
      expect(storage.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoplayDefault: false }),
      ),
    );
  });

  it("does not write during hydration", async () => {
    storage.readSettings.mockResolvedValue({ theme: "dark", autoplayDefault: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(storage.writeSettings).not.toHaveBeenCalled();
  });

  it("keeps the on-screen value when a write fails", async () => {
    storage.readSettings.mockResolvedValue({ theme: "system", autoplayDefault: true });
    storage.writeSettings.mockRejectedValue(new Error("disk full"));
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setTheme("dark"));
    await waitFor(() => expect(storage.writeSettings).toHaveBeenCalled());
    expect(result.current.theme).toBe("dark");
  });

  it("throws a clear error outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSettings())).toThrow(/SettingsProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run it, implement, run again**

Follow the same hydration and write-gating pattern as `SavedContext`: a `hydratedRef` so hydration does not write back, a catch that logs and leaves state intact, and a memoized value.

Mount `SettingsProvider` outermost in `app/_layout.tsx` and drive `ThemeProvider` from `settings.theme`, falling back to the system scheme when it is `"system"`.

Seed the queue's autoplay flag: add an optional `initialAutoplay` prop to `PlayQueueProvider` and pass `settings.autoplayDefault`. Keep the default `true` so the existing context test is unaffected.

Run:
```bash
npm test -- --testPathPattern="SettingsContext|PlayQueueContext"
```
Expected: 7 passed plus the 12 from Increment 3.

- [ ] **Step 4: Commit**

```bash
git add contexts/SettingsContext.tsx contexts/PlayQueueContext.tsx app/_layout.tsx __tests__/contexts/SettingsContext.test.tsx
git commit -m "feat: add SettingsContext for theme and autoplay preferences

Adds a third context beyond the HLD's ADR 2, because the theme must be read
app-wide by the root layout and written by the Settings screen. Human
approved on <date>: <record the reason>.

Verified: npm test -- --testPathPattern=SettingsContext => 7 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The Settings screen

**Files:**
- Modify: `app/settings.tsx` (replace the contents moved in Increment 2)
- Test: `__tests__/screens/SettingsScreen.test.tsx`

**What changes:** the moved file keeps a local `useDark` boolean that never persists and imports `useThemeColors`, which `constants/theme.ts` does not export. That import is the source of its three type errors.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/SettingsScreen.test.tsx`:

```tsx
// __tests__/screens/SettingsScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SettingsScreen from "../../app/settings";

const setTheme = jest.fn();
const setAutoplayDefault = jest.fn();
let theme: "system" | "light" | "dark" = "system";
let autoplayDefault = true;

jest.mock("../../contexts/SettingsContext", () => ({
  useSettings: () => ({ theme, autoplayDefault, hydrated: true, setTheme, setAutoplayDefault }),
}));

const setAutoplay = jest.fn();
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setAutoplay }),
}));

jest.mock("expo-router", () => ({ Stack: { Screen: () => null } }));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    theme = "system";
    autoplayDefault = true;
  });

  it("offers all three theme choices", () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId("theme-system")).toBeTruthy();
    expect(screen.getByTestId("theme-light")).toBeTruthy();
    expect(screen.getByTestId("theme-dark")).toBeTruthy();
  });

  it("marks the active theme as selected for assistive technology", () => {
    theme = "dark";
    render(<SettingsScreen />);
    expect(screen.getByTestId("theme-dark").props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("persists a theme choice", () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("theme-dark"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles the autoplay default and applies it to the current queue", () => {
    render(<SettingsScreen />);
    fireEvent(screen.getByTestId("autoplay-toggle"), "valueChange", false);
    expect(setAutoplayDefault).toHaveBeenCalledWith(false);
    expect(setAutoplay).toHaveBeenCalledWith(false);
  });

  it("shows the app version", () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId("settings-version")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, rewrite the screen, run again**

Three sections: Appearance with three pressables carrying `testID={`theme-${value}`}` and `accessibilityState={{ selected }}`; Playback with a `Switch` carrying `testID="autoplay-toggle"`; About with the version from `expo-constants` at `testID="settings-version"`.

Changing autoplay calls both `setAutoplayDefault` (persisted) and `setAutoplay` (applies to the session in progress), so the change takes effect without a relaunch.

Remove the `useThemeColors` import and read colours through `getColors`.

Run:
```bash
npm test -- --testPathPattern=SettingsScreen
npx tsc --noEmit 2>&1 | grep -c "app/settings"
```
Expected: 5 passed and `0` type errors (was 3).

- [ ] **Step 3: Verify on a device**

Run:
```bash
npm start
```
Switch the theme and confirm the whole app follows. Turn autoplay off, play a video to the end, and confirm it does not advance. Force-quit, relaunch, and confirm both settings survived.

- [ ] **Step 4: Commit**

```bash
git add app/settings.tsx __tests__/screens/SettingsScreen.test.tsx
git commit -m "feat: make theme and autoplay settings real and persistent

Replaces a local boolean that never persisted and an import of a
nonexistent useThemeColors export. Autoplay changes apply to the running
session as well as the stored default.

Verified: npm test -- --testPathPattern=SettingsScreen => 5 passed
Verified: type errors in app/settings.tsx 3 => 0
Verified: on device, both settings survive a relaunch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] Search has its own screen with recents, debounce, sanitisation, and every load state.
- [ ] Settings persists theme and autoplay, verified across a relaunch on a device.
- [ ] Changing the theme updates the whole app immediately.
- [ ] `app/settings.tsx` has zero type errors.
- [ ] The D1 decision about a third context is recorded in a commit body.
- [ ] `npm test` passes.
