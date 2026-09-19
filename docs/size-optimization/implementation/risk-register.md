# Risk Register

Likelihood and impact: Low / Medium / High. Every risk names its trigger (how it is detected) and its mitigation. Owner is the implementer unless a decision is needed, in which case it is the human.

| ID | Risk | Likelihood | Impact | Trigger / detection | Mitigation | Related |
|---|---|---|---|---|---|---|
| RK-01 | R8 strips media3 HLS, OkHttp datasource, or session classes; HLS fails while MP4 plays | Medium | High | Regression rows 8, 9 on the release build; `adb logcat` `ClassNotFoundException` | Expo/media3 consumer keep rules usually suffice; add the narrowest `extraProguardRules`; retain `mapping.txt`; never accept C-14 without rows 8, 9, 11, 15 | C-14 |
| RK-02 | R8 breaks `react-native-webview` JS bridge (live fallback blank) | Low | Medium | Row 11 | WebView ships keep rules; add rule if reproduced | C-14 |
| RK-03 | Resource shrinking removes a resource referenced only by reflection (splash, adaptive icon) | Low | Medium | Launch on release build shows wrong splash/icon | `shrinkResources` respects `keep.xml`; Expo template includes required keeps; verify on emulator | C-14 |
| RK-04 | Visual change of the Shorts tab icon after rasterisation (edge softness at 1×) | Medium | Low | Side-by-side screenshots at 1×/2×/3× | Human sign-off D-4; fallback keep SVG | C-09 |
| RK-05 | R7 invariant fails while Shorts import edits are uncommitted | High (expected) | Low | `invariants.test.ts` R7 during the Shorts commit | Commit the Shorts change on `main`, then run the suite; document in plan step; needs D-3 | C-08 |
| RK-06 | Deep import path differs in behaviour from barrel (font loading) | Very low | Medium | Icons render as boxes | Both resolve to the same module (`build/MaterialCommunityIcons.js`); `icon-symbol.tsx` already uses the deep form for MaterialIcons; verified in `IconsLazy.js` | C-08 |
| RK-07 | Console stripping removes a log the team relied on in production | Low | Low | Missing production `info` output | `error`/`warn` kept by configuration; Logger gating mirrors it; documented in observability section | C-11 |
| RK-08 | Babel `env.production` not applied because of `api.cache(true)` | Medium | Low | Transform test with `envName` and production export grep | Use `api.cache.using(() => process.env.NODE_ENV)` | C-11 |
| RK-09 | Native size benefit is smaller than expected or unmeasurable if no Android build can be produced (missing identifiers, Gradle failure on Windows) | Medium | Medium | Phase 0 C-03b fails | Use `eas build --local` or cloud as alternative (D-2); if still blocked, report Android native metrics as NOT MEASURED and still ship JS/asset wins | C-03b, C-14 |
| RK-10 | Identifier choice (D-1) is wrong and later must change after publishing | Low | High | — | Human chooses reverse-DNS identifiers deliberately; note they are permanent once on a store | C-03 |
| RK-11 | Removing a package that a future planned feature needed (for example expo-web-browser for OAuth) | Low | Low | Feature work re-adds it | Re-adding with `npx expo install` is a one-line change; the dependency audit records why each was removed | C-04, C-05 |
| RK-12 | `expo-symbols` removal attempted by mistake (it is imported by `icon-symbol.ios.tsx`) | Low | Medium | iOS tab icons crash | Audit marks it Keep; guard test list excludes it | — |
| RK-13 | Jest harness fix hides a real behavioural difference of the worklets mock | Low | Medium | Player suites pass but emulator behaviour differs | The harness already wraps `useSharedValue`; emulator regression covers gestures/animations | C-01 |
| RK-14 | TypeScript version decision (D-9) changes error counts and confuses the gate | Medium | Low | Runtime-source error count changes without code change | Record the count immediately after C-06 as the new baseline; keep the gate relative | C-06 |
| RK-15 | `@expo/ui` / Material Symbols remains on Android; stakeholders expect it gone | Medium | Low | Size report shows 3 TTFs on Android | Documented as router-owned (DL-08); revisit on router upgrade; X-1 available with high risk | — |
| RK-16 | Web target breaks due to PNG icon or removed SVG mapper | Low | Low | `npm run test:web`, `expo export --platform web` | Both run in the plan after C-09 | C-09 |
| RK-17 | Deleting tracked artefacts (zip, html) removes something the human wanted | Low | Low | — | D-7 asks first; Markdown twin of the zip exists in `docs/history` | C-07 |
| RK-18 | Emulator-only regression misses device-specific playback issues (codec, PiP, orientation) | Medium | Medium | Later device exercise | Explicitly deferred by instruction; recorded as unverified in the final report | Phase 8/9 |
