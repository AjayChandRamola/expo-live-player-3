# App Size Optimization — Documentation Index

| Field | Value |
|---|---|
| Date | 2026-09-19 |
| Status | Discovery and design complete; awaiting human review before implementation |
| Branch | `main` (no feature branch, per standing instruction) |
| Stack (verified from `package.json` and `node_modules`) | Expo SDK 57.0.23, React Native 0.86.3, React 19.2.3, expo-router 57.0.21, expo-video 57.0.4, react-native-reanimated 4.5.1, react-native-worklets 0.10.1, Hermes (default), New Architecture (only option on RN 0.86), Node 26.8.2, npm 11.19.1 |
| Audience | The human approver, and an implementing agent (possibly a smaller model) that must not need to rediscover the repository |

## Note on a stale rule

`CLAUDE.md` section 1 still says "Expo SDK 54.0.22 ... expo-video ~3.0.11". The repository was upgraded to SDK 57 in commits `9a7fdd3`, `128aab8`, `8f305e2` (merged as `b3fb438`). Every number in this package was re-measured against SDK 57. `CLAUDE.md` should be corrected as part of Phase 10; it is flagged here rather than silently edited.

## Reading order

| Order | Document | Purpose |
|---|---|---|
| 0 | `../superpowers/specs/2026-09-19-app-size-optimization-design.md` | The design specification (SPEC). Decisions, approaches considered, open items for the human. Read first. |
| 1 | `optimization/size-baseline.md` | What was measured, how, and what could not be measured. Every later number traces here. |
| 2 | `optimization/dependency-audit.md` | Every dependency classified with import counts, native footprint, and disposition. |
| 3 | `optimization/asset-audit.md` | Every packaged asset (repository and bundle) with size, origin, and disposition. |
| 4 | `optimization/size-budget.md` | Size budget by category with a prioritisation matrix. |
| 5 | `architecture/HLD.md` | Full high-level design (38 sections). |
| 6 | `architecture/architecture-diagrams.md` | Mermaid diagrams: current and target dependency graphs, build pipeline, asset flow. |
| 7 | `architecture/dependency-architecture.md` | Current and target dependency graph including transitive and native chains. |
| 8 | `architecture/build-architecture.md` | Current and target build pipeline (Metro, Hermes, prebuild, Gradle, EAS). |
| 9 | `architecture/video-architecture.md` | Player and Shorts architecture as they relate to size; what must not change. |
| 10 | `optimization/bundle-optimization.md` | JavaScript bundle findings and concrete recommendations. |
| 11 | `optimization/android-optimization.md` | APK/AAB/ABI/R8/resource shrinking, and the meaning of each size figure. |
| 12 | `optimization/performance-impact.md` | Performance regression matrix for every optimisation. |
| 13 | `architecture/LLD.md` | Change catalogue C-01 to C-19: exact files, current state, desired state, steps, tests, rollback. |
| 14 | `../superpowers/plans/2026-09-19-app-size-optimization-plan.md` | Phased, task-by-task implementation plan derived from the LLD. |
| 15 | `implementation/regression-matrix.md` | Feature preservation matrix. |
| 16 | `implementation/acceptance-criteria.md` | Per-phase and overall acceptance criteria. |
| 17 | `implementation/risk-register.md` | Risks with triggers and mitigations. |
| 18 | `implementation/rollback-plan.md` | How to undo each change independently. |
| 19 | `optimization/optimization-decision-log.md` | Dated decisions, alternatives, and the evidence behind them. |
| 20 | `implementation/implementation-readiness-review.md` | What is known, what needs measuring, what must not change, order of work. |

## Conventions used in every document

- **Measured** means a number produced by a command run in this repository on 2026-09-19 and recorded with the command. **NOT MEASURED** means exactly that, and the document says how to measure it.
- Sizes are bytes unless a unit is written. "Raw" means bytes on disk before any APK/AAB/App Store compression.
- Change identifiers `C-nn` are defined once in `architecture/LLD.md` and referenced everywhere else. Decision identifiers `D-nn` are open items for the human, defined in the SPEC. Experiment identifiers `X-nn` are gated A/B experiments defined in the SPEC.
- File paths are relative to the repository root `D:\expo-live-player`.
- Nothing in this package was implemented. The only files added by the discovery phase are the documents listed above; no source, configuration, or dependency was changed.
