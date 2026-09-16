# ADR 0005 — Full web parity through platform adapters

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 (human decision in brainstorming Question 2) |
| Spec | section 7 |

## Context

The human chose full web parity over mobile-only or "must not crash on web". Today web-specific code lives inline in `index.tsx` (`document as any`, vendor-prefixed fullscreen calls, `window.addEventListener("keydown")`) with no types and no tests. `react-native-web ~0.21.0` and the `npm run web` script are present.

## Decision

Every device capability is accessed through an interface in `components/VideoPlayer/platform/types.ts` with two implementations selected by Metro platform extensions: `<name>.native.ts` and `<name>.web.ts`. Adapters: fullscreen, orientation, system chrome, keyboard, picture-in-picture, brightness, haptics. No code above the adapter layer reads `Platform.OS` or `Platform.select` (invariant R4). Web implementations use `lib.dom` types with no `as any`; vendor-prefixed fullscreen APIs are not supported (modern browsers only).

Web-specific behaviours (keyboard shortcuts, hover to reveal controls, focus ring) are driven by the same commands and visibility hook the native player uses.

## Alternatives considered

1. **Mobile only, delete web code.** Rejected by the human.
2. **Guard native calls but no web features.** Rejected by the human.
3. **`Platform.select` inline in each control.** Rejected: spreads branching across the tree and defeats testing.

## Consequences

- Positive: platform branching is confined to one folder; each adapter is unit-tested on both configs; controls are platform-agnostic.
- Negative: a second Jest config (`jest.web.config.js`, jsdom) and a `test:web` script are needed; web joins the manual matrix (Chrome and Safari).

## Verification

- Invariant R4 passes.
- `npm run test:web` runs the `platform/*.web.ts` tests green.
