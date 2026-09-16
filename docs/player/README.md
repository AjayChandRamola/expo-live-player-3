# Video Player Redesign — Documentation Index

Start with the spec, then read the document for the area you are implementing. Every document is self-contained and cross-references the others by file name and section.

| Order | Document | Read when |
|---|---|---|
| 0 | `../superpowers/specs/2026-09-16-video-player-redesign-design.md` | Always first. Approved design, decisions, contracts. |
| 1 | `01-current-player-issue-register.md` | You need to know what is wrong today and where it is fixed. |
| 2 | `02-feature-catalog.md` | You are implementing or testing a feature (F1–F38): acceptance criteria and states. |
| 3 | `03-architecture.md` | You are creating or moving a file: layers, rules R1–R9, module cards, composition root wiring. |
| 4 | `04-playback-engine-spec.md` | You are working under `engine/`: transition table, rules E1–E13, sequences, fake player. |
| 5 | `05-platform-adapters-spec.md` | You are working under `platform/`: interfaces, native and web behaviour, keyboard map. |
| 6 | `06-ui-and-gestures-spec.md` | You are working under `ui/`, `gestures/`, `hooks/`: layout, controls, visibility rules, tokens, constants. |
| 7 | `07-app-actions-and-repositories.md` | You are working under `components/Video/actions/` or `services/videoActions/`. |
| 8 | `08-reliability-and-performance.md` | You are writing lifecycle tests or measuring performance. |
| 9 | `09-test-plan.md` | You are writing any test: inventory, fixtures, Jest configs, manual matrix. |
| 10 | `10-migration-and-swap.md` | You are starting an increment, doing the swap, or cleaning up. |
| ADR | `adr/0001` … `adr/0012` | You need the reason behind a decision. Do not re-open accepted ADRs; propose a new ADR instead. |
| Plans | `../superpowers/plans/2026-09-16-video-player-0*.md` | Step-by-step implementation tasks per increment (written after this set). |

## Ground rules for implementers

1. Read the spec section and the document section named in your task before writing code.
2. Write the failing test named in `09-test-plan.md` first.
3. Use the constant names from `06-ui-and-gestures-spec.md` §7 and `04-playback-engine-spec.md` §7. Never type the number.
4. Do not touch `components/VideoPlayer/index.tsx` or anything under `components/Shorts/` unless your task says so explicitly.
5. If the code and a document disagree, stop and report; do not pick one silently.
6. Report measured values, not estimates. "Not measured" is an acceptable answer; a guess is not.
