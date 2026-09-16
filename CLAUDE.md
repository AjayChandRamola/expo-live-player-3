# CLAUDE.md — Yagna App Engineering Rules

## 0. Implementation Instructions
- Use the plugin Superpowers - Inline implementation approach.
- Do NOT use subagent-driven development Superpowers plugin approach. Do NOT spawn subagents for implementation, review, or testing. Execute all tasks directly in the current Claude Code session to minimize cost and maintain context.

## 1. Project Context
- Product: Yagna/Yagya spiritual video and community mobile app.
- Location: `D:\expo-live-player`
- Stack: React Native, Expo Managed Workflow (SDK 54), Expo Router v6, TypeScript 5.9 (strict mode).
- Expo SDK: 54.0.22; Node.js: 26.8.2; playback via `expo-video` ~3.0.11.
- Existing `VideoPlayer` (`components/VideoPlayer/`) is working and is the authoritative playback implementation. It is composed of many focused files (`index.tsx`, `Controls.tsx`, `hooks/useVideoPlayer.ts`, `modals/`, `tokens.ts`, `styles.ts`, `types.ts`, `utils.ts`, etc.) — do not collapse this into a single file.
- Shared playback state lives in `contexts/VideoPlayerContext.tsx`; content/domain data is served via `services/` (`videoService.ts`, `videoActionsService.ts`, `commentsService.ts`, `shortsSearchService.ts`).
- Shorts playback uses a separate component, `components/Shorts/ShortVideoPlayer.tsx`, per the "Shorts remains separate" rule below.
- Screens live under Expo Router's `app/` directory (`app/(tabs)/`, `app/video/[id].tsx`, `app/modal.tsx`).
- Do not eject Expo or add native code without explicit approval.

## 2. Source of Truth
Before making changes, inspect:
1. Existing source code and consumers.
2. Existing player structure and APIs.
3. Relevant requirements and acceptance criteria.
4. Existing services, hooks, contexts, navigation, and design tokens.
5. Git status and recent changes.

Never guess existing behavior, APIs, dependencies, or scripts.

### 2.1 Supplementary Docs (`docs/`)
This CLAUDE.md is the condensed, always-loaded ruleset. `docs/` holds the detailed, topic-specific versions of the same rules plus reference material — consult the relevant file **on a requirement basis** (i.e. when a task touches that topic), rather than loading all of them for every task. If a `docs/` file and this CLAUDE.md conflict, treat it as a signal to flag the conflict to the user rather than silently picking one.

- `docs/engineering/coding.md` — full coding & architecture rules (KISS/DRY/SOLID/YAGNU, reuse, structure). Consult for any code change.
- `docs/engineering/FunctionalRules.md` — functional/requirements engineering rules (user outcomes, acceptance criteria, states). Consult when implementing or scoping a feature.
- `docs/engineering/performance.md` — performance rules (measurement, optimization, buffering, resource bounds). Consult for anything performance-sensitive, especially playback.
- `docs/engineering/react-native.md` — React Native/Expo platform rules (lists, lifecycle, safe areas, versions). Consult for RN/Expo-specific implementation.
- `docs/engineering/security.md` — security rules (secrets, TLS, trust boundaries, storage). Consult for anything touching auth, network, storage, or user input.
- `docs/engineering/testing.md` — testing & QA rules (coverage, planning, regression). Consult when writing or scoping tests.
- `docs/engineering/video-player.md` — VideoPlayer-specific protected-module rules. Consult before **any** change touching `components/VideoPlayer/`, `contexts/VideoPlayerContext.tsx`, or `components/Shorts/`.
- `docs/reference/Project-structure-of-expo-live-player.md` — actual file/folder map of the codebase. Consult before navigating or adding files, to place new code correctly.
- `docs/reference/expo-live-player-architecture-issue.md` — known architecture issues/findings intended to inform redesign decisions. Consult during HLD/LLD or refactoring work.
- `docs/reference/prompt.md` — the original Fable HLD prompt/brief for the Yagna mobile app. Consult for product intent and scope during HLD-stage work.

## 3. AI Development Workflow
- **Fable:** Product understanding, HLD, information architecture, MVP scope.
- **Opus:** HLD refinement, source inspection, LLD, implementation plan.
- **GLM 5.3 or Sonnet:** Implement only approved LLD/tasks.
- **Human:** Approves architecture, scope, risky changes, and final result.
- Do not code during HLD-only work.
- Do not implement an LLD that has not been approved.
- Challenge unnecessary complexity and preserve the smallest sensible architecture.

## 4. Engineering Principles
- Follow KISS, DRY, SOLID, YAGNI, and least-privilege principles.
- Prefer simple, readable, maintainable code.
- Search before creating components, hooks, utilities, services, types, or contexts.
- Reuse existing code where appropriate.
- Avoid giant files, circular dependencies, deep nesting, hidden side effects, and duplicate state.
- Use strict TypeScript.
- Avoid `any`, `@ts-ignore`, `@ts-nocheck`, dead code, unused imports, and magic values.
- Use meaningful names and centralized constants/tokens.
- Keep UI, domain logic, data access, infrastructure, and navigation separated.
- Preserve public APIs and backward compatibility.
- Avoid unrelated refactoring.
- Make small, reviewable, incremental changes.

## 5. Product Architecture
- Keep catalog/content state separate from playback state.
- Keep player mechanics separate from app/domain actions.
- Define clear ownership for:
  - Play, pause, seek, mute, buffering, fullscreen: player layer.
  - Save/download: persistence/content layer.
  - Like/comments: backend/social layer.
  - Thanks/donation: payment/service layer.
  - Navigation: screen/navigation layer.
- Avoid putting the complete app data layer inside `VideoPlayerContext`.
- Use contexts only for shared state that genuinely requires them.
- Prevent duplicated sources of truth and conflicting state ownership.
- Document architectural decisions and alternatives when needed.
- u can Challenge all/any suggestion.

## 6. Existing VideoPlayer Rules
- Do not rewrite, replace, duplicate, or create a second generic video player.
- Inspect the existing player before modifying it.
- Preserve:
  - MP4 and HLS playback.
  - Play/pause, seek, mute, buffering, loading, and errors.
  - Fullscreen and orientation handling.
  - Captions, chapters, looping, autoplay, playback rate, and controls.
  - Next/previous, minimize, action bar, and existing callbacks.
- Existing structure includes player components, hooks, controls, actions, modals, tokens, styles, utilities, context, video screen, feed, and Shorts.
- Treat these as separate responsibilities; do not force everything into one file.
- Do not assume UI presence means production readiness.
- Verify Download, PiP, quality selection, Like, Save, Share, Thanks, and backend persistence before claiming completion.
- Shorts must remain a separate experience unless explicitly approved.
- Keep demo catalog/direct URLs clearly separated from production content services.

## 7. Playback Reliability
Handle and test:
- Missing, malformed, expired, or unsupported media URLs.
- MP4/HLS source changes.
- VOD, live, ended, and replay states.
- Slow network, offline mode, timeout, buffering, and retry.
- Player unmount, screen navigation, background/foreground, and orientation changes.
- Stale callbacks, race conditions, cancellation, and concurrent actions.
- Resource cleanup for media, timers, listeners, animations, and subscriptions.
- Never leave playback resources or event listeners active after unmount.

## 8. Functional Requirements
For every feature:
- Understand the user goal, flow, business rules, and acceptance criteria.
- Map preconditions, actions, outcomes, and ownership.
- Implement loading, success, empty, invalid, failure, offline, retry, and cancellation states.
- Validate user input and untrusted data.
- Prevent duplicate submissions and unsafe repeated actions.
- Handle stale responses and concurrent requests deterministically.
- Preserve user state during navigation, refresh, retry, and recovery.
- Keep business logic deterministic and testable outside UI.
- Do not add unrequested behavior, placeholders, or hidden side effects.
- Update documentation when behavior or architecture changes.

## 9. Security
- Never hardcode, commit, expose, or log secrets, tokens, credentials, or auth headers.
- Use HTTPS; never bypass TLS validation.
- Treat URLs, media, API responses, deep links, WebViews, and user input as untrusted.
- Validate trust boundaries and enforce authorization server-side.
- Use secure credential storage and safe logout/session-expiry handling.
- Prevent injection, open redirects, path traversal, unsafe WebViews, and dynamic code execution.
- Minimize collection and exposure of personal data.
- Use safe, non-sensitive error messages.
- Review dependency permissions and vulnerabilities.
- Never weaken security to make a test or feature pass.

## 10. React Native and Expo
- Follow installed Expo/RN/Router versions and existing conventions.
- Check compatibility before adding or upgrading dependencies.
- Do not replace libraries without an approved migration plan.
- Use stable list keys and virtualization for large lists.
- Respect safe areas, keyboard behavior, orientation, accessibility, and device dimensions.
- Handle focus, unmount, background, foreground, and navigation lifecycle.
- Avoid unnecessary effects, renders, stale closures, and duplicated state.
- Use existing components, styles, and design tokens.
- Support Android and iOS behavior where applicable.

## 11. Performance
- Measure before optimizing and record the baseline when relevant.
- Avoid unnecessary renders, requests, parsing, memory use, and large payloads.
- Use pagination, caching, image optimization, and request deduplication.
- Keep expensive work out of render and the JS thread.
- Memoize only when measurement justifies it.
- Bound caches, retries, lists, and background work.
- Optimize video buffering, source lifecycle, startup, battery, and mobile data usage.
- Profile on realistic devices and networks.
- Do not claim performance improvements without evidence.

## 12. Testing and Quality Gate
Verified project scripts (from `package.json`): `npm test` (Jest), `npm run lint` (ESLint over `.js/.jsx/.ts/.tsx`), `npm start`/`android`/`ios`/`web` (Expo dev server), `npm run prebuild` (`expo prebuild --clean`). Do not invent other script names.

Test from requirements, acceptance criteria, and risk:
- Happy path and regression paths.
- Loading, empty, invalid, error, offline, timeout, and retry.
- Boundary values, malformed responses, cancellation, concurrency, and duplicates.
- Navigation, repeated actions, unmount, state restoration, and orientation.
- Playback with real MP4/HLS/live sources where applicable.
- Android and iOS behavior where applicable.
- Security and input validation.
- Run only verified project scripts; never invent commands or results.
- Add regression tests for fixed defects.
- Report failures, limitations, and unverified areas honestly.
- Completion requires implementation, verification, documentation, and review evidence.

## 13. Definition of Done
A task is complete only when:
- Requirements and acceptance criteria are satisfied.
- Existing functionality remains intact.
- Security, performance, and lifecycle concerns are addressed.
- Relevant tests/checks were actually run.
- Documentation/ADRs are updated when needed.
- Known limitations and unverified items are clearly reported.