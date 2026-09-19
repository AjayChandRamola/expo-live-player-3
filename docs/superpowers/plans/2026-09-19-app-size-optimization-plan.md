# App Size Optimisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline in the current session (this project forbids subagent-driven development, see `CLAUDE.md` §0). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the production footprint of expo-live-player (bundled fonts, unused native and JS packages, SVG runtime, production logging, Android shrinking) without removing or degrading any feature, with every change measured and independently revertible.

**Architecture:** The runtime architecture does not change. The Metro module graph loses 17 unused icon fonts, the `react-native-svg` runtime, and production `console.log/info/debug` calls; autolinking loses five unused native modules; the Android release pipeline gains R8 and resource shrinking through `expo-build-properties`; a committed measurement script and lint/test guards keep the result. Protected player and Shorts code receive one-line import changes only.

**Tech Stack:** Expo SDK 57.0.23, React Native 0.86.3, React 19.2.3, expo-router 57.0.21, Hermes, Jest 29 with `jest-expo` 57.0.5, ESLint 9 flat config, TypeScript 6.0.3 (installed), npm 11.19.1, Node 26.8.2, Windows 11 with Git Bash.

**Spec:** `docs/superpowers/specs/2026-09-19-app-size-optimization-design.md`. Change catalogue with rationale: `docs/size-optimization/architecture/LLD.md`. Baseline numbers: `docs/size-optimization/optimization/size-baseline.md`.

## Global Constraints

- Work on the current branch `main`, in place. Do not create branches or worktrees. Do not `git reset --hard`, force-push, or rewrite history.
- One logical change per commit. Every commit message ends with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never modify `components/VideoPlayer/engine/**`, `components/VideoPlayer/platform/**`, `components/VideoPlayer/Player.tsx`, `components/VideoPlayer/types.ts`, `components/VideoPlayer/constants.ts`, `components/VideoPlayer/tokens.ts`, `components/VideoPlayer/ui/PlayerSurface.tsx`, `contexts/PlayQueueContext.tsx`, `services/**`, `constants/config.ts`.
- Never uninstall: expo, expo-router, expo-video, expo-image, react-native-reanimated, react-native-worklets, react-native-gesture-handler, react-native-webview, react-native-screens, react-native-safe-area-context, @react-native-async-storage/async-storage, expo-brightness, expo-haptics, expo-screen-orientation, expo-file-system, expo-symbols, expo-splash-screen, expo-system-ui, expo-status-bar, expo-constants, expo-linking, expo-font, expo-asset, react-dom, react-native-web.
- Do not add `expo.autolinking.exclude` to `package.json`.
- Tasks marked **[needs D-n]** must not start until the human has answered decision D-n (list in the spec §2.2). If the answer is "no", skip the task and record "skipped by D-n" in `docs/size-optimization/optimization/optimization-decision-log.md`.
- Use `npx expo install <pkg>` for any Expo-managed package, `npm install -D` for pure dev tools.
- All commands below run from the repository root `D:\expo-live-player` in Git Bash unless stated otherwise.

## The GATE procedure (run exactly this after every task that touches source, config, or dependencies)

```bash
npm run typecheck 2>&1 | grep -E "^(app|components|constants|contexts|hooks|services|types|utils)/" | grep -c "error TS"
```
Expected: a number ≤ the "runtime tsc errors" value recorded in the previous task's commit message (baseline 29). If higher: stop, fix, or roll back the task.

```bash
npm run lint 2>&1 | grep -E "✖ [0-9]+ problems"
```
Expected: `✖ N problems (E errors, W warnings)` with E ≤ the previous task's value (baseline 78). If higher: stop, fix, or roll back.

```bash
npm test 2>&1 | grep -E "^Test Suites:|^Tests:"
```
Expected after Task 1: `Test Suites: 95 passed, 95 total` (or a higher count once new suites exist) and `Tests: N passed, N total`. Any `failed`: stop.

```bash
npm run size:export && npm run size:report
```
Expected: two JSON reports printed (android, ios). Compare `bundleBytes`, `assetBytes`, `assetCount`, `ttfCount` with the previous task; they must be equal or smaller unless the task says otherwise.

Record the four gate numbers (tsc runtime errors, lint errors, suites, android assetBytes) in the commit body of every task, as: `gates: tsc=NN lint=NN suites=NN/NN androidAssets=NNNNNNN`.

---

## Phase 0 — Baseline and safety net

### Task 1: Restore the 15 failing Jest suites (C-01)

**Files:**
- Modify: `__tests__/harness/setup.ts:39` (insert before the existing `jest.mock("react-native-reanimated", ...)`)
- Create: `__tests__/harness/reanimatedMock.test.ts`

**Interfaces:**
- Consumes: `react-native-worklets/lib/module/mock.js` (exists; verified) — the JS-only worklets runtime.
- Produces: a Jest environment in which `react-native-reanimated/mock` loads. All later tasks rely on `npm test` reporting `95 passed, 95 total`.

- [ ] **Step 1: Reproduce the failure**

Run: `npx jest __tests__/player/ui/SkipButton.test.tsx 2>&1 | grep -E "loadUnpackers|Tests:|Test Suites:"`
Expected: a line containing `Cannot read properties of undefined (reading 'loadUnpackers')` and `Test Suites: 1 failed, 1 total`.

- [ ] **Step 2: Write the failing guard test**

Create `__tests__/harness/reanimatedMock.test.ts`:

```ts
// __tests__/harness/reanimatedMock.test.ts
// Guards the Jest harness: Reanimated 4 must load under Jest (through the
// react-native-worklets mock) and the harness's useSharedValue wrapper must
// keep identity across re-renders.
import React from "react";
import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

describe("reanimated jest harness", () => {
  it("loads react-native-reanimated without touching the native worklets proxy", () => {
    const { result } = renderHook(() => useSharedValue(1));
    expect(result.current.value).toBe(1);
  });

  it("keeps the same shared value object across re-renders", () => {
    const { result, rerender } = renderHook(() => useSharedValue(7));
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
    expect(React.isValidElement(first)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest __tests__/harness/reanimatedMock.test.ts 2>&1 | grep -E "loadUnpackers|Test Suites:"`
Expected: `loadUnpackers` error and `Test Suites: 1 failed, 1 total`.

- [ ] **Step 4: Add the worklets mock to the harness**

Open `__tests__/harness/setup.ts`. Directly above the line `jest.mock("react-native-reanimated", () => {` (line 39), insert:

```ts
// Reanimated 4 delegates its worklet runtime to react-native-worklets, which
// under Jest has no native proxy ("loadUnpackers" is undefined). The package
// ships a JS-only mock; install it before Reanimated's own mock loads.
jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/lib/module/mock"),
);
```

- [ ] **Step 5: Run the guard test and the single previously failing suite**

Run: `npx jest __tests__/harness/reanimatedMock.test.ts __tests__/player/ui/SkipButton.test.tsx 2>&1 | grep -E "Test Suites:|Tests:"`
Expected: `Test Suites: 2 passed, 2 total`.

If instead the error is `Cannot use import statement outside a module` for `react-native-worklets/lib/module/mock.js`, replace the path in Step 4 with `"react-native-worklets/src/mock"` (TypeScript source, transformed by babel-jest) and re-run. If both fail, stop and apply `superpowers:systematic-debugging`; do not edit any test assertion.

- [ ] **Step 6: Run the full suite**

Run: `npm test 2>&1 | grep -E "^Test Suites:|^Tests:"`
Expected: `Test Suites: 96 passed, 96 total` (95 + the new guard suite) and `Tests: 654 passed, 654 total` (652 + 2). Counts may be higher if previously-failing suites contained additional tests; the only acceptable outcome is zero `failed`.

- [ ] **Step 7: Run the web Jest project**

Run: `npm run test:web 2>&1 | grep -E "^Test Suites:|^Tests:"`
Expected: no `failed`. If it fails with the same `loadUnpackers` message, add the identical `jest.mock("react-native-worklets", ...)` block to `__tests__/harness/setup.web.ts` (replace its `export {};` line with the block followed by `export {};`) and re-run.

- [ ] **Step 8: Commit**

```bash
git add __tests__/harness/setup.ts __tests__/harness/reanimatedMock.test.ts __tests__/harness/setup.web.ts
git commit -m "test(harness): install react-native-worklets mock so Reanimated 4 suites run

Restores 15 suites that failed with 'loadUnpackers' after the SDK 57 upgrade.
gates: tsc=29 lint=78 suites=96/96 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: Measurement script, budget file, npm scripts, ignore rules (C-02)

**Files:**
- Create: `scripts/measure-app-size.js`
- Create: `docs/size-optimization/size-budget.json`
- Create: `__tests__/scripts/measureAppSize.test.ts`
- Create: `__tests__/fixtures/export-sample/metadata.json`, `__tests__/fixtures/export-sample/_expo/static/js/android/entry-abc.hbc`, `__tests__/fixtures/export-sample/assets/f1`, `__tests__/fixtures/export-sample/assets/p1`
- Modify: `package.json` (scripts block, lines 4–17)
- Modify: `.gitignore` (append)

**Interfaces:**
- Produces: `node scripts/measure-app-size.js <exportDir> [--json] [--assert <budget.json>] [--no-autolinking]` printing a JSON object `{ platform, bundleFile, bundleBytes, assetCount, assetBytes, ttfCount, ttf: [{bytes, path}], mappedBytes?, unmappedBytes?, firstPartyBytes?, topPackages?, autolinking? }` and exit code 0, or exit code 1 with a message when `--assert` finds an excess. Later tasks call `npm run size:export`, `npm run size:report`, `npm run size:check`, `npm run typecheck`.

- [ ] **Step 1: Create the fixture export directory**

```bash
mkdir -p __tests__/fixtures/export-sample/_expo/static/js/android __tests__/fixtures/export-sample/assets
printf 'HBCBYTES01' > __tests__/fixtures/export-sample/_expo/static/js/android/entry-abc.hbc
printf 'FONTFONT' > __tests__/fixtures/export-sample/assets/f1
printf 'PNG' > __tests__/fixtures/export-sample/assets/p1
```

Create `__tests__/fixtures/export-sample/metadata.json`:

```json
{
  "version": 0,
  "bundler": "metro",
  "fileMetadata": {
    "android": {
      "bundle": "_expo/static/js/android/entry-abc.hbc",
      "assets": [
        { "path": "assets/f1", "ext": "ttf" },
        { "path": "assets/p1", "ext": "png" }
      ]
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/scripts/measureAppSize.test.ts`:

```ts
// __tests__/scripts/measureAppSize.test.ts
// The size report is the initiative's measurement instrument; it must be
// deterministic on a fixture before it is trusted on real exports.
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "measure-app-size.js");
const FIXTURE = path.join(ROOT, "__tests__", "fixtures", "export-sample");

function run(args: string[]): { code: number; stdout: string } {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, stdout: String(err.stdout) + String(err.stderr) };
  }
}

describe("scripts/measure-app-size.js", () => {
  it("reports bundle bytes, asset count/bytes and ttf list for a fixture export", () => {
    const { code, stdout } = run([FIXTURE, "--json", "--no-autolinking"]);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.platform).toBe("android");
    expect(report.bundleBytes).toBe(10);
    expect(report.assetCount).toBe(2);
    expect(report.assetBytes).toBe(11);
    expect(report.ttfCount).toBe(1);
    expect(report.ttf[0].bytes).toBe(8);
  });

  it("passes --assert when the budget is met and fails when it is exceeded", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budget-"));
    const ok = path.join(dir, "ok.json");
    const bad = path.join(dir, "bad.json");
    fs.writeFileSync(
      ok,
      JSON.stringify({ android: { bundleBytes: 10, assetBytes: 11, assetCount: 2, ttfCount: 1 } }),
    );
    fs.writeFileSync(
      bad,
      JSON.stringify({ android: { bundleBytes: 9, assetBytes: 11, assetCount: 2, ttfCount: 1 } }),
    );
    expect(run([FIXTURE, "--json", "--no-autolinking", "--assert", ok]).code).toBe(0);
    const failed = run([FIXTURE, "--json", "--no-autolinking", "--assert", bad]);
    expect(failed.code).toBe(1);
    expect(failed.stdout).toContain("bundleBytes");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest __tests__/scripts/measureAppSize.test.ts 2>&1 | grep -E "Cannot find module|ENOENT|Test Suites:"`
Expected: `Test Suites: 1 failed, 1 total` (script does not exist).

- [ ] **Step 4: Write the script**

Create `scripts/measure-app-size.js`:

```js
#!/usr/bin/env node
// scripts/measure-app-size.js
// Reports the size of an `expo export` output directory:
//   node scripts/measure-app-size.js <exportDir> [--json] [--assert <budget.json>] [--no-autolinking]
// Prints bundle bytes, asset count/bytes, bundled TTFs, and (when a .js.map
// exists) byte attribution by package. With --assert, exits 1 when any value
// exceeds the budget for the platform. See docs/size-optimization/.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function parseArgs(argv) {
  const args = { dir: null, json: false, assert: null, autolinking: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--no-autolinking") args.autolinking = false;
    else if (a === "--assert") args.assert = argv[++i];
    else if (!args.dir) args.dir = a;
  }
  if (!args.dir) {
    console.error("usage: node scripts/measure-app-size.js <exportDir> [--json] [--assert <budget.json>] [--no-autolinking]");
    process.exit(2);
  }
  return args;
}

function readMetadata(dir) {
  const file = path.join(dir, "metadata.json");
  if (!fs.existsSync(file)) throw new Error(`metadata.json not found in ${dir}`);
  const meta = JSON.parse(fs.readFileSync(file, "utf8"));
  const platforms = Object.keys(meta.fileMetadata || {});
  if (platforms.length !== 1) throw new Error(`expected one platform in metadata.json, found ${platforms.length}`);
  const platform = platforms[0];
  return { platform, entry: meta.fileMetadata[platform] };
}

function findBundle(dir, platform, entry) {
  const jsDir = path.join(dir, "_expo", "static", "js", platform);
  if (entry && entry.bundle && fs.existsSync(path.join(dir, entry.bundle))) {
    return path.join(dir, entry.bundle);
  }
  const candidates = fs.readdirSync(jsDir).filter((f) => f.endsWith(".hbc") || f.endsWith(".js"));
  if (candidates.length === 0) throw new Error(`no .hbc or .js bundle in ${jsDir}`);
  candidates.sort((a, b) => fs.statSync(path.join(jsDir, b)).size - fs.statSync(path.join(jsDir, a)).size);
  return path.join(jsDir, candidates[0]);
}

const VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVLQ(str) {
  const out = [];
  let shift = 0;
  let value = 0;
  for (const c of str) {
    const digit = VLQ_CHARS.indexOf(c);
    if (digit === -1) throw new Error("bad VLQ char " + c);
    const cont = digit & 32;
    value += (digit & 31) << shift;
    if (cont) {
      shift += 5;
      continue;
    }
    const negative = value & 1;
    value >>= 1;
    out.push(negative ? -value : value);
    value = 0;
    shift = 0;
  }
  return out;
}

function attribute(bundleFile) {
  const mapFile = bundleFile + ".map";
  if (!fs.existsSync(mapFile)) return null;
  const code = fs.readFileSync(bundleFile, "utf8");
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === "\n") lineStarts.push(i + 1);
  const lineLen = (l) => (l + 1 < lineStarts.length ? lineStarts[l + 1] - 1 : code.length) - lineStarts[l];
  const absPos = (l, c) => lineStarts[l] + Math.min(c, lineLen(l));
  const segs = [];
  let srcIdx = 0;
  map.mappings.split(";").forEach((lineStr, line) => {
    let col = 0;
    if (!lineStr) return;
    for (const segStr of lineStr.split(",")) {
      if (!segStr) continue;
      const f = decodeVLQ(segStr);
      col += f[0];
      if (f.length >= 4) srcIdx += f[1];
      segs.push({ line, col, src: f.length >= 4 ? srcIdx : null });
    }
  });
  segs.sort((a, b) => a.line - b.line || a.col - b.col);
  const bySource = new Map();
  let unmapped = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const n = segs[i + 1];
    const start = absPos(s.line, s.col);
    const end = n ? absPos(n.line, n.col) : code.length;
    const size = Math.max(0, end - start);
    if (s.src === null) {
      unmapped += size;
      continue;
    }
    const name = map.sources[s.src] || "<unknown>";
    bySource.set(name, (bySource.get(name) || 0) + size);
  }
  const packages = new Map();
  let firstParty = 0;
  for (const [k, v] of bySource) {
    const m = k.match(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/);
    if (m) packages.set(m[1], (packages.get(m[1]) || 0) + v);
    else firstParty += v;
  }
  const mappedBytes = [...bySource.values()].reduce((a, b) => a + b, 0);
  const topPackages = [...packages].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([name, bytes]) => ({ name, bytes }));
  return { mappedBytes, unmappedBytes: unmapped, firstPartyBytes: firstParty, topPackages };
}

function autolinkingCounts() {
  const count = (platform) => {
    const out = execFileSync("npx", ["expo-modules-autolinking", "resolve", "-p", platform, "--json"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    return (JSON.parse(out).modules || []).length;
  };
  return { android: count("android"), ios: count("ios") };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.dir);
  const { platform, entry } = readMetadata(dir);
  const bundleFile = findBundle(dir, platform, entry);
  const bundleBytes = fs.statSync(bundleFile).size;
  const assets = (entry && entry.assets) || [];
  let assetBytes = 0;
  const ttf = [];
  for (const a of assets) {
    const p = path.join(dir, a.path);
    const bytes = fs.existsSync(p) ? fs.statSync(p).size : 0;
    assetBytes += bytes;
    if (a.ext === "ttf") ttf.push({ bytes, path: a.path });
  }
  ttf.sort((a, b) => b.bytes - a.bytes);
  const report = {
    platform,
    bundleFile: path.relative(dir, bundleFile),
    bundleBytes,
    assetCount: assets.length,
    assetBytes,
    ttfCount: ttf.length,
    ttf,
  };
  const attributed = attribute(bundleFile);
  if (attributed) Object.assign(report, attributed);
  if (args.autolinking) {
    try {
      report.autolinking = autolinkingCounts();
    } catch (e) {
      report.autolinking = { error: String(e && e.message) };
    }
  }

  let failed = false;
  if (args.assert) {
    const budget = JSON.parse(fs.readFileSync(path.resolve(args.assert), "utf8"))[platform] || {};
    for (const key of ["bundleBytes", "assetBytes", "assetCount", "ttfCount"]) {
      if (typeof budget[key] === "number" && report[key] > budget[key]) {
        failed = true;
        console.error(`BUDGET EXCEEDED ${platform}.${key}: measured ${report[key]} > budget ${budget[key]}`);
      }
    }
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`platform      ${report.platform}`);
    console.log(`bundle        ${report.bundleFile} ${report.bundleBytes} B`);
    console.log(`assets        ${report.assetCount} files, ${report.assetBytes} B`);
    console.log(`ttf           ${report.ttfCount}`);
    for (const t of report.ttf) console.log(`  ${String(t.bytes).padStart(9)} ${t.path}`);
    if (report.topPackages) {
      console.log(`mapped ${report.mappedBytes} unmapped ${report.unmappedBytes} first-party ${report.firstPartyBytes}`);
      for (const p of report.topPackages) console.log(`  ${String(p.bytes).padStart(9)} ${p.name}`);
    }
    if (report.autolinking) console.log(`autolinking   ${JSON.stringify(report.autolinking)}`);
  }
  process.exit(failed ? 1 : 0);
}

main();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/scripts/measureAppSize.test.ts 2>&1 | grep -E "Tests:|Test Suites:"`
Expected: `Test Suites: 1 passed, 1 total`, `Tests: 2 passed, 2 total`.

- [ ] **Step 6: Add npm scripts**

In `package.json`, inside `"scripts"`, after the line `"prebuild": "expo prebuild --clean",` add these four lines:

```json
    "typecheck": "tsc --noEmit",
    "size:export": "expo export --platform android --output-dir .baseline-export/android && expo export --platform ios --output-dir .baseline-export/ios",
    "size:report": "node scripts/measure-app-size.js .baseline-export/android && node scripts/measure-app-size.js .baseline-export/ios",
    "size:check": "node scripts/measure-app-size.js .baseline-export/android --assert docs/size-optimization/size-budget.json && node scripts/measure-app-size.js .baseline-export/ios --assert docs/size-optimization/size-budget.json",
```

- [ ] **Step 7: Create the budget file at baseline values**

Create `docs/size-optimization/size-budget.json`:

```json
{
  "android": { "bundleBytes": 4941796, "assetBytes": 5071209, "assetCount": 47, "ttfCount": 20 },
  "ios": { "bundleBytes": 4750938, "assetBytes": 4105051, "assetCount": 43, "ttfCount": 19 }
}
```

- [ ] **Step 8: Extend .gitignore**

Append to `.gitignore`:

```
# Size measurement outputs (docs/size-optimization)
.baseline-export/
.size-reports/
*.apks
*.aab
*.apk
*.ipa
```

- [ ] **Step 9: Produce the real exports and check the numbers**

Run: `npm run size:export 2>&1 | tail -3` — Expected: last line `Exported: .baseline-export/ios` (the Android export finishes first).
Run: `npm run size:report` — Expected Android: `bundle ... 4941796 B`, `assets 47 files, 5071209 B`, `ttf 20`, the first ttf line `1307660`. Expected iOS: `4750938 B`, `43 files, 4105051 B`, `ttf 19`. Small differences (under 1 %) in `bundleBytes` are acceptable if the export hash differs; asset numbers must match exactly.
Run: `npm run size:check` — Expected: exit 0 (no `BUDGET EXCEEDED` line). Check with `echo $?` → `0`.

- [ ] **Step 10: Verify ignore rules and commit**

Run: `git status --short | grep baseline-export` — Expected: no output.

```bash
git add scripts/measure-app-size.js docs/size-optimization/size-budget.json __tests__/scripts/measureAppSize.test.ts __tests__/fixtures/export-sample package.json .gitignore
git commit -m "chore(size): add measure-app-size script, budget file and size scripts

gates: tsc=29 lint=78 suites=97/97 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: Application identifiers and EAS profiles (C-03) **[needs D-1, D-2]**

**Files:**
- Modify: `app.json` (`expo.android` and `expo.ios` objects)
- Create: `eas.json`

**Interfaces:**
- Produces: `expo.android.package` and `expo.ios.bundleIdentifier` (values from D-1), used by every native build in Tasks 4, 19.

- [ ] **Step 1: Add identifiers to app.json**

In `app.json`, change the `"ios"` object to (replace `<IOS_BUNDLE_ID>` with the D-1 value, for example `com.example.yagna`):

```json
    "ios": {
      "bundleIdentifier": "<IOS_BUNDLE_ID>",
      "supportsTablet": true,
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    },
```

and add `"package"` as the first key of the `"android"` object (replace `<ANDROID_PACKAGE>` with the D-1 value):

```json
    "android": {
      "package": "<ANDROID_PACKAGE>",
      "adaptiveIcon": {
```

- [ ] **Step 2: Create eas.json**

The installed CLI is `eas-cli/16.24.1` (verified). Create `eas.json`:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store",
      "android": { "buildType": "app-bundle" },
      "autoIncrement": false
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx expo config --type introspect 2>/dev/null | grep -E "\"package\"|\"bundleIdentifier\""`
Expected: both keys printed with the D-1 values.
Run: `npx expo-doctor 2>&1 | tail -3` — Expected: `Didn't find any issues with the project!` (if it reports an unrelated pre-existing issue, record it in the commit body and continue).

- [ ] **Step 4: Commit**

```bash
git add app.json eas.json
git commit -m "chore(build): set android.package and ios.bundleIdentifier; add EAS profiles

gates: tsc=29 lint=78 suites=97/97 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: Android native baseline build and report (C-03b) **[needs D-1, D-2; measurement only, no commit of build output]**

**Files:**
- Create (git-ignored): `.size-reports/baseline-android.md`
- Modify: `docs/size-optimization/optimization/size-baseline.md` §6 (fill "Baseline" column), `docs/size-optimization/size-budget.json` (add keys)

- [ ] **Step 1: Set up the toolchain for this shell**

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
java -version 2>&1 | head -1
```
Expected: `java version "17.0.12"`.

Download bundletool once: from `https://github.com/google/bundletool/releases` save `bundletool-all-<version>.jar` as `.size-reports/bundletool.jar` (create the directory first: `mkdir -p .size-reports`).

- [ ] **Step 2: Prebuild and build the release AAB**

```bash
npx expo prebuild -p android --clean --no-install
cd android && ./gradlew :app:bundleRelease --no-daemon 2>&1 | tail -5 && cd ..
```
Expected: `BUILD SUCCESSFUL` and the file `android/app/build/outputs/bundle/release/app-release.aab`. If Gradle fails on Windows path or SDK licence issues, run `"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses` (accept all) and retry once; if it still fails, use the D-2 alternative `eas build -p android --profile production --local --output .size-reports/app-release.aab` and continue from Step 3 with that path.

- [ ] **Step 3: Measure**

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab
ls -l "$AAB" | awk '{print "AAB bytes:", $5}'
java -jar .size-reports/bundletool.jar build-apks --bundle="$AAB" --output=.size-reports/app.apks --mode=default --overwrite
java -jar .size-reports/bundletool.jar get-size total --apks=.size-reports/app.apks --dimensions=ABI
java -jar .size-reports/bundletool.jar build-apks --bundle="$AAB" --output=.size-reports/universal.apks --mode=universal --overwrite
unzip -o -q .size-reports/universal.apks universal.apk -d .size-reports/
ls -l .size-reports/universal.apk | awk '{print "Universal APK bytes:", $5}'
unzip -l .size-reports/universal.apk | awk '$4 ~ /^lib\//{split($4,a,"/"); s[a[2]]+=$1} $4 ~ /^classes.*\.dex$/{d+=$1} $4 ~ /^assets\//{as+=$1} $4 ~ /^res\//{r+=$1} END{for(k in s)print "lib/"k, s[k]; print "dex", d; print "assets", as; print "res", r}'
"$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)/aapt2" dump badging .size-reports/universal.apk | grep -E "uses-permission|package:" 
```
Expected: numbers printed for each line. Record all of them.

- [ ] **Step 4: Record**

Write `.size-reports/baseline-android.md` with every number from Step 3 and the exact commands. Then edit `docs/size-optimization/optimization/size-baseline.md` §6: replace `NOT MEASURED` in the rows "Android release AAB size", "Play-delivered download size per ABI", "Universal APK size", "Native library bytes per ABI" with the measured values (keep the method column). Add to `docs/size-optimization/size-budget.json` under `"android"`: `"aabBytes": <AAB bytes>, "arm64DownloadMaxBytes": <MAX for arm64-v8a from get-size>`.

- [ ] **Step 5: Commit the documentation only**

Run: `git status --short` — Expected: only the two docs files modified; `android/` and `.size-reports/` must not appear (they are ignored). If `android/` appears, stop: `.gitignore` has `/android` — check you are at the repository root.

```bash
git add docs/size-optimization/optimization/size-baseline.md docs/size-optimization/size-budget.json
git commit -m "docs(size): record Android release baseline (AAB, per-ABI, universal, libs, permissions)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 1 — Dependency cleanup

### Task 5: Dependency guard test and removal of four unused native packages (C-04)

**Files:**
- Create: `__tests__/scripts/dependencyGuards.test.ts`
- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**
- Produces: `FORBIDDEN_DEPENDENCIES` list in the test; Task 6 extends it.

- [ ] **Step 1: Confirm zero import sites (must print nothing)**

```bash
grep -rE "expo-audio|expo-linear-gradient|expo-web-browser|@react-native-community/slider" app components constants contexts hooks services types utils __tests__ __mocks__ scripts --include=*.ts --include=*.tsx --include=*.js
```
Expected: no output. If anything prints, stop and report; do not uninstall.

- [ ] **Step 2: Write the failing guard test**

Create `__tests__/scripts/dependencyGuards.test.ts`:

```ts
// __tests__/scripts/dependencyGuards.test.ts
// Packages removed by the 2026-09 size initiative must not be re-added
// silently. See docs/size-optimization/optimization/dependency-audit.md.
import fs from "fs";
import path from "path";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

const FORBIDDEN_DEPENDENCIES = [
  "expo-audio",
  "expo-linear-gradient",
  "expo-web-browser",
  "@react-native-community/slider",
];

describe("dependency guards", () => {
  it.each(FORBIDDEN_DEPENDENCIES)("%s is not a dependency", (name) => {
    expect(pkg.dependencies[name]).toBeUndefined();
    expect(pkg.devDependencies[name]).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest __tests__/scripts/dependencyGuards.test.ts 2>&1 | grep -E "Tests:"`
Expected: `Tests: 4 failed, 4 total`.

- [ ] **Step 4: Uninstall**

Run: `npm uninstall expo-audio expo-linear-gradient expo-web-browser @react-native-community/slider 2>&1 | tail -2`
Expected: `removed N packages` and `found 0 vulnerabilities` (or the same vulnerability count as before).

- [ ] **Step 5: Verify autolinking**

```bash
npx expo-modules-autolinking resolve -p android --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).modules.map(x=>x.packageName);console.log(m.length, m.filter(n=>/audio|linear|web-browser/.test(n)).length)})'
npx expo-modules-autolinking resolve -p ios --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.parse(s).modules.length)})'
npx expo-modules-autolinking react-native-config -p android --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=Object.keys(JSON.parse(s).dependencies);console.log(d.length, d.includes("@react-native-community/slider"))})'
```
Expected: `20 0`, `22`, `10 false`.

- [ ] **Step 6: Guard test passes; run GATE**

Run: `npx jest __tests__/scripts/dependencyGuards.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 4 passed, 4 total`.
Run the GATE procedure. Expected: tsc=29, lint errors=78, suites all passed (98 total), Android `assetBytes` 5071209 and `bundleBytes` equal to Task 2 (these packages were not in the graph, so bytes are unchanged). Run `npx expo-doctor 2>&1 | tail -2` — Expected: no new issue.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json __tests__/scripts/dependencyGuards.test.ts
git commit -m "chore(deps): remove unused native packages expo-audio, expo-linear-gradient, expo-web-browser, slider

Zero import sites; autolinking now 20 expo modules (android), 22 (ios), 10 RN modules.
gates: tsc=29 lint=78 suites=98/98 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: Remove seven unused JavaScript-only packages (C-05)

**Files:**
- Modify: `__tests__/scripts/dependencyGuards.test.ts` (extend list), `package.json`, `package-lock.json`

- [ ] **Step 1: Confirm zero import sites (must print nothing)**

```bash
grep -rE "react-native-paper|react-native-calendars|react-native-collapsible|from ['\"]ajv|@expo-google-fonts|useFonts|Mukta_|NotoSansDevanagari_|Roboto_" app components constants contexts hooks services types utils __tests__ __mocks__ scripts --include=*.ts --include=*.tsx --include=*.js
```
Expected: no output.

- [ ] **Step 2: Extend the guard test**

In `__tests__/scripts/dependencyGuards.test.ts`, replace the `FORBIDDEN_DEPENDENCIES` array with:

```ts
const FORBIDDEN_DEPENDENCIES = [
  "expo-audio",
  "expo-linear-gradient",
  "expo-web-browser",
  "@react-native-community/slider",
  "react-native-paper",
  "react-native-calendars",
  "react-native-collapsible",
  "ajv",
  "@expo-google-fonts/mukta",
  "@expo-google-fonts/noto-sans-devanagari",
  "@expo-google-fonts/roboto",
];
```

Run: `npx jest __tests__/scripts/dependencyGuards.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 7 failed, 4 passed, 11 total`.

- [ ] **Step 3: Uninstall**

Run: `npm uninstall react-native-paper react-native-calendars react-native-collapsible ajv @expo-google-fonts/mukta @expo-google-fonts/noto-sans-devanagari @expo-google-fonts/roboto 2>&1 | tail -2`
Expected: `removed N packages`.

- [ ] **Step 4: Guard passes; GATE; prove the export is unchanged**

Run: `npx jest __tests__/scripts/dependencyGuards.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 11 passed, 11 total`.
Run the GATE procedure. Expected: identical `bundleBytes`, `assetBytes`, `assetCount` to Task 5 for both platforms — this proves the packages were never in the graph. If `bundleBytes` differs by more than 0, stop and investigate with the source-map export (`npx expo export --platform android --no-bytecode --source-maps --output-dir .baseline-export/android-js` then `node scripts/measure-app-size.js .baseline-export/android-js --no-autolinking`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json __tests__/scripts/dependencyGuards.test.ts
git commit -m "chore(deps): remove unused JS packages (paper, calendars, collapsible, ajv, google fonts)

Export byte-identical before and after: none was in the module graph.
gates: tsc=29 lint=78 suites=98/98 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: Development tooling out of `dependencies`; single TypeScript (C-06) **[needs D-9, D-10]**

**Files:**
- Modify: `package.json` (`dependencies` and `devDependencies`), `package-lock.json`

- [ ] **Step 1: Check whether Prettier is used**

Run: `grep -rn "prettier" .vscode/settings.json eslint.config.js package.json` — Expected today: only the `package.json` dependency lines (the `.vscode/settings.json` has no Prettier setting; `eslint.config.js` does not reference it). Apply D-10: keep `prettier` as a devDependency if the human said yes; otherwise remove it.

- [ ] **Step 2: Edit package.json by hand**

Delete these lines from `"dependencies"`: `"@babel/core": "~7.21.0",`, `"@types/react": "~19.1.10",`, `"@types/react-dom": "~19.1.7",`, `"eslint-config-prettier": "^10.1.8",`, `"eslint-plugin-react": "^7.37.5",`, `"eslint-plugin-react-hooks": "^7.0.0",`, `"prettier": "^3.6.2",`, `"typescript": "~5.9.2"` (and fix the trailing comma on the new last entry).

In `"devDependencies"`: delete `"npm-force-resolutions": "^0.0.10",`. If D-10 keeps Prettier, add `"prettier": "^3.6.2",` in alphabetical position. Set `"typescript"` to the D-9 value (`"~6.0.3"` recommended; leave as is if D-9 chose 6.0.3). Keep `"@babel/core": "^7.21.0"`, `"@types/react": "~19.2.4"`, `"@types/react-dom": "~19.2.3"` as they are.

- [ ] **Step 3: Reinstall and verify single versions**

Run: `npm install 2>&1 | tail -2` then `npm ls typescript @types/react @babel/core 2>&1 | grep -E "typescript@|@types/react@|@babel/core@" | sort -u`
Expected: exactly one version line for each of the three names (for example `typescript@6.0.3`).

- [ ] **Step 4: GATE**

Run the GATE procedure. Expected: lint output identical to Task 6 (`78 errors`), tsc runtime count 29 (if D-9 chose 5.9, re-count and record the new number as the baseline for later tasks; note it in the commit body), suites 98/98, export unchanged.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): move dev tooling to devDependencies; single TypeScript; drop npm-force-resolutions

gates: tsc=29 lint=78 suites=98/98 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: Delete dead modules and the `expo-speech` import (C-07) **[react-logo PNG deletion needs D-7]**

**Files:**
- Delete: `components/ui/ShortsIcon.tsx`, `components/GlobalErrorLogger.ts`, `components/themed-text.tsx`, `components/themed-view.tsx`, `hooks/use-theme-color.ts`
- Delete (if D-7 yes): `assets/images/react-logo.png`, `assets/images/react-logo@2x.png`, `assets/images/react-logo@3x.png`, `assets/button-export-tool.html`, `assets/youtube-controls-export-complete.html`, `VIDEO_FEED_IMPLEMENTATION_GUIDE.zip`
- Modify: `hooks/useVoiceSearch.ts:16`

- [ ] **Step 1: Prove each module is unreferenced (each command must print nothing)**

```bash
grep -rn "ShortsIcon" app components hooks services contexts constants utils --include=*.ts --include=*.tsx | grep -v "components/ui/ShortsIcon.tsx"
grep -rn "GlobalErrorLogger\|setupGlobalErrorHandler" app components hooks services contexts constants utils --include=*.ts --include=*.tsx | grep -v "components/GlobalErrorLogger.ts"
grep -rn "themed-text\|themed-view\|ThemedText\|ThemedView" app components hooks services contexts constants utils --include=*.ts --include=*.tsx | grep -vE "components/themed-(text|view).tsx"
grep -rn "use-theme-color\|useThemeColor" app components hooks services contexts constants utils --include=*.ts --include=*.tsx | grep -v "hooks/use-theme-color.ts"
grep -rn "react-logo\|button-export-tool\|youtube-controls-export" app components hooks services contexts constants utils __tests__ --include=*.ts --include=*.tsx
grep -n "Speech\." hooks/useVoiceSearch.ts
```
Expected: no output from any line. (`themed-text.tsx` and `themed-view.tsx` may import each other and `use-theme-color`; that is why the filter excludes them — all three go together.)

- [ ] **Step 2: Delete and edit**

```bash
git rm -q components/ui/ShortsIcon.tsx components/GlobalErrorLogger.ts components/themed-text.tsx components/themed-view.tsx hooks/use-theme-color.ts
```
If D-7 is yes:
```bash
git rm -q assets/images/react-logo.png assets/images/react-logo@2x.png assets/images/react-logo@3x.png assets/button-export-tool.html assets/youtube-controls-export-complete.html VIDEO_FEED_IMPLEMENTATION_GUIDE.zip
```
In `hooks/useVoiceSearch.ts`, delete line 16 exactly: `import * as Speech from "expo-speech";` (leave the comment block and the other imports untouched).

- [ ] **Step 3: GATE**

Run the GATE procedure. Expected: tsc runtime errors `24` (29 − 2 in `use-theme-color.ts` − 1 in `GlobalErrorLogger.ts` − 2 in `useVoiceSearch.ts`), lint errors ≤ 78, suites 98/98, export unchanged (`assetBytes` 5071209 — the deleted PNGs were never bundled).

- [ ] **Step 4: Commit**

```bash
git add -A hooks/useVoiceSearch.ts
git commit -m "chore: delete dead template modules and the unused expo-speech import

ShortsIcon, GlobalErrorLogger, themed-text/view, use-theme-color had no importers;
expo-speech is not installed and the binding was never used.
gates: tsc=24 lint=78 suites=98/98 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 2 — Asset optimisation

### Task 9: Lint rule against the icon barrel, and deep imports in the 14 non-Shorts files (C-08, part 1)

**Files:**
- Modify: `eslint.config.js`
- Create: `__tests__/lint/noBarrelIcons.test.ts`
- Modify (one line each): `components/Comments/CommentComposer.tsx:28`, `components/Comments/CommentItem.tsx:25`, `components/Comments/CommentsModal.tsx:30`, `components/Comments/Home/HomeVideoCommentsModal.tsx:33`, `components/Search/SearchInput.tsx:4`, `components/ui/IconButton.tsx:4`, `components/Video/actions/sheets/ClipEditor.tsx:5`, `components/Video/actions/sheets/OverflowMenu.tsx:6`, `components/Video/actions/sheets/SaveSheet.tsx:10`, `components/Video/actions/VideoActionButton.tsx:21`, `components/VideoPlayer/ui/controls/ControlButton.tsx:3`, `components/VideoPlayer/ui/ErrorCard.tsx:2`, `components/VideoPlayer/ui/SwipeIndicator.tsx:2`

**Interfaces:**
- Produces: import form `import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";` used by Task 10 for the Shorts files. JSX usage `<MaterialCommunityIcons name=... />` is unchanged because the deep module's default export is the same component the barrel re-exports (verified in `node_modules/@expo/vector-icons/build/IconsLazy.js` lines 131 and 11–15).

- [ ] **Step 1: Write the failing lint fixture test**

Create `__tests__/lint/noBarrelIcons.test.ts`:

```ts
// __tests__/lint/noBarrelIcons.test.ts
// Importing from the @expo/vector-icons barrel bundles all 15 icon fonts
// (4 MB). The ESLint rule below must reject it and accept the deep path.
import path from "path";
import { ESLint } from "eslint";

const ROOT = path.join(__dirname, "..", "..");

async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: path.join(ROOT, "eslint.config.js") });
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, "components", "ui", "LintFixture.tsx") });
  return result.messages.map((m) => m.ruleId ?? "");
}

describe("no-restricted-imports for @expo/vector-icons", () => {
  it("rejects the barrel import", async () => {
    const rules = await lint('import { MaterialCommunityIcons } from "@expo/vector-icons";\nexport const x = MaterialCommunityIcons;\n');
    expect(rules).toContain("no-restricted-imports");
  });

  it("accepts the deep family import", async () => {
    const rules = await lint('import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";\nexport const x = MaterialCommunityIcons;\n');
    expect(rules).not.toContain("no-restricted-imports");
  });
});
```

Run: `npx jest __tests__/lint/noBarrelIcons.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 1 failed, 1 passed, 2 total` (the barrel is currently allowed).

- [ ] **Step 2: Add the rule**

Replace the whole content of `eslint.config.js` with:

```js
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // The .worktrees/ directory holds sibling git worktrees. Linting them
    // double-counts every problem and reports on code owned by another branch.
    // docs/history holds frozen characterization snapshots of removed code
    // (e.g. the pre-redesign VideoPlayer root); their relative imports no
    // longer resolve from their archived location, which is expected.
    ignores: ['dist/*', '.worktrees/**', '.baseline-export/**', 'docs/history/**'],
  },
  {
    // Size guard (docs/size-optimization): the @expo/vector-icons barrel
    // requires every icon family eagerly and bundles all 15 fonts (4 MB).
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message:
                'Import the family directly, e.g. `import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"`, so only the fonts you use are bundled.',
            },
          ],
        },
      ],
    },
  },
]);
```

Run: `npx jest __tests__/lint/noBarrelIcons.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 2 passed, 2 total`.
Run: `npm run lint 2>&1 | grep -c "no-restricted-imports"` — Expected: `18` (every barrel import now errors; the lint error total is temporarily 96).

- [ ] **Step 3: Change the 13 non-Shorts files**

For each file below, replace the exact line `import { MaterialCommunityIcons } from "@expo/vector-icons";` with `import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";`. Do not change anything else in these files.

```bash
for f in components/Comments/CommentComposer.tsx components/Comments/CommentItem.tsx components/Comments/CommentsModal.tsx components/Comments/Home/HomeVideoCommentsModal.tsx components/Search/SearchInput.tsx components/ui/IconButton.tsx components/Video/actions/sheets/ClipEditor.tsx components/Video/actions/sheets/OverflowMenu.tsx components/Video/actions/sheets/SaveSheet.tsx components/Video/actions/VideoActionButton.tsx components/VideoPlayer/ui/controls/ControlButton.tsx components/VideoPlayer/ui/ErrorCard.tsx components/VideoPlayer/ui/SwipeIndicator.tsx; do
  sed -i 's|^import { MaterialCommunityIcons } from "@expo/vector-icons";$|import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";|' "$f"
done
git diff --stat
```
Expected: 13 files changed, 13 insertions, 13 deletions. Run `git diff components/VideoPlayer/ui/ErrorCard.tsx` and confirm the only change is that one line.

- [ ] **Step 4: GATE**

Run the GATE procedure. Expected: tsc 24; lint errors `83` (78 + the 5 remaining barrel imports in Shorts files — they are fixed in Task 10); suites 99/99 (98 + lint fixture); export **unchanged** (`ttfCount` still 20 on Android) because the Shorts files still import the barrel. This is expected at this point.

Also run: `npx jest __tests__/player 2>&1 | grep -E "Test Suites:"` — Expected: all passed (confirms the three player UI files still render icons).

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js __tests__/lint/noBarrelIcons.test.ts components/Comments components/Search/SearchInput.tsx components/ui/IconButton.tsx components/Video/actions components/VideoPlayer/ui/controls/ControlButton.tsx components/VideoPlayer/ui/ErrorCard.tsx components/VideoPlayer/ui/SwipeIndicator.tsx
git commit -m "refactor(icons): deep-import MaterialCommunityIcons in 13 files; lint rule forbids the barrel

Player files ControlButton, ErrorCard, SwipeIndicator: import line only (video-player.md workflow).
Fonts unchanged until the Shorts files follow (Task 10, D-3).
gates: tsc=24 lint=83 suites=99/99 androidAssets=5071209

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 10: Deep imports in the five Shorts files (C-08, part 2) **[needs D-3]**

**Files:**
- Modify (one line each): `app/(tabs)/shorts.tsx:29`, `components/Shorts/ShortActions.tsx:16`, `components/Shorts/ShortCard.tsx:27`, `components/Shorts/ShortsSearchBar.tsx:29`, `components/Shorts/ShortVideoPlayer.tsx:26`

- [ ] **Step 1: Change the five lines**

```bash
for f in "app/(tabs)/shorts.tsx" components/Shorts/ShortActions.tsx components/Shorts/ShortCard.tsx components/Shorts/ShortsSearchBar.tsx components/Shorts/ShortVideoPlayer.tsx; do
  sed -i 's|^import { MaterialCommunityIcons } from "@expo/vector-icons";$|import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";|' "$f"
done
git diff --stat
```
Expected: 5 files changed, 5 insertions, 5 deletions.

- [ ] **Step 2: Run everything except the invariants suite, then commit, then invariants**

R7 in `__tests__/player/invariants.test.ts` runs `git diff --stat main -- components/Shorts hooks/useShortsPlayer.ts` and fails while Shorts edits are uncommitted. Therefore:

Run: `npx jest --testPathIgnorePatterns invariants 2>&1 | grep -E "Test Suites:"` — Expected: all passed.
Run: `npm run lint 2>&1 | grep -E "✖"` — Expected: `78 errors` (back to baseline; zero `no-restricted-imports`).
Run: `npm run typecheck 2>&1 | grep -E "^(app|components|constants|contexts|hooks|services|types|utils)/" | grep -c "error TS"` — Expected: `24`.

```bash
git add "app/(tabs)/shorts.tsx" components/Shorts/ShortActions.tsx components/Shorts/ShortCard.tsx components/Shorts/ShortsSearchBar.tsx components/Shorts/ShortVideoPlayer.tsx
git commit -m "refactor(shorts): deep-import MaterialCommunityIcons (import line only; approved D-3)

Shorts remains a separate experience; no behaviour change.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Run: `npx jest __tests__/player/invariants.test.ts 2>&1 | grep -E "Tests:"` — Expected: all passed (R7 diff against `main` is now empty).

- [ ] **Step 3: Measure the font drop**

Run: `npm run size:export >/dev/null 2>&1; npm run size:report | grep -E "^platform|^assets|^ttf|^\s+[0-9]+ .*\.ttf|assets/"`
Expected Android: `assets 30 files, <N> B` with N ≤ 2658869 and `ttf 3` (lines for 1307660, 966544, 356840). Expected iOS: `assets 26 files, <N> B` with N ≤ 1692711 and `ttf 2`.

Confirm the export log names only two vector-icon fonts: `npx expo export --platform android --output-dir .baseline-export/android 2>&1 | grep -c "vector-icons.*\.ttf"` — Expected: `2`.

- [ ] **Step 4: Tighten the budget and commit**

Edit `docs/size-optimization/size-budget.json`: set `android.assetBytes` and `ios.assetBytes` to the measured values from Step 3, `android.assetCount` 30, `ios.assetCount` 26, `android.ttfCount` 3, `ios.ttfCount` 2.
Run: `npm run size:check; echo exit=$?` — Expected: `exit=0`.

```bash
git add docs/size-optimization/size-budget.json
git commit -m "chore(size): tighten asset budget after icon font pruning (android 47→30 assets, ios 43→26)

gates: tsc=24 lint=78 suites=99/99 androidAssets=<measured>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 11: Retire MaterialIcons by mapping tab icons to MaterialCommunityIcons (C-08b) **[needs D-4b; optional]**

**Files:**
- Modify: `components/ui/icon-symbol.tsx` (whole file)

- [ ] **Step 1: Replace the file**

```tsx
// components/ui/icon-symbol.tsx
// Fallback for Android and web: the iOS file (icon-symbol.ios.tsx) renders SF
// Symbols; here the same names map onto MaterialCommunityIcons glyphs so that
// only one icon font is bundled (docs/size-optimization).
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const MAPPING = {
  "house.fill": "home",
  "dot.radiowaves.left.and.right": "access-point",
  "bookmark.fill": "bookmark",
  magnifyingglass: "magnify",
  "gearshape.fill": "cog",
} as const satisfies Record<string, MaterialCommunityIconName>;

export type IconSymbolName = keyof typeof MAPPING;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: "ultraLight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black";
}) {
  return <MaterialCommunityIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
```

- [ ] **Step 2: GATE and measure**

Run the GATE procedure. Expected: tsc `22` (the two `icon-symbol.tsx` errors are gone), lint ≤ 78, suites 99/99, Android `ttf 2` (`MaterialIcons.ttf` gone; assets −356,840 B), iOS `ttf 1`. Take emulator screenshots of the tab bar for D-4b if not already approved on the glyph names above.

- [ ] **Step 3: Tighten budget and commit**

Update `docs/size-optimization/size-budget.json` `assetBytes`, `assetCount` (29 / 25) and `ttfCount` (2 / 1) to measured values; `npm run size:check; echo exit=$?` → `exit=0`.

```bash
git add components/ui/icon-symbol.tsx docs/size-optimization/size-budget.json
git commit -m "refactor(icons): map tab symbols to MaterialCommunityIcons; MaterialIcons font no longer bundled

gates: tsc=22 lint=78 suites=99/99 androidAssets=<measured>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 12: Raster Shorts tab icon; remove react-native-svg and its transformer (C-09) **[needs D-4]**

**Files:**
- Create: `scripts/rasterize-shorts-icons.js`, `assets/icons/shorts-active.png`, `assets/icons/shorts-active@2x.png`, `assets/icons/shorts-active@3x.png`, `assets/icons/shorts-inactive.png`, `assets/icons/shorts-inactive@2x.png`, `assets/icons/shorts-inactive@3x.png`
- Modify: `app/(tabs)/_layout.tsx` (lines 1–12 and 46–58), `metro.config.js` (whole file), `package.json` (`jest.moduleNameMapper`, dependencies), `jest.web.config.js` (line 9–11), `__tests__/navigation/tabLayout.test.tsx` (append a test)
- Delete: `assets/icons/shorts-active.svg`, `assets/icons/shorts-inactive.svg`, `declarations.d.ts`, `__mocks__/svgMock.js`

- [ ] **Step 1: Write the failing tab-icon test**

Append to `__tests__/navigation/tabLayout.test.tsx` (after the last `});` of the `describe`):

```ts

describe("shorts tab icon assets", () => {
  const ICONS_DIR = path.join(__dirname, "..", "..", "assets", "icons");
  it.each([
    "shorts-active.png",
    "shorts-active@2x.png",
    "shorts-active@3x.png",
    "shorts-inactive.png",
    "shorts-inactive@2x.png",
    "shorts-inactive@3x.png",
  ])("ships %s as a raster asset", (file) => {
    expect(fs.existsSync(path.join(ICONS_DIR, file))).toBe(true);
  });

  it("no longer ships SVG sources (react-native-svg was removed)", () => {
    expect(fs.existsSync(path.join(ICONS_DIR, "shorts-active.svg"))).toBe(false);
    expect(fs.existsSync(path.join(ICONS_DIR, "shorts-inactive.svg"))).toBe(false);
  });

  it("renders the shorts tab icon from the PNG in the tab layout source", () => {
    const layout = fs.readFileSync(path.join(TABS_DIR, "_layout.tsx"), "utf8");
    expect(layout).toContain('require("@/assets/icons/shorts-active.png")');
    expect(layout).toContain('require("@/assets/icons/shorts-inactive.png")');
    expect(layout).not.toContain(".svg");
  });
});
```

Run: `npx jest __tests__/navigation/tabLayout.test.tsx 2>&1 | grep -E "Tests:"` — Expected: `Tests: 8 failed, 4 passed, 12 total`.

- [ ] **Step 2: Create the rasteriser script and run it**

Create `scripts/rasterize-shorts-icons.js`:

```js
// scripts/rasterize-shorts-icons.js
// One-off, reproducible rasterisation of the Shorts tab icon (previously two
// SVGs rendered through react-native-svg). Sizes are tokens.iconSize.lg (28)
// at 1x, 2x, 3x. Run: npm install --no-save sharp && node scripts/rasterize-shorts-icons.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "assets", "icons");
const BASE = 28;

const SHAPE =
  "M200 160c30-28 80-28 110 0 16 14 16 38 0 52 18 6 28 24 22 42-8 26-40 34-64 26-28-10-40-40-32-64 4-12 18-20 30-16 8 2 12 8 10 14-2 8-2 18 8 22 8 4 18 0 22-6 6-8 2-18-6-20-10-4-18 2-22 8-6 8-20 12-34 6-16-8-22-28-14-44 10-24 36-30 60-22 6 2 12 6 16 12 4 4 12 4 16 0 4-4 4-12 0-16-10-12-26-20-42-24-44-10-88 10-112 44-6 8-4 20 4 26 8 6 20 4 26-4 20-22 50-34 80-28 8 2 12 12 8 18-4 8-12 10-18 6-6-4-12-4-18 0-6 4-10 12-6 18 8 12 22 20 36 22 26 4 54-4 74-20 20-16 30-38 30-62 0-34-22-64-52-80-46-26-104-26-150 0-14 8-20 26-12 40 6 10 20 14 30 8 6-4 12-8 18-12z";

function svg(bg, fg) {
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect x="40" y="40" width="432" height="432" rx="96" fill="${bg}"/><path fill="${fg}" d="${SHAPE}"/></svg>`;
}

const VARIANTS = [
  { name: "shorts-active", bg: "#FF0000", fg: "#FFFFFF" },
  { name: "shorts-inactive", bg: "#9E9E9E", fg: "#E6E6E6" },
];

(async () => {
  for (const v of VARIANTS) {
    for (const scale of [1, 2, 3]) {
      const size = BASE * scale;
      const file = path.join(OUT, `${v.name}${scale === 1 ? "" : `@${scale}x`}.png`);
      await sharp(Buffer.from(svg(v.bg, v.fg))).resize(size, size).png({ compressionLevel: 9, palette: true }).toFile(file);
      console.log(file, fs.statSync(file).size, "B");
    }
  }
})();
```

The path data is copied verbatim from `assets/icons/shorts-active.svg` (both SVGs share it; only colours differ).

Run: `npm install --no-save sharp 2>&1 | tail -1 && node scripts/rasterize-shorts-icons.js`
Expected: six lines, each under 3,000 B. Then `git status --short package.json package-lock.json` — Expected: no output (`--no-save` leaves both untouched). If `package-lock.json` shows as modified, run `git checkout package-lock.json`.

- [ ] **Step 3: Rewrite the tab layout imports and the Shorts icon**

In `app/(tabs)/_layout.tsx` replace lines 1–11 with:

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";
import { Image, useColorScheme } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getColors, tokens } from "@/constants/tokens";

// Raster tab icon at 1x/2x/3x (Metro picks the scale). Fixed brand colours,
// so no tint is applied. Generated by scripts/rasterize-shorts-icons.js.
const SHORTS_ACTIVE = require("@/assets/icons/shorts-active.png");
const SHORTS_INACTIVE = require("@/assets/icons/shorts-inactive.png");
```

and replace the `tabBarIcon` for the `shorts` screen (the block from `tabBarIcon: ({ focused }) =>` through the closing `),`) with:

```tsx
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? SHORTS_ACTIVE : SHORTS_INACTIVE}
              style={{ width: tokens.iconSize.lg, height: tokens.iconSize.lg }}
              accessibilityIgnoresInvertColors
            />
          ),
```

- [ ] **Step 4: Remove SVG plumbing**

```bash
git rm -q assets/icons/shorts-active.svg assets/icons/shorts-inactive.svg declarations.d.ts __mocks__/svgMock.js
```

Replace the whole content of `metro.config.js` with:

```js
// metro.config.js (project root)
// Default Expo Metro config. The react-native-svg-transformer customisation was
// removed on 2026-09 (docs/size-optimization/architecture/LLD.md, C-09): the only
// SVGs were two tab icons, now shipped as PNGs.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
```

In `package.json`, delete the `"moduleNameMapper"` block from the `"jest"` section (lines `"moduleNameMapper": {`, `"\\.svg$": "<rootDir>/__mocks__/svgMock.js"`, `},`).

In `jest.web.config.js`, delete the three lines `moduleNameMapper: {`, `"\.svg$": "<rootDir>/__mocks__/svgMock.js",`, `},`.

Run: `npm uninstall react-native-svg react-native-svg-transformer 2>&1 | tail -1`.

Extend `__tests__/scripts/dependencyGuards.test.ts` `FORBIDDEN_DEPENDENCIES` with two entries: `"react-native-svg",` and `"react-native-svg-transformer",`.

- [ ] **Step 5: GATE, autolinking, web export**

Run: `npx jest __tests__/navigation/tabLayout.test.tsx __tests__/scripts/dependencyGuards.test.ts 2>&1 | grep -E "Tests:"` — Expected: all passed (12 + 13).
Run the GATE procedure. Expected: tsc ≤ 24 (deleting `declarations.d.ts` removes the `*.svg` module declaration; nothing else imports `.svg`), lint ≤ 78, all suites passed, Android `assetCount` +6 (six PNGs) with `assetBytes` growth under 20,000 B and `bundleBytes` **smaller** than Task 10/11 (react-native-svg JS gone). Record both numbers.
Run: `npx expo-modules-autolinking react-native-config -p android --json | grep -c "react-native-svg"` — Expected: `0`.
Run: `npx expo export --platform web --output-dir .baseline-export/web 2>&1 | tail -1` — Expected: `Exported: .baseline-export/web`. Run `npm run test:web 2>&1 | grep -E "Test Suites:"` — Expected: no `failed`.

- [ ] **Step 6: Visual check for D-4**

Run: `npx expo start --android` on an emulator (or `npx expo run:android` after prebuild); capture the tab bar with the Shorts tab focused and unfocused; compare with the pre-change screenshot (take it before Step 3 by checking out `HEAD` in a second terminal if needed: `git stash` is **not** allowed here — take the "before" screenshot before starting Step 3). Attach both to the D-4 request. Proceed to Step 7 only after D-4 approval; otherwise `git checkout -- . && git clean -fd assets/icons scripts/rasterize-shorts-icons.js && npm ci` to undo and record "C-09 rejected by D-4".

- [ ] **Step 7: Tighten budget and commit**

Update `docs/size-optimization/size-budget.json` (`bundleBytes`, `assetBytes`, `assetCount` for both platforms) to the measured values; `npm run size:check; echo exit=$?` → `exit=0`.

```bash
git add -A app/\(tabs\)/_layout.tsx metro.config.js package.json package-lock.json jest.web.config.js scripts/rasterize-shorts-icons.js assets/icons __tests__/navigation/tabLayout.test.tsx __tests__/scripts/dependencyGuards.test.ts docs/size-optimization/size-budget.json
git commit -m "refactor(tabs): ship the Shorts tab icon as PNG and remove react-native-svg + transformer

Visual parity approved (D-4). Removes 104 KB of unminified JS and one native module.
gates: tsc=<n> lint=78 suites=<n>/<n> androidAssets=<measured>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 13: Blurhash thumbnail placeholder (C-10) **[needs D-5; optional]**

**Files:**
- Modify: `constants/tokens.ts` (add one exported constant), `components/VideoFeed/VideoCard.tsx:147-148`, `components/VideoFeed/UpNextList.tsx:83`
- Delete: `assets/images/partial-react-logo.png`

- [ ] **Step 1: Add the token**

In `constants/tokens.ts`, after the `export type ColorScheme = "light" | "dark";` line add:

```ts
/**
 * Neutral warm-grey blurhash shown by expo-image while a thumbnail loads.
 * A string instead of a bundled PNG (docs/size-optimization, C-10).
 */
export const THUMBNAIL_PLACEHOLDER_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
```

- [ ] **Step 2: Use it**

In `components/VideoFeed/VideoCard.tsx` replace line 147 `placeholder={require("../../assets/images/partial-react-logo.png")}` with `placeholder={{ blurhash: THUMBNAIL_PLACEHOLDER_BLURHASH }}` and line 148 `placeholderContentFit="contain"` with `placeholderContentFit="cover"`. Add `THUMBNAIL_PLACEHOLDER_BLURHASH` to the existing import from `../../constants/tokens` (if the file imports `tokens` from that path, extend that import; if it does not import from tokens at all, add `import { THUMBNAIL_PLACEHOLDER_BLURHASH } from "../../constants/tokens";` after the other relative imports).

In `components/VideoFeed/UpNextList.tsx` replace line 83 the same way and add the same import.

```bash
git rm -q assets/images/partial-react-logo.png
grep -rn "partial-react-logo" app components || echo "no references left"
```
Expected: `no references left`.

- [ ] **Step 3: GATE and commit**

Run the GATE procedure. Expected: suites all passed (`HomeScreen`, `VideoScreen` render with the blurhash source), Android `assetCount` −1 and `assetBytes` −5,075 versus the previous task. Update `size-budget.json`; `npm run size:check` exit 0.

```bash
git add constants/tokens.ts components/VideoFeed/VideoCard.tsx components/VideoFeed/UpNextList.tsx docs/size-optimization/size-budget.json
git commit -m "feat(feed): blurhash thumbnail placeholder replaces the bundled React-logo PNG

gates: tsc=<n> lint=78 suites=<n>/<n> androidAssets=<measured>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 3 — JavaScript optimisation

### Task 14: Production console stripping and Logger gating (C-11)

**Files:**
- Modify: `babel.config.js` (whole file), `utils/Logger.ts` (functions `debug` and `info`), `__tests__/Logger.test.ts` (add `__DEV__` handling)
- Create: `__tests__/build/babelProduction.test.ts`
- Modify: `package.json` (devDependency `babel-plugin-transform-remove-console`)

- [ ] **Step 1: Write the failing transform test**

Create `__tests__/build/babelProduction.test.ts`:

```ts
// __tests__/build/babelProduction.test.ts
// Production builds must drop console.log/info/debug (73 call sites today)
// while keeping console.error/warn, which utils/Logger uses for observability.
import path from "path";
import { transformSync } from "@babel/core";

const ROOT = path.join(__dirname, "..", "..");

type BabelConfigFactory = (api: { cache: { using: (fn: () => string | undefined) => void } }) => {
  env?: { production?: { plugins?: unknown[] } };
};

function productionPlugins(): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const factory = require(path.join(ROOT, "babel.config.js")) as BabelConfigFactory;
  const config = factory({ cache: { using: (fn) => fn() } });
  return config.env?.production?.plugins ?? [];
}

const SOURCE = 'console.log("drop me"); console.info("drop"); console.debug("drop"); console.warn("keep"); console.error("keep");';

describe("babel production config", () => {
  it("declares transform-remove-console for production", () => {
    expect(JSON.stringify(productionPlugins())).toContain("transform-remove-console");
  });

  it("removes log/info/debug and keeps warn/error", () => {
    const out = transformSync(SOURCE, { filename: "fixture.js", babelrc: false, configFile: false, plugins: productionPlugins() as never })?.code ?? "";
    expect(out).not.toContain("console.log");
    expect(out).not.toContain("console.info");
    expect(out).not.toContain("console.debug");
    expect(out).toContain("console.warn");
    expect(out).toContain("console.error");
  });
});
```

Run: `npx jest __tests__/build/babelProduction.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 2 failed, 2 total`.

- [ ] **Step 2: Install the plugin and rewrite babel.config.js**

Run: `npm install -D babel-plugin-transform-remove-console 2>&1 | tail -1`

Replace the whole content of `babel.config.js` with:

```js
module.exports = function (api) {
  // Cache per NODE_ENV so the production-only plugins below are not reused
  // from a development run (expo export sets NODE_ENV=production).
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ["babel-preset-expo"], // includes Expo Router transforms
    plugins: [
      // Path aliasing for "@/..."
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
          },
        },
      ],
      // Keep the Reanimated (worklets) plugin last.
      "react-native-reanimated/plugin",
    ],
    env: {
      production: {
        // Size guard (docs/size-optimization, C-11): strip development logging
        // from release bundles. error/warn stay: utils/Logger routes
        // observability through them.
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
    },
  };
};
```

Run: `npx jest __tests__/build/babelProduction.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 2 passed, 2 total`.

- [ ] **Step 3: Gate Logger.debug/info on `__DEV__` — test first**

In `__tests__/Logger.test.ts`, inside `describe("Logger", ...)` after the existing `afterEach`, add:

```ts
  it("is silent for debug and info when __DEV__ is false, and still emits warn and error", () => {
    const g = globalThis as { __DEV__?: boolean };
    const previous = g.__DEV__;
    g.__DEV__ = false;
    try {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const prod = require("../utils/Logger").default as typeof Logger;
      prod.debug("Scope", "d");
      prod.info("Scope", "i");
      prod.warn("Scope", "w");
      prod.error("Scope", "e");
      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      g.__DEV__ = previous;
    }
  });
```

Run: `npx jest __tests__/Logger.test.ts 2>&1 | grep -E "Tests:"` — Expected: `Tests: 1 failed, N passed`.

In `utils/Logger.ts`, replace the `debug` and `info` functions with:

```ts
function debug(scope: string | null, ...parts: any[]) {
  if (!__DEV__) return;
  cDebug(fmt("DEBUG", scope ?? null, ...parts));
}
function info(scope: string | null, ...parts: any[]) {
  if (!__DEV__) return;
  cInfo(fmt("INFO", scope ?? null, ...parts));
}
```

Run: `npx jest __tests__/Logger.test.ts 2>&1 | grep -E "Tests:"` — Expected: all passed (jest-expo sets `__DEV__ = true` by default, so the existing info/debug expectations still hold).

- [ ] **Step 4: Prove it on a production export**

```bash
npx expo export --platform android --no-bytecode --output-dir .baseline-export/android-js >/dev/null 2>&1
JS=$(ls .baseline-export/android-js/_expo/static/js/android/*.js)
grep -c "console\.log(" "$JS"; grep -c "console\.info(" "$JS"; grep -c "console\.error(" "$JS"
```
Expected: first two numbers `0` (minified code may rename `console` only inside modules that alias it; a residual count from `node_modules` internals is acceptable if it is lower than before — record the before number by running the same three commands on a `git stash`-free basis: re-run after `git checkout HEAD~0 -- babel.config.js` is **not** allowed; instead compare against the value recorded in `bundle-optimization.md` §2.3 during Phase 9); third number greater than `0`.

- [ ] **Step 5: GATE and commit**

Run the GATE procedure. Expected: suites all passed (100 + 1 new), `bundleBytes` (HBC) **smaller** than Task 12/13 on both platforms; assets unchanged. Update `size-budget.json` `bundleBytes` for both platforms; `npm run size:check` exit 0.

```bash
git add babel.config.js utils/Logger.ts __tests__/Logger.test.ts __tests__/build/babelProduction.test.ts package.json package-lock.json docs/size-optimization/size-budget.json
git commit -m "build(babel): strip console.log/info/debug in production; gate Logger.debug/info on __DEV__

console.error/warn preserved for observability.
gates: tsc=<n> lint=78 suites=<n>/<n> androidBundle=<measured>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 4 — Expo configuration

### Task 15: Confirm defaults; no functional change (C-12)

**Files:**
- Modify: `docs/size-optimization/architecture/build-architecture.md` §1 (append a "Confirmed on <date>" line)

- [ ] **Step 1: Introspect**

Run: `npx expo config --type introspect 2>/dev/null | grep -E "jsEngine|newArchEnabled|reactCompiler|typedRoutes|\"output\"" || echo "no explicit jsEngine/newArch keys (defaults: hermes, new architecture)"`
Record the output verbatim in `build-architecture.md` §1 as a new final table row `| Confirmed <date> | <output> |`. Confirm `package.json` contains no `"expo": { "autolinking"` key: `grep -c '"autolinking"' package.json` → `0`.

- [ ] **Step 2: Commit**

```bash
git add docs/size-optimization/architecture/build-architecture.md
git commit -m "docs(size): confirm Expo config defaults (Hermes, New Architecture, no autolinking excludes)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 5 — Android native optimisation

### Task 16: R8 and resource shrinking via expo-build-properties (C-14) **[needs D-1, D-2; requires Task 4 baseline]**

**Files:**
- Modify: `app.json` (`plugins` array), `package.json` (dependency)

- [ ] **Step 1: Install and read the plugin schema**

Run: `npx expo install expo-build-properties 2>&1 | tail -1`
Run: `grep -nE "enableProguardInReleaseBuilds|enableShrinkResourcesInReleaseBuilds|enableMinifyInReleaseBuilds|extraProguardRules" node_modules/expo-build-properties/build/pluginConfig.d.ts`
Expected: at least `enableProguardInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds` listed. If `enableMinifyInReleaseBuilds` is also listed, include it below. If neither of the first two exists, stop and report the actual property names printed by the grep; do not guess.

- [ ] **Step 2: Add the plugin to app.json**

In `app.json` `"plugins"`, after the `expo-splash-screen` entry (inside the array, before `]`), add:

```json
      ,[
        "expo-build-properties",
        {
          "android": {
            "enableProguardInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ]
```
(Place the comma correctly: the previous array element must end with `,`.) Add `"enableMinifyInReleaseBuilds": true` inside the `android` object only if Step 1 listed it.

- [ ] **Step 3: Prebuild and confirm the flags reached Gradle**

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"; export ANDROID_SDK_ROOT="$ANDROID_HOME"
npx expo prebuild -p android --clean --no-install
grep -nE "enableProguardInReleaseBuilds|enableShrinkResourcesInReleaseBuilds|enableMinifyInReleaseBuilds" android/gradle.properties
grep -nE "minifyEnabled|shrinkResources" android/app/build.gradle
```
Expected: `gradle.properties` shows `=true` for the configured keys; `build.gradle` shows `minifyEnabled` and `shrinkResources` referencing those properties.

- [ ] **Step 4: Build, keep the mapping, measure**

```bash
cd android && ./gradlew :app:bundleRelease --no-daemon 2>&1 | tail -3 && cd ..
mkdir -p .size-reports/r8 && cp android/app/build/outputs/mapping/release/mapping.txt .size-reports/r8/mapping.txt
```
Then repeat Task 4 Step 3 exactly (same commands) and write `.size-reports/r8-android.md`. Expected: every number ≤ the Task 4 baseline; record the deltas for AAB, arm64 download, universal APK, `dex`, `lib/arm64-v8a`, `res`.

- [ ] **Step 5: Release-build regression on the emulator (mandatory)**

```bash
java -jar .size-reports/bundletool.jar install-apks --apks=.size-reports/app.apks
```
(Requires a running emulator: start one from Android Studio's Device Manager first.) Then execute rows 1, 3, 7, 8, 9, 11, 12, 13, 15, 21, 29, 30, 31, 37, 38, 40 of `docs/size-optimization/implementation/regression-matrix.md` by hand and record pass/fail per row in `.size-reports/r8-regression.md`. Watch `adb logcat | grep -E "ClassNotFoundException|NoSuchMethodError|ExpoModulesCore"` during rows 8, 9, 11.

Decision rule: all listed rows pass → continue. Any row fails with a `ClassNotFoundException`/`NoSuchMethod` in logcat → add to the plugin config `"extraProguardRules": "-keep class <package-from-logcat>.** { *; }"` (narrowest package that appears in the log; for media3 use `androidx.media3.**`, for webview `com.reactnativecommunity.webview.**`), rebuild (Steps 3–4), re-run the failing row. If it still fails after two keep-rule iterations, set both properties back to `false`, record "C-14 rejected: <row> fails, see .size-reports/r8-regression.md" in the decision log, and skip to Task 17.

- [ ] **Step 6: Record and commit**

Update `docs/size-optimization/optimization/size-baseline.md` §6 with "after C-14" numbers next to the baseline numbers; update `size-budget.json` `android.aabBytes` and `android.arm64DownloadMaxBytes`; add a decision-log row `DL-15` with the measured deltas and any keep rule.

```bash
git add app.json package.json package-lock.json docs/size-optimization/optimization/size-baseline.md docs/size-optimization/size-budget.json docs/size-optimization/optimization/optimization-decision-log.md
git commit -m "build(android): enable R8 and resource shrinking via expo-build-properties

Release-build regression rows passed on emulator; mapping.txt retained under .size-reports/.
AAB <before>→<after> B; arm64 download <before>→<after> B.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 6 — Video verification

### Task 17: Player invariants and engine properties unchanged (C-16)

- [ ] **Step 1: Verify**

```bash
npx jest __tests__/player/invariants.test.ts 2>&1 | grep -E "Tests:"
grep -n "keepScreenOnWhilePlaying = true\|staysActiveInBackground = false" components/VideoPlayer/engine/PlaybackEngine.ts
git diff --stat b3fb438 -- components/VideoPlayer/engine components/VideoPlayer/platform components/VideoPlayer/Player.tsx components/VideoPlayer/ui/PlayerSurface.tsx
```
Expected: invariants all passed; two grep hits (lines 176–177); the `git diff --stat` prints nothing. If the diff prints anything, stop and report — a protected file was modified.

- [ ] **Step 2: Record**

Append to `docs/size-optimization/implementation/acceptance-criteria.md` under "Per phase", row "6 Video": ` — verified <date>: invariants green; protected diff empty.` Commit:

```bash
git add docs/size-optimization/implementation/acceptance-criteria.md
git commit -m "docs(size): phase 6 video verification recorded

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 7 — Production build documentation

### Task 18: Release build instructions (C-17)

**Files:**
- Modify: `README.md` (append section), `docs/size-optimization/architecture/build-architecture.md` §4

- [ ] **Step 1: Append to README.md**

```markdown

## Building a release

Android identifiers and build flags live in `app.json`; EAS profiles in `eas.json`.

- Local AAB (needs Java 17 and the Android SDK, `ANDROID_HOME` set): `npx expo prebuild -p android --clean && cd android && ./gradlew :app:bundleRelease`
- EAS: `eas build -p android --profile production` (AAB) or `--profile preview` (APK for QA).
- Keep `android/app/build/outputs/mapping/release/mapping.txt` with every release: R8 obfuscation is enabled and crash stacks need it.
- Size check before merging: `npm run size:export && npm run size:check` (budget in `docs/size-optimization/size-budget.json`).
```

- [ ] **Step 2: Update build-architecture.md §4** with the D-2 choice actually used and the exact commands run in Tasks 4 and 16. Commit:

```bash
git add README.md docs/size-optimization/architecture/build-architecture.md
git commit -m "docs: release build instructions and size check

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 8–9 — Regression and verification

### Task 19: Full regression matrix and final measurement (C-18)

**Files:**
- Create (git-ignored): `.size-reports/final-regression.md`, `.size-reports/final-android.md`
- Modify: `docs/size-optimization/optimization/size-baseline.md` §7 (add "After" column), `docs/size-optimization/optimization/performance-impact.md` §3 (fill results)

- [ ] **Step 1: Final exports and report**

Run: `npm run size:export >/dev/null 2>&1 && npm run size:report > .size-reports/final-size-report.txt && cat .size-reports/final-size-report.txt`
Record for both platforms: `bundleBytes`, `assetCount`, `assetBytes`, `ttf` lines, `autolinking`.

- [ ] **Step 2: Final Android build numbers**

Repeat Task 4 Step 3 on the current state (after Task 16) and save as `.size-reports/final-android.md`. Also run `"$ANDROID_HOME/build-tools/<latest>/aapt2" dump badging .size-reports/universal.apk | grep uses-permission | sort > .size-reports/final-permissions.txt` and diff against the Task 4 list; every removed permission is recorded, no new permission is allowed.

- [ ] **Step 3: Execute every row of the regression matrix**

On the emulator with the final release APK installed, execute all 46 rows of `docs/size-optimization/implementation/regression-matrix.md`; write `pass` / `fail` / `not run (<reason>)` per row into `.size-reports/final-regression.md`. Rows needing a physical device (PiP, brightness swipe hardware, haptics feel) are `not run (device deferred)`.

- [ ] **Step 4: Emulator performance protocol**

From `performance-impact.md` §3 run the emulator rows: cold start 10× `adb shell am start -W -n <package>/.MainActivity | grep TotalTime` (median), `adb shell dumpsys meminfo <package> | grep "TOTAL PSS"` at home and during HLS. Record next to the Task 4 baseline values (take the baseline values now if Task 4 did not capture them: run the same commands on the Task 4 universal APK, which is still in `.size-reports/universal.apk` unless overwritten — if overwritten, rebuild from the Task 4 commit with `git worktree` **not** allowed; instead note "baseline cold start not captured" honestly).

- [ ] **Step 5: Write the "after" columns and commit**

Fill the "After" values into `size-baseline.md` §7 (add a column) and §6; fill `performance-impact.md` §3 results. Commit:

```bash
git add docs/size-optimization/optimization/size-baseline.md docs/size-optimization/optimization/performance-impact.md
git commit -m "docs(size): final measurements and regression results

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 10 — Hardening

### Task 20: Guards, budget, documentation, CLAUDE.md line (C-19) **[CLAUDE.md edit needs D-9]**

**Files:**
- Modify: `eslint.config.js` (extend `paths`), `docs/size-optimization/size-budget.json`, `docs/reference/Project-structure-of-expo-live-player.md`, `docs/size-optimization/README.md` (status line), `docs/size-optimization/optimization/optimization-decision-log.md` (statuses), `CLAUDE.md` §1 (only with D-9)

- [ ] **Step 1: Extend the lint guard with removed packages**

In `eslint.config.js`, inside the `no-restricted-imports` `paths` array, after the `@expo/vector-icons` object, add one object per removed package:

```js
            { name: 'react-native-paper', message: 'Removed for size (docs/size-optimization). Use existing components/ui.' },
            { name: 'react-native-svg', message: 'Removed for size (docs/size-optimization). Ship PNG assets instead.' },
            { name: 'expo-audio', message: 'Removed for size; expo-video owns the audio session.' },
            { name: 'expo-linear-gradient', message: 'Removed for size (docs/size-optimization).' },
            { name: 'expo-web-browser', message: 'Removed for size (docs/size-optimization).' },
            { name: '@react-native-community/slider', message: 'Removed for size; the player ProgressBar is custom.' },
```

Run: `npm run lint 2>&1 | grep -E "✖"` — Expected: unchanged error count (78).

- [ ] **Step 2: Final budget**

Set every value in `docs/size-optimization/size-budget.json` to the final measured values from Task 19 (bundle, assets, counts, ttf, aab, arm64). Run `npm run size:check; echo exit=$?` → `exit=0`.

- [ ] **Step 3: Documentation**

- `docs/reference/Project-structure-of-expo-live-player.md`: remove entries for the deleted files (`ShortsIcon.tsx`, `GlobalErrorLogger.ts`, `themed-*.tsx`, `use-theme-color.ts`, `declarations.d.ts`, `__mocks__/svgMock.js`, `assets/icons/*.svg`) and add `scripts/measure-app-size.js`, `scripts/rasterize-shorts-icons.js`, `docs/size-optimization/`.
- `docs/size-optimization/README.md`: change the Status row to `Implemented <date>; see optimization/size-baseline.md §7 for before/after`.
- `docs/size-optimization/optimization/optimization-decision-log.md`: set each `Proposed` row to `Approved`/`Rejected`/`Skipped (D-n)` according to what happened.
- `CLAUDE.md` §1, only if D-9 approved the wording: replace `Stack: React Native, Expo Managed Workflow (SDK 54), Expo Router v6, TypeScript 5.9 (strict mode).` and `Expo SDK: 54.0.22; Node.js: 26.8.2; playback via `expo-video` ~3.0.11.` with `Stack: React Native 0.86, Expo Managed Workflow (SDK 57), Expo Router 57, TypeScript 6.0 (strict mode).` and `Expo SDK: 57.0.23; Node.js: 26.8.2; playback via `expo-video` ~57.0.4.`

- [ ] **Step 4: Final GATE and commit**

Run the GATE procedure one last time; all suites pass; `npm run size:check` exit 0.

```bash
git add eslint.config.js docs/size-optimization docs/reference/Project-structure-of-expo-live-player.md CLAUDE.md
git commit -m "chore(size): lint guards for removed packages, final budget, documentation updates

gates: tsc=<n> lint=78 suites=<n>/<n> androidAssets=<final>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review (performed while writing)

- Spec coverage: C-01→Task 1, C-02→Task 2, C-03→Task 3, C-03b→Task 4, C-04→Task 5, C-05→Task 6, C-06→Task 7, C-07→Task 8, C-08→Tasks 9–10, C-08b→Task 11, C-09→Task 12, C-10→Task 13, C-11→Task 14, C-12→Task 15, C-14→Task 16, C-15→no task (no default change; X-3 is an experiment needing D-6), C-16→Task 17, C-17→Task 18, C-18→Task 19, C-19→Task 20. Experiments X-1/X-3/X-4 are intentionally not tasks.
- Placeholders: none. Angle-bracket values (`<measured>`, `<IOS_BUNDLE_ID>`) are values that only exist at execution time and each states where the value comes from.
- Name consistency: `FORBIDDEN_DEPENDENCIES` (Tasks 5, 6, 12); `THUMBNAIL_PLACEHOLDER_BLURHASH` (Task 13); `measure-app-size.js` flags `--json`, `--assert`, `--no-autolinking` (Tasks 2, 6, 10–14, 20); budget keys `bundleBytes`, `assetBytes`, `assetCount`, `ttfCount`, `aabBytes`, `arm64DownloadMaxBytes` (Tasks 2, 4, 10–14, 16, 20).
