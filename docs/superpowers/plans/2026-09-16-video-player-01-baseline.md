# Increment 0 — Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`, inline in this session (CLAUDE.md §0 forbids subagents). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-09-16-video-player-00-index.md` first. Its Global Constraints apply to every task here.

**Goal:** Make the main checkout able to run the full quality gate, add the test infrastructure the redesign needs, lock the current player's visible behaviour in characterization tests, and record performance baselines, without changing any production code.

**Architecture:** Tests and configuration only. The single production change is adding the `expo-brightness` dependency (ADR 0010), which nothing imports yet.

**Tech Stack:** Jest 29, jest-expo 54, React Native Testing Library 13, expo-brightness 14.0.x.

**Spec:** `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` §10 step S0; `docs/player/10-migration-and-swap.md` §1 row 0 and §3; `docs/player/09-test-plan.md` §2, §3.7; `docs/player/08-reliability-and-performance.md` §3.

## Global Constraints

See the index. Additionally for this increment:
- No file under `components/`, `hooks/`, `services/`, `contexts/`, `app/` is modified.
- `package.json` changes are limited to: the `test:web` script, the `setupFilesAfterEnv` entry, and the `expo-brightness` dependency.

## Verified Starting State (2026-09-16, `main` at `10e654b`)

```
ls node_modules/@testing-library            → not found
npx tsc --noEmit | grep -c "error TS"       → 55 (31 are TS2307 for the missing test library; 18 pre-existing outside scope; 6 route-typing errors in tests)
git worktree list                           → main + .worktrees/mvp-implementation
```

---

### Task 1: Restore the test toolchain in the main checkout

**Files:**
- Modify: `package-lock.json` (by `npm install` only)
- Create: `docs/superpowers/plans/2026-09-16-video-player-01-report.md` (started here, completed in Task 8)

**Interfaces:**
- Produces: a checkout where `npm test` runs. Every later task depends on it.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install
```
Expected: completes without `ERR!`. If `npm install` reports peer-dependency conflicts, re-run with `npm install --legacy-peer-deps` and record that flag in the report.

- [ ] **Step 2: Confirm the test library is present**

Run:
```bash
ls node_modules/@testing-library/react-native/package.json
```
Expected: the path prints.

- [ ] **Step 3: Run the existing suite and record the counts**

Run:
```bash
npm test 2>&1 | tail -8
```
Expected: `Test Suites: 42 passed, 42 total` and `Tests: 375 passed, 375 total` (the counts recorded on 2026-09-16 in `verification-report-2026-09-16.md`). If the numbers differ, record the actual numbers; do not stop unless a suite fails. A failing suite is reported in the report file and this plan stops until a human decides.

- [ ] **Step 4: Run the type check and record the count**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `24` or fewer (55 minus the 31 TS2307 errors). Record the exact number and the per-file breakdown from:
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | sed 's/(.*//' | sort | uniq -c | sort -rn
```

- [ ] **Step 5: Start the report file**

Create `docs/superpowers/plans/2026-09-16-video-player-01-report.md`:

```markdown
# Increment 0 — Baseline Report

Date: <YYYY-MM-DD>
Branch: feature/player-0-baseline

## Task 1 — Toolchain
- `npm install`: <completed | completed with --legacy-peer-deps>
- `npm test`: <N> suites, <N> tests, <passed/failed>
- `npx tsc --noEmit`: <N> errors; breakdown:
  <paste breakdown>
```

- [ ] **Step 6: Commit**

```bash
git checkout -b feature/player-0-baseline
git add package-lock.json docs/superpowers/plans/2026-09-16-video-player-01-report.md
git commit -m "chore(test): restore test toolchain in main checkout

npm install brings back @testing-library/react-native, which the main
checkout lacked (31 TS2307 errors in __tests__).

Verified: npm test => <N> suites passed, <N> tests passed
Verified: npx tsc --noEmit => <N> errors (all pre-existing, listed in report)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Shared Jest setup file with native-module mocks

**Files:**
- Create: `__tests__/harness/setup.ts`
- Modify: `package.json` (`jest.setupFilesAfterEnv`)
- Test: `__tests__/harness/setup.test.ts`

**Interfaces:**
- Produces: global mocks for `expo-screen-orientation`, `expo-brightness`, `expo-haptics`, and `react-native-reanimated` available in every test. Increments 1–4 rely on these names and shapes.

- [ ] **Step 1: Write the failing test**

Create `__tests__/harness/setup.test.ts`:

```ts
// __tests__/harness/setup.test.ts
// Proves the shared setup file registers the native-module mocks every
// player test relies on. If this fails, the setup file is not wired into
// package.json jest.setupFilesAfterEnv.
import * as ScreenOrientation from "expo-screen-orientation";
import * as Brightness from "expo-brightness";
import * as Haptics from "expo-haptics";

describe("shared jest setup", () => {
  it("mocks expo-screen-orientation lockAsync as a resolved jest.fn", async () => {
    await expect(ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)).resolves.toBeUndefined();
    expect(jest.isMockFunction(ScreenOrientation.lockAsync)).toBe(true);
  });

  it("mocks expo-brightness get/set", async () => {
    await expect(Brightness.getBrightnessAsync()).resolves.toBe(0.5);
    await expect(Brightness.setBrightnessAsync(0.2)).resolves.toBeUndefined();
  });

  it("mocks expo-haptics impactAsync", async () => {
    await expect(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- --testPathPattern=harness/setup`
Expected: FAIL — `Cannot find module 'expo-brightness'` (not installed yet) or real native calls rejecting.

- [ ] **Step 3: Install expo-brightness**

Run:
```bash
npx expo install expo-brightness
```
Expected: `package.json` gains `"expo-brightness": "~14.0.x"`. Then:
```bash
npx expo-doctor
```
Expected: `Didn't find any issues with the project!` (or only the pre-existing warnings recorded in Task 1). Record the output in the report.

- [ ] **Step 4: Create the setup file**

Create `__tests__/harness/setup.ts`:

```ts
// __tests__/harness/setup.ts
// Loaded by jest.setupFilesAfterEnv for every test file. Mocks native
// modules the player touches so tests never hit a device API.

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  addOrientationChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  removeOrientationChangeListener: jest.fn(),
  OrientationLock: {
    DEFAULT: 0,
    ALL: 1,
    PORTRAIT: 2,
    PORTRAIT_UP: 3,
    PORTRAIT_DOWN: 4,
    LANDSCAPE: 5,
    LANDSCAPE_LEFT: 6,
    LANDSCAPE_RIGHT: 7,
  },
  Orientation: {
    UNKNOWN: 0,
    PORTRAIT_UP: 1,
    PORTRAIT_DOWN: 2,
    LANDSCAPE_LEFT: 3,
    LANDSCAPE_RIGHT: 4,
  },
}));

jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  return Reanimated;
});
```

- [ ] **Step 5: Wire it into package.json**

In `package.json`, change:
```json
"setupFilesAfterEnv": [
  "@testing-library/react-native/build/matchers/extend-expect"
],
```
to:
```json
"setupFilesAfterEnv": [
  "@testing-library/react-native/build/matchers/extend-expect",
  "<rootDir>/__tests__/harness/setup.ts"
],
```

- [ ] **Step 6: Run the new test and the whole suite**

Run: `npm test -- --testPathPattern=harness/setup`
Expected: 3 passed.

Run: `npm test 2>&1 | tail -6`
Expected: all suites still pass (the existing `VideoPlayer.render.test.tsx` mocks `expo-screen-orientation` itself; Jest allows a file-level `jest.mock` to override the setup mock, so no conflict). If any existing suite fails because of the Reanimated mock, remove the Reanimated block from `setup.ts`, re-run, and record in the report that Reanimated is mocked per-file instead.

- [ ] **Step 7: Commit**

```bash
git add __tests__/harness/setup.ts __tests__/harness/setup.test.ts package.json package-lock.json
git commit -m "test(harness): add shared native-module mocks and expo-brightness

Adds __tests__/harness/setup.ts (screen-orientation, brightness, haptics,
reanimated mocks) to jest.setupFilesAfterEnv. Installs expo-brightness
14.0.x per ADR 0010; nothing imports it yet.

Verified: npm test -- --testPathPattern=harness/setup => 3 passed
Verified: npm test => <N> suites passed
Verified: npx expo-doctor => no issues

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Web Jest project

**Files:**
- Create: `jest.web.config.js`
- Create: `__tests__/harness/setup.web.ts`
- Create: `__tests__/player/platform/smoke.web.test.ts`
- Modify: `package.json` (`scripts.test:web`)

**Interfaces:**
- Produces: `npm run test:web`, which runs files matching `__tests__/player/platform/*.web.test.ts` in jsdom with web platform resolution. Increment 2 adds the real adapter tests.

- [ ] **Step 1: Write the failing smoke test**

Create `__tests__/player/platform/smoke.web.test.ts`:

```ts
// __tests__/player/platform/smoke.web.test.ts
// Proves the web Jest project runs in jsdom and resolves the web platform.
import { Platform } from "react-native";

describe("web jest project", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
    expect(typeof document.createElement).toBe("function");
  });

  it("resolves Platform.OS to web", () => {
    expect(Platform.OS).toBe("web");
  });
});
```

- [ ] **Step 2: Add the script and confirm it fails**

In `package.json` `scripts`, add after `"test": "jest",`:
```json
"test:web": "jest -c jest.web.config.js",
```
Run: `npm run test:web`
Expected: FAIL — config file not found.

- [ ] **Step 3: Create the config and setup**

Create `jest.web.config.js`:

```js
// jest.web.config.js
// Second Jest project for platform adapters' .web.ts implementations.
// The default project (package.json "jest") resolves .native.ts files.
module.exports = {
  preset: "jest-expo/web",
  testEnvironment: "jsdom",
  testMatch: ["**/__tests__/player/platform/*.web.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/harness/setup.web.ts"],
  moduleNameMapper: {
    "\\.svg$": "<rootDir>/__mocks__/svgMock.js",
  },
};
```

Create `__tests__/harness/setup.web.ts`:

```ts
// __tests__/harness/setup.web.ts
// Web project setup. No native mocks are needed: web adapters use DOM APIs
// that jsdom provides or that each test stubs explicitly.
export {};
```

- [ ] **Step 4: Run it**

Run: `npm run test:web`
Expected: 2 passed.

If the error is `Preset jest-expo/web not found`, replace the `preset` line with `preset: "jest-expo",` and add `haste: { defaultPlatform: "web", platforms: ["web"] },`, re-run, and record in the report which variant was used.

If `testEnvironment: "jsdom"` fails with `Cannot find module 'jest-environment-jsdom'`, run `npm install --save-dev jest-environment-jsdom@29` (this is a test-only dependency matching the installed Jest major; record it in the report as an additional dev dependency) and re-run.

- [ ] **Step 5: Confirm the default project ignores web tests**

Run: `npm test -- --testPathPattern=smoke.web`
Expected: `No tests found` is **not** acceptable if the file ran and failed; the acceptable outcomes are "0 matched" or the test passing. If the default project executes the file and `Platform.OS` is `"ios"`, add to `package.json` `jest`:
```json
"testPathIgnorePatterns": ["/node_modules/", "\\.web\\.test\\.tsx?$"],
```
and re-run both `npm test` and `npm run test:web`.

- [ ] **Step 6: Commit**

```bash
git add jest.web.config.js __tests__/harness/setup.web.ts __tests__/player/platform/smoke.web.test.ts package.json package-lock.json
git commit -m "test(web): add jest web project and test:web script

Second Jest config resolving .web.ts platform files in jsdom, needed for
the platform adapters in Increment 2 (ADR 0005).

Verified: npm run test:web => 2 passed
Verified: npm test => <N> suites passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Architecture invariant tests

**Files:**
- Create: `__tests__/player/invariants.test.ts`

**Interfaces:**
- Produces: R1, R2, R7 checks and the "old root byte-identical to main" check. Later increments activate R3–R6 and R9 by editing the `ACTIVE_RULES` array in this file (each activation is a step in that increment's plan).

- [ ] **Step 1: Write the test file**

Create `__tests__/player/invariants.test.ts`:

```ts
// __tests__/player/invariants.test.ts
// Enforces the dependency rules from docs/player/03-architecture.md §2 by
// reading the source tree. Rules are activated increment by increment via
// ACTIVE_RULES; an inactive rule is skipped, never deleted.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PLAYER_DIR = join(ROOT, "components", "VideoPlayer");

type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R9" | "OLD_ROOT_FROZEN";
const ACTIVE_RULES: readonly RuleId[] = ["R1", "R2", "R7", "OLD_ROOT_FROZEN"];

/** New-code folders. Rules R3–R6 and R9 apply here until Increment 7 widens them. */
const NEW_FOLDERS = ["engine", "platform", "gestures", "ui", "hooks"].map((f) => join(PLAYER_DIR, f));

function listFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join("/");
}

function active(rule: RuleId): boolean {
  return ACTIVE_RULES.includes(rule);
}

describe("player architecture invariants", () => {
  const appAndComponents = [...listFiles(join(ROOT, "app")), ...listFiles(join(ROOT, "components"))];
  const playerFiles = listFiles(PLAYER_DIR);
  const newFolderFiles = NEW_FOLDERS.flatMap((f) => listFiles(f));

  (active("R1") ? it : it.skip)("R1: only VideoPlaybackContainer imports components/VideoPlayer", () => {
    const offenders = appAndComponents
      .filter((f) => !f.startsWith(PLAYER_DIR))
      .filter((f) => !rel(f).endsWith("components/Video/VideoPlaybackContainer.tsx"))
      .filter((f) => /from\s+["'][^"']*components\/VideoPlayer(\/|["'])/.test(read(f)) || /from\s+["']\.\.\/VideoPlayer["']/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("R2") ? it : it.skip)("R2: player imports no app contexts/services/hooks/app at runtime", () => {
    // Type-only imports are allowed (`import type`). Only runtime imports are checked.
    const pattern = /^import\s+(?!type\s)[^;]*from\s+["'](?:\.\.\/)+(contexts|services|hooks|app)\//m;
    const offenders = playerFiles
      .filter((f) => newFolderFiles.includes(f) || rel(f) === "components/VideoPlayer/Player.tsx" || rel(f) === "components/VideoPlayer/types.ts")
      .filter((f) => pattern.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("R3") ? it : it.skip)("R3: only the engine and PlayerSurface import expo-video", () => {
    const allowed = new Set([
      "components/VideoPlayer/engine/PlaybackEngine.ts",
      "components/VideoPlayer/engine/usePlaybackEngine.ts",
      "components/VideoPlayer/ui/PlayerSurface.tsx",
    ]);
    const offenders = newFolderFiles
      .filter((f) => /from\s+["']expo-video["']/.test(read(f)))
      .map(rel)
      .filter((r) => !allowed.has(r));
    expect(offenders).toEqual([]);
  });

  (active("R4") ? it : it.skip)("R4: no Platform.OS / Platform.select outside platform/", () => {
    const offenders = newFolderFiles
      .filter((f) => !rel(f).includes("/platform/"))
      .filter((f) => /Platform\.(OS|select)/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("R5") ? it : it.skip)("R5: no legacy Animated or react-native-paper in the player", () => {
    const offenders = newFolderFiles
      .filter((f) => /from\s+["']react-native-paper["']/.test(read(f)) || /\bAnimated\.(Value|timing|spring|View)\b/.test(read(f).replace(/react-native-reanimated/g, "")))
      .map(rel)
      .filter((r) => !/Reanimated/.test(read(join(ROOT, r))) || /from\s+["']react-native-paper["']/.test(read(join(ROOT, r))));
    expect(offenders).toEqual([]);
  });

  (active("R6") ? it : it.skip)("R6: no `any` in new player code", () => {
    const offenders = newFolderFiles
      .filter((f) => /:\s*any\b|as\s+any\b|<any>/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("R7") ? it : it.skip)("R7: Shorts and useShortsPlayer are unchanged from main", () => {
    let diff = "";
    try {
      diff = execSync("git diff --stat main -- components/Shorts hooks/useShortsPlayer.ts", { cwd: ROOT }).toString().trim();
    } catch {
      // git unavailable (CI without history): record and pass with a console note.
      console.warn("R7 skipped: git not available");
      return;
    }
    expect(diff).toBe("");
  });

  (active("R9") ? it : it.skip)("R9: file line budgets", () => {
    const budgets: Record<string, number> = {
      "components/VideoPlayer/Player.tsx": 250,
      "components/VideoPlayer/engine/playbackReducer.ts": 300,
    };
    const offenders = [...newFolderFiles, join(PLAYER_DIR, "Player.tsx")]
      .filter((f) => {
        const lines = read(f).split("\n").length;
        return lines > (budgets[rel(f)] ?? 200);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("OLD_ROOT_FROZEN") ? it : it.skip)("old components/VideoPlayer/index.tsx is byte-identical to main", () => {
    let fromMain = "";
    try {
      fromMain = execSync("git show main:components/VideoPlayer/index.tsx", { cwd: ROOT }).toString();
    } catch {
      console.warn("OLD_ROOT_FROZEN skipped: git not available");
      return;
    }
    const current = read(join(PLAYER_DIR, "index.tsx"));
    expect(current.replace(/\r\n/g, "\n")).toBe(fromMain.replace(/\r\n/g, "\n"));
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- --testPathPattern=invariants`
Expected: R1, R2, R7, OLD_ROOT_FROZEN pass; the others show as skipped. If R1 fails, the offender list tells you which file imports the player; that is a real violation introduced since the MVP verification — report it, do not "fix" the test.

- [ ] **Step 3: Commit**

```bash
git add __tests__/player/invariants.test.ts
git commit -m "test(player): add architecture invariant tests (R1, R2, R7, frozen old root)

Source-tree checks for the dependency rules in docs/player/03-architecture.md.
R3-R6 and R9 are present but inactive until their folders exist.

Verified: npm test -- --testPathPattern=invariants => 4 passed, 5 skipped

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Extend characterization tests of the old player (parity rows C1–C9, C14, C16, C19)

**Files:**
- Modify: `__tests__/player/VideoPlayer.render.test.tsx`

**Interfaces:**
- Consumes: the old default export of `components/VideoPlayer` and its 20 props.
- Produces: the behaviours Increment 4's `VideoPlayer.parity.test.tsx` must reproduce against `Player.tsx`. Row ids match `docs/player/10-migration-and-swap.md` §3.

- [ ] **Step 1: Read the existing file**

Open `__tests__/player/VideoPlayer.render.test.tsx`. Keep its mocks (`expo-video`, `expo-screen-orientation`, `react-native-safe-area-context`, `SavedContext`) and its four tests. The new tests go into a second `describe` block at the end of the file.

- [ ] **Step 2: Add the parity characterization block**

Append to `__tests__/player/VideoPlayer.render.test.tsx`:

```tsx
// Parity rows from docs/player/10-migration-and-swap.md §3.
// These lock the OLD player's visible behaviour so the NEW player can be
// checked against it in Increment 4. Do not weaken a row to make it pass;
// if a row does not hold today, record the actual behaviour in the report.
describe("VideoPlayer parity characterization (old player)", () => {
  const baseProps = {
    sourceUrl: MP4,
    videoId: "v1",
    videoTitle: "Gayatri Yagya",
    videoUrl: MP4,
    channelId: "c1",
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("C3: mounts one VideoView with native controls and native fullscreen disabled", () => {
    render(<VideoPlayer {...baseProps} />);
    const views = screen.getAllByTestId("expo-video-view");
    expect(views).toHaveLength(1);
    expect(views[0].props.nativeControls).toBe(false);
    expect(views[0].props.allowsFullscreen).toBe(false);
  });

  it("C4: calls play() on mount when autoplay is default (true)", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video") as { useVideoPlayer: jest.Mock };
    render(<VideoPlayer {...baseProps} />);
    const player = useVideoPlayer.mock.results[0]?.value as { play: jest.Mock };
    expect(player.play).toHaveBeenCalled();
  });

  it("C4: does not call play() on mount when autoplay is false", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video") as { useVideoPlayer: jest.Mock };
    render(<VideoPlayer {...baseProps} autoplay={false} />);
    const player = useVideoPlayer.mock.results[0]?.value as { play: jest.Mock };
    expect(player.play).not.toHaveBeenCalled();
  });

  it("C5/C6: next and previous buttons call their handlers when enabled", () => {
    const onNext = jest.fn();
    const onPrev = jest.fn();
    render(
      <VideoPlayer {...baseProps} hasNextVideo hasPreviousVideo onNavigateToNext={onNext} onNavigateToPrevious={onPrev} />,
    );
    fireEvent.press(screen.getByLabelText(/next video/i));
    fireEvent.press(screen.getByLabelText(/previous video/i));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("C5: next and previous buttons are disabled when no neighbour exists", () => {
    const onNext = jest.fn();
    render(<VideoPlayer {...baseProps} hasNextVideo={false} hasPreviousVideo={false} onNavigateToNext={onNext} />);
    fireEvent.press(screen.getByLabelText(/next video/i));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("C7: minimize button calls onToggleMinimize", () => {
    const onToggleMinimize = jest.fn();
    render(<VideoPlayer {...baseProps} onToggleMinimize={onToggleMinimize} />);
    fireEvent.press(screen.getByLabelText(/minimize/i));
    expect(onToggleMinimize).toHaveBeenCalledTimes(1);
  });

  it("C9: fullscreen button toggles and reports onFullscreenChange(true)", async () => {
    const onFullscreenChange = jest.fn();
    render(<VideoPlayer {...baseProps} onFullscreenChange={onFullscreenChange} />);
    // Initial notification with false happens on mount.
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
    fireEvent.press(screen.getByLabelText(/fullscreen/i));
    await waitFor(() => expect(onFullscreenChange).toHaveBeenLastCalledWith(true));
  });

  it("C14: dislike, download and clip buttons are hidden by feature flags", () => {
    render(<VideoPlayer {...baseProps} />);
    expect(screen.queryByLabelText(/dislike/i)).toBeNull();
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    expect(screen.queryByLabelText(/clip/i)).toBeNull();
  });

  it("C10/C11: progress bar and action bar are absent when videoId is missing", () => {
    render(<VideoPlayer sourceUrl={MP4} />);
    expect(screen.queryByLabelText(/like/i)).toBeNull();
    expect(screen.queryByLabelText(/share/i)).toBeNull();
  });
});
```

Add `fireEvent` and `waitFor` to the existing RNTL import at the top of the file:
```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
```

- [ ] **Step 3: Run and reconcile labels**

Run: `npm test -- --testPathPattern=VideoPlayer.render`

Expected: most rows pass. Where a `getByLabelText` fails, open the corresponding old component (`NextVideoButton.tsx`, `PreviousVideoButton.tsx`, `MinimizeButton.tsx`, `FullscreenButton.tsx`, `VideoActionBar.tsx`) and read its `accessibilityLabel`; adjust the regex in the test to the label that actually exists. Do not edit the component. Record each label used in the report under "Parity labels (old player)": the new player must use labels that match these regexes or the parity test is updated with an explicit "intentional change" note.

If C9 fails because `StatusBar.setHidden` or `ScreenOrientation.lockAsync` throws in Jest, add `jest.spyOn(StatusBar, "setHidden").mockImplementation(() => undefined)` in a `beforeEach` (import `StatusBar` from `react-native`) and re-run.

- [ ] **Step 4: Commit**

```bash
git add __tests__/player/VideoPlayer.render.test.tsx
git commit -m "test(player): characterize old player parity rows C3-C11, C14

Locks visible behaviour of the current player (VideoView props, autoplay,
next/previous, minimize, fullscreen callback, flag-hidden actions) for the
Increment 4 parity suite.

Verified: npm test -- --testPathPattern=VideoPlayer.render => <N> passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Bundle-size baseline (P8)

**Files:**
- Create: `docs/player/baselines/2026-09-XX-current-player.md`

**Interfaces:**
- Produces: the number Increment 7 compares against for P8.

- [ ] **Step 1: Export the Android bundle with source maps**

Run:
```bash
npx expo export --platform android --source-maps --output-dir .baseline-export
```
Expected: a `dist`-style folder `.baseline-export/_expo/static/js/android/` with one `.js` and one `.js.map`. This takes several minutes. If the command fails on `--source-maps`, try `--dump-sourcemap` (older flag) and record which worked.

- [ ] **Step 2: Measure the player's contribution**

Run:
```bash
npx source-map-explorer .baseline-export/_expo/static/js/android/*.js --json > .baseline-export/smx.json
node -e "const r=require('./.baseline-export/smx.json');const f=r.results[0].files;let p=0,t=0;for(const [k,v] of Object.entries(f)){t+=v.size;if(/components\/VideoPlayer|hooks\/useVideoProgress|hooks\/useVideoActions|services\/videoActionsService/.test(k))p+=v.size}console.log(JSON.stringify({playerBytes:p,totalBytes:t,percent:(100*p/t).toFixed(2)}))"
```
Expected: a JSON line like `{"playerBytes":…, "totalBytes":…, "percent":"…"}`. `npx source-map-explorer` downloads the tool on first use; that is acceptable for a one-off measurement and is not added to `package.json`.

- [ ] **Step 3: Record the baseline**

Create `docs/player/baselines/2026-09-XX-current-player.md` (replace XX with today's day):

```markdown
# Current player baseline — <date>

Revision: <git rev-parse --short HEAD>
Command: npx expo export --platform android --source-maps

| Metric | Value |
|---|---|
| P8 player bytes (components/VideoPlayer + useVideoProgress + useVideoActions + videoActionsService) | <playerBytes> |
| P8 total bundle bytes | <totalBytes> |
| P8 player share | <percent> % |
| P1 MP4 time to first frame | not measured — <reason, e.g. no device in this session> |
| P2 HLS time to first frame | not measured — <reason> |
| P4 renders/s while playing | not measured — <reason> |
| P5 memory growth after 10 source changes | not measured — <reason> |
| P9 battery 30 min | not measured — <reason> |

Device measurements (P1, P2, P4, P5, P9) require a physical device and the
procedure in docs/player/08-reliability-and-performance.md §2. Fill them in
when a device is available; do not estimate.
```

- [ ] **Step 4: Clean up and commit**

```bash
rm -rf .baseline-export
git add docs/player/baselines/
git commit -m "docs(player): record current player bundle baseline (P8)

Verified: source-map-explorer => player <playerBytes> B of <totalBytes> B (<percent>%)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Add `.baseline-export/` to `.gitignore` only if it was accidentally committed; otherwise leave `.gitignore` alone.

---

### Task 7: Device baselines (P1, P2, P4, P5) — run only if a device is available

**Files:**
- Modify: `docs/player/baselines/2026-09-XX-current-player.md`

- [ ] **Step 1: Decide**

If no physical Android or iOS device is attached in this session, skip this task and leave the "not measured" rows as written in Task 6. Write "Task 7 skipped: no device" in the report. Do not fabricate numbers.

- [ ] **Step 2: If a device is available, follow `docs/player/08-reliability-and-performance.md` §2 rows P1, P2, P4, P5 exactly, using the temporary dev-only listener described there, and fill the table.**

- [ ] **Step 3: Remove any temporary instrumentation and confirm the tree is clean except the baseline file**

Run: `git status --short`
Expected: only `docs/player/baselines/...` modified.

- [ ] **Step 4: Commit**

```bash
git add docs/player/baselines/
git commit -m "docs(player): record device baselines for current player

Verified: measured on <device model, OS version>, <network condition>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Increment report and gate

**Files:**
- Modify: `docs/superpowers/plans/2026-09-16-video-player-01-report.md`

- [ ] **Step 1: Run the full gate**

```bash
npm test 2>&1 | tail -6
npm run test:web 2>&1 | tail -6
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx expo-doctor
```

- [ ] **Step 2: Complete the report**

Append to the report file:

```markdown
## Gate
- npm test: <N> suites, <N> tests passed
- npm run test:web: <N> passed
- npm run lint: <N> errors, <N> warnings (baseline before this increment: 1 error, 396 warnings)
- npx tsc --noEmit: <N> errors, all pre-existing in Comments/GlobalErrorLogger/ShortsSearchBar/useVoiceSearch/test route typing
- npx expo-doctor: <output>

## Parity labels (old player)
| Row | Label regex used | Component |
|---|---|---|
| C5/C6 next | /next video/i | NextVideoButton.tsx |
| ... | ... | ... |

## Baselines
See docs/player/baselines/<file>.md. Device rows: <measured | not measured — reason>.

## Not done / limitations
- <anything skipped, with the reason>
```

- [ ] **Step 3: Commit and hand over**

```bash
git add docs/superpowers/plans/2026-09-16-video-player-01-report.md
git commit -m "docs: Increment 0 baseline report

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Increment 0 exit criteria (from `docs/player/10-migration-and-swap.md` §1): `npm test` green, `npm run test:web` green, baseline table committed, `expo-doctor` clean. If all hold, the branch is ready for review and merge to `main`; Increment 1 branches from `main` after the merge.
