# Performance Impact and Regression Matrix

Rule: a size change is accepted only if every performance column is "none" or "improves" on the evidence collected in Phase 9, or if a measured regression is explicitly accepted by the human. Device-dependent measurements are deferred per instruction; the matrix records expected direction from mechanism and names the measurement that will confirm it.

## 1. Regression matrix

| Change | Size benefit | Cold start | Warm start | Navigation latency | JS execution | Rendering / FPS | Memory | Video startup | Video playback | Scrolling | Touch | Network | Battery | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C-01 test harness fix | none | none (tests only) | — | — | — | — | — | — | — | — | — | — | — | None |
| C-02 measurement script, gitignore | none | none | — | — | — | — | — | — | — | — | — | — | — | None |
| C-03 identifiers + eas.json | none | none | — | — | — | — | — | — | — | — | — | — | — | None |
| C-04 remove 4 unused native modules | native NOT MEASURED | improves slightly: 4 fewer modules registered by ExpoModulesCore at launch | improves slightly | none | none | none | improves slightly (fewer loaded classes) | none | none | none | none | none | none | Low |
| C-05 remove unused JS packages | 0 B | none | none | none | none | none | none | none | none | none | none | none | none | None |
| C-06 dev tooling to devDependencies | 0 B | none | — | — | — | — | — | — | — | — | — | — | — | None |
| C-07 delete dead modules, drop `expo-speech` import | 0 B | none | none | none | none | none | none | none | none | none | none | none | none | None |
| C-08 deep icon imports | −2,412,340 B assets/platform | improves: 17 fewer entries in the asset registry evaluated at bundle load; font files are loaded lazily per family, so unused families were never read, but their registry entries and module wrappers were | improves slightly | none | improves slightly (15 fewer family modules evaluated) | none | improves slightly | none | none | none | none | none | none | Low |
| C-08b drop MaterialIcons (optional) | −356,840 B | as above | — | none | none | none | none | none | none | none | none | none | none | Low (visual) |
| C-09 raster Shorts icon, drop react-native-svg | −104,413 B JS unminified; native NOT MEASURED | improves slightly (one fewer native module and 104 KB less JS to load) | improves slightly | none | none | Tab icon becomes an `Image` draw instead of an SVG render: equal or cheaper | none | none | none | none | none | none | none | Low–medium (visual sign-off) |
| C-10 blurhash placeholder | −5,075 B | none | none | none | Blurhash decode is a small CPU cost per placeholder on first render; expo-image decodes natively and caches. Use a short (4×3 components) hash | none | none | none | none | none measured concern; verify feed scroll on emulator | none | none | none | Low |
| C-11 strip console in production | JS NOT MEASURED until done | improves slightly | none | none | improves: 73 call sites (some inside render paths of Shorts and Comments) no longer format strings | improves where logs were in render/scroll paths | none | none | none | improves slightly (Shorts feed logs on scroll) | none | none | none | Low |
| C-14 R8 + resource shrinking | native/DEX NOT MEASURED | improves (smaller DEX to verify/load) or none | none | none | none | none | improves slightly | **must verify**: media3 HLS/MP4 playback with shrinking on | **must verify** | none | none | none | none | Medium |
| C-19 ESLint guards, CI size check, docs | none | none | — | — | — | — | — | — | — | — | — | — | — | None |
| X-1 stub @expo/ui on Android (deferred) | −966,544 B asset, −66,571 B JS, Compose native | improves | — | none | improves slightly | none | improves | none | none | none | none | none | none | High (router internals) |
| X-3 iOS drop libdav1d | native NOT MEASURED | improves slightly on iOS | — | none | none | none | none | none | none | none | none | AVIF thumbnails would fail to decode if the backend ever serves them | none | Medium (format guarantee) |

## 2. What is explicitly protected

- Video startup and playback: no change touches `components/VideoPlayer/engine`, `platform`, or `PlayerSurface` behaviour. C-08 changes only the import path in three player UI files (`ControlButton.tsx`, `ErrorCard.tsx`, `SwipeIndicator.tsx`); the rendered component is the same `MaterialCommunityIcons` object (`IconsLazy.js` re-exports the same module the deep path resolves to).
- Buffering, seeking, fullscreen, orientation, captions, chapters, rate, looping, PiP adapter, mini-player, gestures: unchanged code paths.
- Network: no change to `httpClient.ts`, `mediaSourceResolver.ts`, or expo-video's OkHttp datasource. Removing expo-audio does not affect the audio session, which expo-video manages; `ios.infoPlist.UIBackgroundModes: ["audio"]` stays because expo-video reads it (`staysActiveInBackground` is set to false by the engine, but the entitlement is harmless and pre-existing).
- Memory: fewer native modules and fewer asset registry entries can only reduce baseline memory.

## 3. Measurement protocol (Phase 9; device parts deferred)

| Metric | Tool | Where | Runs | Accept if |
|---|---|---|---|---|
| Cold start (TotalTime) | `adb shell am start -W` on emulator (device deferred) | after each of C-04, C-08, C-09, C-11, C-14 | 10, median | ≤ baseline + noise (noise established from 10 baseline runs) |
| JS bundle load | `expo export` HBC bytes | every change | 1 | ≤ previous |
| Feed scroll | emulator frame stats (`adb shell dumpsys gfxinfo <pkg>`) while scrolling Home for 10 s | C-10, C-11 | 3 | janky frames % not worse |
| Video start (loading→playing) | `devLog` timestamps on a dev build | C-14 | 5 per source (MP4, HLS) | median not worse |
| Playback stability | 5-minute HLS and MP4 sessions, seek ×10, background/foreground ×3, rotate ×3 | C-14 | 1 each | no error state, no stall beyond buffering indicator |
| Memory | `dumpsys meminfo` at home and during HLS | C-04, C-14 | 3 | PSS not worse |

Emulator measurements are acceptable for relative comparisons within Phase 9; absolute device numbers are deferred to the later device-connected exercise the human has scoped out of this initiative.

## 4. Results actually captured (2026-09-19)

| Metric | Result | Note |
|---|---|---|
| Cold start (TotalTime) | 2903 ms, single run, R8-enabled release build on emulator `Small_Phone` | No pre-initiative release build existed to compare against (native identifiers/`eas.json` did not exist before Task 3); 10-run median deferred to a device-connected session |
| JS bundle load (HBC bytes) | Android 4,941,796 → 4,741,043 B (−4.1%); iOS 4,750,938 → 4,544,871 B (−4.3%) | Measured after every relevant change; see `size-baseline.md` §7 |
| Feed scroll frame stats | NOT MEASURED | `dumpsys gfxinfo` session not run in this session; no code path touched rendering/list virtualization, so risk is assessed as low |
| Video start / playback stability | Playback confirmed functionally correct (position advanced 0:00→0:16 on the R8 release build) but latency was not timed | `devLog` timestamp instrumentation not added; functional correctness verified via screenshot sequence, not a timing measurement |
| Memory (`dumpsys meminfo`) | NOT MEASURED | Not run in this session |
| Crash/ANR stability | Zero `ClassNotFoundException`/`NoSuchMethodError`/`FATAL EXCEPTION`/ANR across the full R8 release-build session (home, video, live, Shorts, navigation) | `adb logcat -d`, filtered; `.size-reports/r8-regression.md` |

Feed-scroll frame stats and memory profiling were not captured in this session; both are recommended before a store release, though neither is expected to regress since this initiative touched no rendering, list, or memory-management code — only imports, dependencies, build configuration, and logging.
