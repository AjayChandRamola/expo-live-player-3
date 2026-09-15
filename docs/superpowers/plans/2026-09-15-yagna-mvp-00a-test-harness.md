# Increment 0A — Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first.** It holds the shared contracts and global constraints this plan assumes.

**Goal:** Make `npm test` run and pass, so every later increment can be built test-first.

**Architecture:** Restore the Jest toolchain that `package.json` already references but never installed. Pin one drifting dependency that blocks installation. Repair the three existing broken test files.

**Tech Stack:** Jest 29.7.0, jest-expo 54.0.18, React Native Testing Library 13.3.3, react-test-renderer 19.1.0.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md` (Increment 0 prerequisite; see deviation D2 in the LLD index).

## Why this increment exists

`package.json` declares `"test": "jest"` with a `jest-expo` preset, but neither `jest` nor `jest-expo` nor any testing library is in `devDependencies`. Running `npm test` today prints `'jest' is not recognized as an internal or external command`. The HLD's Increment 0 exit criterion "existing tests pass" is therefore unreachable until this is fixed.

## Global Constraints

All constraints from the LLD index apply. Two are specific here:

- These are the **only** dependency additions permitted in the whole MVP, and all four are `devDependencies`.
- `react-native` is pinned from `^0.81.4` to `0.81.4` exactly. This is a **pin, not an upgrade**: the installed version today is 0.81.5 and the range would drift to 0.81.6, which requires `react@^19.1.4` while this project pins `react@19.1.0`. Pinning to 0.81.4 (whose peer range is `react@^19.1.0`) is what Expo SDK 54 expects and is the minimum change that makes `npm install` resolve.

---

### Task 1: Pin react-native and install the test toolchain

**Files:**
- Modify: `package.json` (dependencies, devDependencies, jest config)

**Interfaces:**
- Produces: a working `npx jest` binary at `node_modules/.bin/jest`, and the global test matchers from `@testing-library/react-native/extend-expect`.

- [ ] **Step 1: Record the baseline failure**

Run:
```bash
npm test
```
Expected: fails with `'jest' is not recognized as an internal or external command`. Copy the output into the task notes. If it instead runs, stop: the baseline has changed and this plan needs review.

- [ ] **Step 2: Pin react-native to the exact Expo SDK 54 version**

In `package.json`, under `"dependencies"`, change this one line:

```diff
-    "react-native": "^0.81.4",
+    "react-native": "0.81.4",
```

Change nothing else in `dependencies`.

- [ ] **Step 3: Verify the pin resolves the dependency conflict**

Run:
```bash
npm install --save-dev --dry-run jest@29.7.0 jest-expo@54.0.18 @testing-library/react-native@13.3.3 react-test-renderer@19.1.0
```
Expected: a summary line like `added 175 packages ... in 8s`.
If you instead see `npm error code ERESOLVE`, stop and report. **Do not pass `--force` or `--legacy-peer-deps`** — the pin is meant to make the tree resolve honestly, and masking it hides a real version conflict.

- [ ] **Step 4: Install for real**

Run:
```bash
npm install --save-dev jest@29.7.0 jest-expo@54.0.18 @testing-library/react-native@13.3.3 react-test-renderer@19.1.0
```
Expected: completes without `ERESOLVE`.

- [ ] **Step 5: Replace the jest configuration block**

The current block references `@testing-library/jest-native`, which is deprecated and is **not** being installed. React Native Testing Library 13.3 ships the same matchers. In `package.json`, replace the entire `"jest"` block with:

```json
  "jest": {
    "preset": "jest-expo",
    "testMatch": [
      "**/__tests__/**/*.test.[jt]s?(x)"
    ],
    "setupFilesAfterEnv": [
      "@testing-library/react-native/extend-expect"
    ],
    "moduleNameMapper": {
      "\\.svg$": "<rootDir>/__mocks__/svgMock.js"
    },
    "collectCoverageFrom": [
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "services/**/*.{ts,tsx}",
      "contexts/**/*.{ts,tsx}"
    ]
  }
```

The `moduleNameMapper` entry is required because `app/(tabs)/_layout.tsx` imports `.svg` files through `react-native-svg-transformer`, which Metro handles but Jest does not.

- [ ] **Step 6: Create the SVG mock**

Create `__mocks__/svgMock.js`:

```js
// __mocks__/svgMock.js
// Jest cannot process .svg through react-native-svg-transformer (Metro-only).
// Every .svg import resolves to this inert component instead.
const React = require('react');

function SvgMock(props) {
  return React.createElement('SvgMock', props, props.children);
}

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.ReactComponent = SvgMock;
```

- [ ] **Step 7: Verify jest is installed and runnable**

Run:
```bash
npx jest --version
```
Expected: `29.7.0`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json __mocks__/svgMock.js
git commit -m "chore: install jest toolchain and pin react-native to 0.81.4

npm test previously failed because jest, jest-expo, and the testing
library were referenced by the jest config but never installed.
Pinning react-native to the exact Expo SDK 54 version resolves an
ERESOLVE conflict: the ^0.81.4 range drifts to 0.81.6, which requires
react ^19.1.4 while this project pins react 19.1.0.

Verified: npx jest --version prints 29.7.0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Prove the harness works with a smoke test

**Files:**
- Create: `__tests__/harness/smoke.test.tsx`

**Interfaces:**
- Produces: proof that `jest-expo` transforms TSX, that RNTL renders a React Native tree, and that the extended matchers are loaded. Every later test depends on all three.

- [ ] **Step 1: Write the smoke test**

Create `__tests__/harness/smoke.test.tsx`:

```tsx
// __tests__/harness/smoke.test.tsx
// Proves the Jest + jest-expo + RNTL toolchain is wired correctly.
// If this fails, no other test in the repo can be trusted.
import React from "react";
import { Text, View } from "react-native";
import { render, screen } from "@testing-library/react-native";

function Greeting({ name }: { name: string }) {
  return (
    <View testID="greeting-root">
      <Text>Namaste {name}</Text>
    </View>
  );
}

describe("test harness", () => {
  it("renders a React Native component tree", () => {
    render(<Greeting name="Yagna" />);
    expect(screen.getByTestId("greeting-root")).toBeTruthy();
  });

  it("finds text content", () => {
    render(<Greeting name="Yagna" />);
    expect(screen.getByText("Namaste Yagna")).toBeTruthy();
  });

  it("loads the extended matchers from @testing-library/react-native", () => {
    render(<Greeting name="Yagna" />);
    // toBeOnTheScreen comes from extend-expect, not from core Jest.
    expect(screen.getByTestId("greeting-root")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run the smoke test**

Run:
```bash
npm test -- --testPathPattern=harness
```
Expected: `Tests: 3 passed`.

If the third test fails with `toBeOnTheScreen is not a function`, the `setupFilesAfterEnv` entry from Task 1 Step 5 is wrong. Fix it before continuing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/harness/smoke.test.tsx
git commit -m "test: add harness smoke test

Verifies jest-expo TSX transform, RNTL rendering, and extended matchers.

Verified: npm test -- --testPathPattern=harness => 3 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Repair `__tests__/Logger.test.ts`

**Files:**
- Modify: `__tests__/Logger.test.ts`

**Interfaces:**
- Consumes: `utils/Logger.ts`, whose real exports are `default Logger` (an object with `debug`, `info`, `warn`, `error`, `installGlobalErrorHandlers`) plus the same five as named exports.
- Produces: a passing regression test for the logger.

**Why:** the existing test calls `LoggerFactory.getLogger('Test')` and then `logger.info(...)`. `utils/Logger.ts` exports no `getLogger`, so the test throws `TypeError: LoggerFactory.getLogger is not a function`. It also mocks `expo-file-system`, which the logger never imports. The test is rewritten against the real API rather than deleted, because deleting a test to make a gate pass is forbidden (CLAUDE.md section 9).

- [ ] **Step 1: Run the existing test to see it fail**

Run:
```bash
npm test -- --testPathPattern=Logger
```
Expected: fails with `LoggerFactory.getLogger is not a function`.

- [ ] **Step 2: Replace the file**

Replace the entire contents of `__tests__/Logger.test.ts` with:

```ts
// __tests__/Logger.test.ts
// Regression tests for utils/Logger.
// Logger's real API: default export object { debug, info, warn, error,
// installGlobalErrorHandlers } and the same five as named exports.
// The first argument of each level function is a SCOPE, not the message.
import Logger, { info, warn, error, debug } from "../utils/Logger";

describe("Logger", () => {
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exposes the documented API on the default export", () => {
    expect(typeof Logger.debug).toBe("function");
    expect(typeof Logger.info).toBe("function");
    expect(typeof Logger.warn).toBe("function");
    expect(typeof Logger.error).toBe("function");
    expect(typeof Logger.installGlobalErrorHandlers).toBe("function");
  });

  it("exposes the same functions as named exports", () => {
    expect(typeof debug).toBe("function");
    expect(typeof info).toBe("function");
    expect(typeof warn).toBe("function");
    expect(typeof error).toBe("function");
  });

  it("writes an INFO line carrying the scope and message", () => {
    Logger.info("Player", "started");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = String(infoSpy.mock.calls[0][0]);
    expect(line).toContain("[INFO]");
    expect(line).toContain("[Player]");
    expect(line).toContain("started");
  });

  it("routes each level to its own console method", () => {
    Logger.debug("Scope", "d");
    Logger.warn("Scope", "w");
    Logger.error("Scope", "e");
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("serializes object arguments instead of printing [object Object]", () => {
    Logger.info("Scope", { videoId: "abc" });
    const line = String(infoSpy.mock.calls[0][0]);
    expect(line).toContain('"videoId":"abc"');
    expect(line).not.toContain("[object Object]");
  });

  it("accepts a null scope without throwing", () => {
    expect(() => Logger.info(null, "no scope")).not.toThrow();
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("does not throw on a circular object", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    expect(() => Logger.info("Scope", circular)).not.toThrow();
  });

  it("installGlobalErrorHandlers is idempotent and does not throw", () => {
    expect(() => Logger.installGlobalErrorHandlers()).not.toThrow();
    expect(() => Logger.installGlobalErrorHandlers()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the test**

Run:
```bash
npm test -- --testPathPattern=Logger
```
Expected: `Tests: 8 passed`.

If the circular-object test fails, that is a genuine defect in `utils/Logger.ts`'s `fmt` function. Fix `fmt` by wrapping `JSON.stringify` in the existing `try/catch` (it already has one) rather than weakening the test.

- [ ] **Step 4: Commit**

```bash
git add __tests__/Logger.test.ts
git commit -m "test: rewrite Logger test against the real Logger API

The previous test called LoggerFactory.getLogger(), which utils/Logger.ts
does not export, and mocked expo-file-system, which it does not import.
Rewritten to cover the actual default and named exports, level routing,
object serialization, null scope, and circular input.

Verified: npm test -- --testPathPattern=Logger => 8 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Get the two component test suites running

**Files:**
- Modify: `__tests__/Shorts.test.tsx` (only if it fails)
- Modify: `__tests__/Comments.test.tsx` (only if it fails)

**Interfaces:**
- Consumes: `components/ui/ShortsIcon`, `components/Comments/*`, `utils/Logger`.
- Produces: a green `npm test` across the whole repo, which is the exit gate for this increment.

**Why:** both files import `@testing-library/react-native`, which did not exist until Task 1. They may now pass unchanged. They may also fail for real reasons, including the missing `ActivityIndicator` import at `components/Comments/CommentsModal.tsx:648`.

- [ ] **Step 1: Run both suites and capture the real failures**

Run:
```bash
npm test -- --testPathPattern="Shorts|Comments"
```
Record the exact output. Three outcomes are possible, and they need different handling:
1. **Both pass.** Skip to Step 4.
2. **A test fails because the test itself is wrong** (queries an element that was renamed, asserts behavior the component never had). Fix the test.
3. **A test fails because the component is broken.** Fix the component, not the test. The known instance is `ActivityIndicator` being used without an import.

- [ ] **Step 2: If a suite fails on `ActivityIndicator is not defined`, fix the component**

In `components/Comments/CommentsModal.tsx`, find the `react-native` import block and add `ActivityIndicator` to it, keeping the existing members and alphabetical position. For example, if the block reads:

```tsx
import { View, Text, Modal, FlatList, Pressable, StyleSheet } from "react-native";
```

change it to:

```tsx
import { ActivityIndicator, View, Text, Modal, FlatList, Pressable, StyleSheet } from "react-native";
```

Verify with:
```bash
npx eslint components/Comments/CommentsModal.tsx
```
Expected: the `react/jsx-no-undef` error for `ActivityIndicator` is gone.

- [ ] **Step 3: Re-run until both suites pass**

Run:
```bash
npm test -- --testPathPattern="Shorts|Comments"
```
Expected: all tests pass.

If a test asserts behavior that the component genuinely does not have and never did, **do not delete it**. Mark it with `it.skip(...)`, add a one-line comment naming what is unimplemented, and list it in the increment report. Deleting it hides a gap.

- [ ] **Step 4: Run the whole suite**

Run:
```bash
npm test
```
Expected: every suite passes. Record the totals.

- [ ] **Step 5: Confirm no new type or lint errors**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx eslint . --ext .js,.jsx,.ts,.tsx 2>&1 | tail -3
```
Expected: the TypeScript error count is **66 or lower** (down from 68; the two `@testing-library/react-native` resolution errors are now gone). Lint errors should be **6 or lower** (down from 8, for the same reason, plus one more if you fixed `ActivityIndicator`).

These counts fall further in Increment 0B. They must never rise.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: restore Shorts and Comments suites

Both imported @testing-library/react-native, which was not installed
until this increment. Fixed the missing ActivityIndicator import in
CommentsModal that the suite surfaced.

Verified: npm test => all suites pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

This increment is done when all of these hold:

- [ ] `npm test` runs and every suite passes.
- [ ] `npx jest --version` prints `29.7.0`.
- [ ] `npx tsc --noEmit` reports no more than 66 errors (was 68).
- [ ] `npx eslint . --ext .js,.jsx,.ts,.tsx` reports no more than 6 errors (was 8).
- [ ] `package.json` adds exactly four devDependencies and changes exactly one dependency version, which is a pin rather than an upgrade.
- [ ] Any test left skipped is named in the report with the reason.

## Out of Scope — Report, Do Not Act

`npx expo install --check` reports **18 packages behind their Expo SDK 54 expected versions**, including `expo-router` (6.0.14 installed, ~6.0.24 expected) and `expo-video` (3.0.14 installed, ~3.0.16 expected). Upgrading them is a multi-package change with real regression risk to a player the team has already flagged as fragile.

**Do not run `expo install --fix` in this increment.** Report the list to the human and let them decide. If they approve, it becomes its own increment with its own device-verification pass.
