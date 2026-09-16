# ADR 0012 — Proposed performance targets, pending human confirmation

| Field | Value |
|---|---|
| Status | Proposed 2026-09-16 (human deferred brainstorming Question 4) |
| Spec | section 8.2, `docs/player/08-reliability-and-performance.md` |

## Context

"Lean, fast and robust on any mobile" needs measurable targets or implementers cannot verify it. The human deferred the device baseline decision.

## Decision (provisional)

Until the human confirms or changes them, implementers measure against these targets on these reference devices:

- Reference devices: low-end Android (2 GB RAM, Android 10 class; for example Redmi 9A or Galaxy A03), iPhone SE 2nd generation, Chrome and Safari current stable.
- Targets: P1 MP4 time to first frame ≤ 2,000 ms on 4G; P2 HLS ≤ 3,000 ms; P3 tap-to-command ≤ 100 ms; P4 ≤ 4 composition-root renders per second while playing with controls hidden; P5 ≤ 30 MB memory growth after 10 source changes; P6 zero timers or listeners after unmount; P7 controls fade with JS FPS ≥ 55; P8 player bundle contribution ≥ 40 percent smaller than today; P9 battery no worse than today (informational).

Baselines for the current player are recorded in Increment 0 before any new code exists, so the "smaller than today" and "no worse than today" targets have a number to compare against.

## Alternatives considered

1. **Mid-range baseline (4 GB, Android 12, iPhone 11).** Available if the human prefers; the categories stay, the numbers loosen.
2. **No targets.** Rejected: violates the performance rules ("do not claim improvements without evidence").

## Consequences

- Implementers report measured values in each increment's verification report, next to the target, and mark misses honestly.
- When the human answers, this ADR is updated to Accepted with the final numbers; no other document needs to change because they all reference this ADR by id.

## Verification

- Each increment's report contains the P1–P9 table with measured values or "not measured" and the reason.
