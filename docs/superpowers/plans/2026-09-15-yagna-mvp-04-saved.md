# Increment 4 — Saved Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first**, especially section 5.7.

**Goal:** Give saved videos one source of truth that both the player's Save action and the Saved tab read, persisted on the device so it survives a relaunch.

**Architecture:** `SavedContext` holds ordered saved ids and a liked id set, hydrating from `savedStorage` on mount and writing back on every change through a debounced, serialized writer. The Saved tab hydrates ids into videos through `contentService`.

**Tech Stack:** React context, AsyncStorage via the Increment 1 storage modules, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections E.5, F.5, G, and ADR 3.

**Depends on:** Increment 1 (storage, `contentService`, `StateView`), Increment 2 (the Saved tab placeholder), Increment 3 (`PlayQueueContext`).

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- **One source of truth.** No component may keep its own saved or liked boolean in local state. `useVideoActions`'s in-memory `isSaved` is superseded here.
- Task 4 is one of only two changes to `components/VideoPlayer/` outside Increment 0B; the other is the share sheet in Increment 3 Task 7. Both follow the protected-module workflow in `docs/engineering/video-player.md`: inspect first, make the smallest change, test, and report.
- Likes are local only. No like count is displayed, because there is no server to count with and a fabricated number would be a lie.

---

### Task 1: `SavedContext`

**Files:**
- Create: `contexts/SavedContext.tsx`
- Test: `__tests__/contexts/SavedContext.test.tsx`

**Interfaces:**
- Consumes: `readSaved`, `writeSaved` from `services/storage/savedStorage`; `TIMING.savedWriteDebounceMs` from `constants/config`.
- Produces: `SavedProvider` and `useSaved()` exactly as declared in LLD index section 5.7.

**Ordering rule:** `savedIds` is most-recent-first. Saving an id puts it at the front; saving one already present moves it to the front rather than duplicating it.

- [ ] **Step 1: Write the failing test**

Create `__tests__/contexts/SavedContext.test.tsx`:

```tsx
// __tests__/contexts/SavedContext.test.tsx
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { SavedProvider, useSaved } from "../../contexts/SavedContext";
import * as savedStorage from "../../services/storage/savedStorage";

jest.mock("../../services/storage/savedStorage");
const storage = savedStorage as jest.Mocked<typeof savedStorage>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SavedProvider>{children}</SavedProvider>
);

async function mounted() {
  storage.readSaved.mockResolvedValue({ savedIds: [], likedIds: [] });
  const hook = renderHook(() => useSaved(), { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe("SavedContext", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    storage.writeSaved.mockResolvedValue(undefined);
  });

  it("hydrates from storage on mount", async () => {
    storage.readSaved.mockResolvedValue({ savedIds: ["a", "b"], likedIds: ["a"] });
    const { result } = renderHook(() => useSaved(), { wrapper });

    expect(result.current.hydrated).toBe(false);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.savedIds).toEqual(["a", "b"]);
    expect(result.current.isLiked("a")).toBe(true);
  });

  it("starts empty when storage read fails", async () => {
    storage.readSaved.mockRejectedValue(new Error("disk"));
    const { result } = renderHook(() => useSaved(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.savedIds).toEqual([]);
  });

  it("saves an id to the front of the list", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleSave("a"));
    act(() => result.current.toggleSave("b"));
    expect(result.current.savedIds).toEqual(["b", "a"]);
  });

  it("unsaves an id", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleSave("a"));
    expect(result.current.isSaved("a")).toBe(true);
    act(() => result.current.toggleSave("a"));
    expect(result.current.isSaved("a")).toBe(false);
  });

  it("moves an already-saved id to the front instead of duplicating it", async () => {
    const { result } = await mounted();
    act(() => {
      result.current.toggleSave("a");
      result.current.toggleSave("b");
    });
    act(() => result.current.toggleSave("a")); // unsave
    act(() => result.current.toggleSave("a")); // save again
    expect(result.current.savedIds).toEqual(["a", "b"]);
    expect(result.current.savedIds.filter((id) => id === "a")).toHaveLength(1);
  });

  it("toggles likes independently of saves", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleLike("a"));
    expect(result.current.isLiked("a")).toBe(true);
    expect(result.current.isSaved("a")).toBe(false);
  });

  it("persists changes to storage", async () => {
    const { result } = await mounted();
    act(() => result.current.toggleSave("a"));
    await waitFor(() =>
      expect(storage.writeSaved).toHaveBeenCalledWith(
        expect.objectContaining({ savedIds: ["a"] }),
      ),
    );
  });

  it("does not write during hydration", async () => {
    storage.readSaved.mockResolvedValue({ savedIds: ["a"], likedIds: [] });
    const { result } = renderHook(() => useSaved(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(storage.writeSaved).not.toHaveBeenCalled();
  });

  it("keeps working when a write fails", async () => {
    const { result } = await mounted();
    storage.writeSaved.mockRejectedValue(new Error("disk full"));
    act(() => result.current.toggleSave("a"));
    await waitFor(() => expect(storage.writeSaved).toHaveBeenCalled());
    expect(result.current.isSaved("a")).toBe(true);
  });

  it("reports false for everything before hydration finishes", () => {
    storage.readSaved.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSaved(), { wrapper });
    expect(result.current.hydrated).toBe(false);
    expect(result.current.isSaved("a")).toBe(false);
  });

  it("throws a clear error outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSaved())).toThrow(/SavedProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=SavedContext
```

- [ ] **Step 3: Write the context**

Hold `{ savedIds, likedIds }` in one `useState` so they always write together. Hydrate in a mount effect guarded by a `mountedRef` so a late read cannot set state after unmount.

Gate writes on a `hydratedRef`, so the hydration itself does not immediately write back what it just read.

Debounce writes by `TIMING.savedWriteDebounceMs` and serialize them: keep the pending state in a ref, and let the timer write whatever is latest. That prevents two rapid toggles from racing to interleaved writes. Clear the timer on unmount and flush once.

Catch write rejections, log through `Logger.error`, and leave the in-memory state as it is. Losing a disk write should not silently revert what the user just did on screen.

Memoize the context value.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=SavedContext
```
Expected: 11 passed.

- [ ] **Step 5: Mount the provider**

In `app/_layout.tsx`, wrap the existing tree so the order is `SavedProvider` outside `PlayQueueProvider` outside `ThemeProvider`. Both contexts are independent, so the order is only about readability.

- [ ] **Step 6: Commit**

```bash
git add contexts/SavedContext.tsx app/_layout.tsx __tests__/contexts/SavedContext.test.tsx
git commit -m "feat: add SavedContext as the single source of truth for saves

Hydrates from device storage on mount and writes back through a debounced,
serialized writer so rapid toggles cannot interleave. A failed write logs
and leaves the on-screen state intact rather than silently reverting.

Verified: npm test -- --testPathPattern=SavedContext => 11 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `useSavedVideos`

**Files:**
- Create: `hooks/useSavedVideos.ts`
- Test: `__tests__/hooks/useSavedVideos.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface SavedVideosResult extends Loadable<Video[]> {
  /** Saved ids the catalogue no longer knows about. */
  readonly missingIds: readonly string[];
}
export function useSavedVideos(): SavedVideosResult;
```

**Why `missingIds` is surfaced:** a saved id can outlive the video it points at. The Saved screen shows those rows as unavailable and offers to prune them, rather than silently dropping something the user chose to keep.

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useSavedVideos.test.tsx`:

```tsx
// __tests__/hooks/useSavedVideos.test.tsx
import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useSavedVideos } from "../../hooks/useSavedVideos";
import * as contentService from "../../services/contentService";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

jest.mock("../../services/contentService");
const content = contentService as jest.Mocked<typeof contentService>;

let savedIds: string[] = [];
let hydrated = true;
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds,
    hydrated,
    isSaved: (id: string) => savedIds.includes(id),
    isLiked: () => false,
    toggleSave: jest.fn(),
    toggleLike: jest.fn(),
  }),
}));

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

describe("useSavedVideos", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    savedIds = [];
    hydrated = true;
  });

  it("reports empty when nothing is saved", async () => {
    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(content.getVideosByIds).not.toHaveBeenCalled();
  });

  it("hydrates saved ids into videos", async () => {
    savedIds = ["a", "b"];
    content.getVideosByIds.mockResolvedValue([video("a"), video("b")]);

    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.missingIds).toEqual([]);
  });

  it("preserves the saved order", async () => {
    savedIds = ["b", "a"];
    content.getVideosByIds.mockResolvedValue([video("b"), video("a")]);

    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("reports ids the catalogue no longer has", async () => {
    savedIds = ["a", "gone", "b"];
    content.getVideosByIds.mockResolvedValue([video("a"), video("b")]);

    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.missingIds).toEqual(["gone"]);
  });

  it("stays idle until the saved store has hydrated", () => {
    hydrated = false;
    savedIds = ["a"];
    const { result } = renderHook(() => useSavedVideos());
    expect(result.current.status).toBe("idle");
    expect(content.getVideosByIds).not.toHaveBeenCalled();
  });

  it("reports offline when hydration fails on the network", async () => {
    savedIds = ["a"];
    content.getVideosByIds.mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useSavedVideos());
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });
});
```

- [ ] **Step 2: Run it, implement, run again**

Build on `useLoadable` with `enabled: hydrated`. When `savedIds` is empty, resolve `[]` immediately without calling the service; `isEmpty` then reports `empty`.

Request in batches of `LIMITS.savedHydrateBatch`, concatenating results. Compute `missingIds` by subtracting returned ids from requested ids. Re-sort results into `savedIds` order rather than trusting the service.

Wrap the `load` callback in `useCallback` keyed on `savedIds.join(",")` so it is stable between renders but refreshes when the set changes.

Run:
```bash
npm test -- --testPathPattern=useSavedVideos
```
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSavedVideos.ts __tests__/hooks/useSavedVideos.test.tsx
git commit -m "feat: add useSavedVideos with batching and missing-id reporting

Hydrates saved ids in bounded batches, restores the user's saved order, and
surfaces ids the catalogue no longer has instead of dropping them silently.

Verified: npm test -- --testPathPattern=useSavedVideos => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The Saved screen

**Files:**
- Create: `components/Saved/EmptySaved.tsx`
- Create: `components/Saved/SavedList.tsx`
- Modify: `app/(tabs)/saved.tsx` (replace the Increment 2 placeholder)
- Test: `__tests__/screens/SavedScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/SavedScreen.test.tsx`:

```tsx
// __tests__/screens/SavedScreen.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SavedScreen from "../../app/(tabs)/saved";
import * as savedVideos from "../../hooks/useSavedVideos";
import { makeError } from "../../services/appError";
import type { Video } from "../../types/domain";

const push = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push }) }));

const toggleSave = jest.fn();
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: ["a"],
    hydrated: true,
    isSaved: () => true,
    isLiked: () => false,
    toggleSave,
    toggleLike: jest.fn(),
  }),
}));

const setQueue = jest.fn();
jest.mock("../../contexts/PlayQueueContext", () => ({
  usePlayQueue: () => ({ setQueue }),
}));

jest.mock("../../hooks/useSavedVideos");
const mocked = savedVideos as jest.Mocked<typeof savedVideos>;

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

function mockState(overrides: Record<string, unknown>) {
  mocked.useSavedVideos.mockReturnValue({
    status: "success",
    data: [video("a")],
    error: null,
    retry: jest.fn(),
    missingIds: [],
    ...overrides,
  } as ReturnType<typeof savedVideos.useSavedVideos>);
}

describe("SavedScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists saved videos", () => {
    mockState({});
    render(<SavedScreen />);
    expect(screen.getByText("Video a")).toBeTruthy();
  });

  it("shows an empty state with a hint", () => {
    mockState({ status: "empty", data: [] });
    render(<SavedScreen />);
    expect(screen.getByTestId("saved-empty")).toBeTruthy();
  });

  it("shows an offline state with retry", () => {
    const retry = jest.fn();
    mockState({ status: "offline", data: null, error: makeError("network"), retry });
    render(<SavedScreen />);
    fireEvent.press(screen.getByTestId("saved-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sets the queue from the saved list before opening a video", () => {
    mockState({});
    render(<SavedScreen />);
    fireEvent.press(screen.getByTestId("saved-item-a"));
    expect(setQueue).toHaveBeenCalledWith([video("a")], "a");
    expect(push).toHaveBeenCalledWith("/video/a");
  });

  it("unsaves from the row action", () => {
    mockState({});
    render(<SavedScreen />);
    fireEvent.press(screen.getByTestId("saved-unsave-a"));
    expect(toggleSave).toHaveBeenCalledWith("a");
  });

  it("marks entries whose video no longer exists", () => {
    mockState({ missingIds: ["gone"] });
    render(<SavedScreen />);
    expect(screen.getByTestId("saved-missing-notice")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, build the screen, run again**

`SavedList` renders a `FlatList` keyed on `video.id`, reusing `components/VideoFeed/VideoCard` for each row and adding an unsave `IconButton` with `testID={`saved-unsave-${id}`}`. Each row is pressable with `testID={`saved-item-${id}`}`.

The screen composes `Screen`, `StateView` with `testID="saved-state"`, `EmptySaved` with `testID="saved-empty"`, and, when `missingIds` is non-empty, a notice with `testID="saved-missing-notice"` offering to remove them.

Unsave shows an undo affordance for `TIMING.undoSnackbarMs` before the removal becomes final. Implement it as local screen state holding the pending id; pressing undo re-saves it.

Run:
```bash
npm test -- --testPathPattern=SavedScreen
```
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add components/Saved app/\(tabs\)/saved.tsx __tests__/screens/SavedScreen.test.tsx
git commit -m "feat: add the Saved tab

Lists saved videos most-recent-first from SavedContext, supports unsave with
undo, and flags entries whose video the catalogue no longer has.

Verified: npm test -- --testPathPattern=SavedScreen => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Point the player's Save action at `SavedContext`

**Files:**
- Modify: `components/VideoPlayer/modals/VideoSaveSheet.tsx`
- Test: `__tests__/player/VideoSaveSheet.test.tsx`

**This is a protected-module change.** It is the only edit to `components/VideoPlayer/` outside Increment 0B. Follow `docs/engineering/video-player.md`: read the file and its consumers first, make the smallest change that works, test it, and report what you changed.

**Why:** the sheet currently calls `videoActionsService.getPlaylists()` and `saveToPlaylist()`, both in-memory stubs that forget everything on relaunch. Playlists are classified Later in the HLD. Replacing the playlist picker with one Saved toggle backed by `SavedContext` makes the button do what its label promises.

- [ ] **Step 1: Read the existing file and its caller**

Run:
```bash
sed -n '1,80p' components/VideoPlayer/modals/VideoSaveSheet.tsx
grep -n "VideoSaveSheet" components/VideoPlayer/index.tsx
```
Record the current props (`videoId`, `visible`, `onClose`, `onSaved`) and how `index.tsx` renders it. The props must not change; `index.tsx` is not being edited.

- [ ] **Step 2: Write the failing test**

Create `__tests__/player/VideoSaveSheet.test.tsx`:

```tsx
// __tests__/player/VideoSaveSheet.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { VideoSaveSheet } from "../../components/VideoPlayer/modals/VideoSaveSheet";

const toggleSave = jest.fn();
let saved = false;
jest.mock("../../contexts/SavedContext", () => ({
  useSaved: () => ({
    savedIds: saved ? ["v1"] : [],
    hydrated: true,
    isSaved: () => saved,
    isLiked: () => false,
    toggleSave,
    toggleLike: jest.fn(),
  }),
}));

describe("VideoSaveSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    saved = false;
  });

  it("offers to save a video that is not saved", () => {
    render(<VideoSaveSheet videoId="v1" visible onClose={jest.fn()} />);
    expect(screen.getByTestId("save-sheet-toggle")).toBeTruthy();
    expect(screen.getByText(/save/i)).toBeTruthy();
  });

  it("reflects a video that is already saved", () => {
    saved = true;
    render(<VideoSaveSheet videoId="v1" visible onClose={jest.fn()} />);
    expect(screen.getByText(/saved/i)).toBeTruthy();
  });

  it("toggles through SavedContext, not a playlist service", () => {
    render(<VideoSaveSheet videoId="v1" visible onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId("save-sheet-toggle"));
    expect(toggleSave).toHaveBeenCalledWith("v1");
  });

  it("closes after the user acts", () => {
    const onClose = jest.fn();
    render(<VideoSaveSheet videoId="v1" visible onClose={onClose} />);
    fireEvent.press(screen.getByTestId("save-sheet-toggle"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when not visible", () => {
    render(<VideoSaveSheet videoId="v1" visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId("save-sheet-toggle")).toBeNull();
  });

  it("no longer reaches the playlist service", () => {
    const service = require("../../services/videoActionsService");
    const spy = jest.spyOn(service.videoActionsService, "getPlaylists");
    render(<VideoSaveSheet videoId="v1" visible onClose={jest.fn()} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=VideoSaveSheet
```

- [ ] **Step 4: Rewrite the sheet's body**

Keep the `VideoSaveSheetProps` interface exactly as it is, including the optional `onSaved`. Keep the modal shell, header, and close affordance.

Replace the playlist list, the selection set, the "new playlist" flow, and every `videoActionsService` call with a single pressable carrying `testID="save-sheet-toggle"`. Its label reads "Save" when `isSaved(videoId)` is false and "Saved" when true. Pressing it calls `toggleSave(videoId)`, then `onSaved?.([])` for backward compatibility, then `onClose()`.

Delete the now-unused imports and local state. Leave `PlaylistInfo` in `services/videoActionsService.ts`; other code may still reference the type, and removing it is out of scope.

- [ ] **Step 5: Verify, including the player's own tests**

Run:
```bash
npm test -- --testPathPattern="VideoSaveSheet|VideoPlayer"
npx tsc --noEmit 2>&1 | grep -c "VideoSaveSheet"
```
Expected: all pass, `0` type errors.

- [ ] **Step 6: Check it end to end on a device**

Run:
```bash
npm start
```
Save a video from the player, open the Saved tab and confirm it appears, force-quit the app, relaunch, and confirm it is still there. This is the check that proves persistence actually works, which no unit test can.

- [ ] **Step 7: Commit**

```bash
git add components/VideoPlayer/modals/VideoSaveSheet.tsx __tests__/player/VideoSaveSheet.test.tsx
git commit -m "feat(player): back the Save sheet with SavedContext

The sheet previously wrote to an in-memory playlist stub that forgot
everything on relaunch. It is now a single Save toggle persisted on the
device, so the button does what its label promises. Playlists remain
out of MVP scope. Props are unchanged, so index.tsx is untouched.

Protected-module change per docs/engineering/video-player.md.

Verified: npm test => all suites pass
Verified: on device, save survives a force-quit and relaunch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] A video saved from the player appears in the Saved tab.
- [ ] Saves survive a force-quit and relaunch, verified on a device.
- [ ] No component holds its own saved or liked boolean.
- [ ] The Saved tab renders loading, empty, success, offline, and missing-entry states.
- [ ] Unsave offers undo.
- [ ] `npm test` passes and no new type errors were introduced.
