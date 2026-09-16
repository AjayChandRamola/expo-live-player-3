# ADR 0007 — Backend-agnostic repository for app actions

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | section 5.3, `docs/player/07-app-actions-and-repositories.md` |

## Context

`services/videoActionsService.ts` is an in-memory mock with `simulateNetworkDelay` (line 82) and `mockVideoState` (line 110). State is lost on restart. The human wants Like, Dislike, Save, Share, Download, Clip, Report, Not interested, Thanks working now and a backend later. The backend platform is unknown (AWS, Azure, or other).

## Decision

Define `VideoActionsRepository` as a TypeScript interface in `services/videoActions/VideoActionsRepository.ts`. Ship one implementation, `localVideoActionsRepository`, backed by the existing `services/storage/asyncStorageAdapter.ts` under key `STORAGE_KEYS.videoActions` (`"yagna.videoActions.v1"`). A later backend implementation is a new file implementing the same interface; `components/Video/actions/useVideoActions.ts` receives the repository through a small provider (`VideoActionsProvider`) so the swap is a one-line change in `app/_layout.tsx`.

Rules every implementation must follow: idempotent writes (setting like to its current value is a no-op), errors surfaced as `AppError`, no personal data in logs, sequence-numbered responses so a stale reply cannot overwrite a newer optimistic state.

## Alternatives considered

1. **Keep the mock until a backend exists.** Rejected: state loss on restart makes the feature unusable; the mock's header falsely says "production-ready".
2. **Pick a backend now (for example Supabase) to have real persistence.** Rejected: the human has not chosen a platform; a new dependency and account would be premature.
3. **Persist inside `SavedContext`.** Rejected: mixes saved-list ownership with like/report state; `SavedContext` keeps Save only.

## Consequences

- Positive: real persistence today; clean seam for any backend; the interface doubles as the backend API contract.
- Negative: like counts are local-only until a backend exists; the UI shows counts only when the repository returns them (`counts: null` for local).

## Verification

- `__tests__/services/videoActions/localVideoActionsRepository.test.ts`: round-trip, idempotency, corrupt payload reset to defaults.
- `__tests__/components/actions/useVideoActions.test.tsx`: optimistic update, rollback, in-flight guard, stale response ignored.
