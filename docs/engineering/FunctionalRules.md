
# Functional Engineering Rules

## 1. Requirements & User Outcomes
- Understand the requirement, user goal, user journey, and acceptance criteria before coding.
- Define preconditions, postconditions, measurable outcomes, and edge cases.
- Map every requirement to expected behavior and verifiable acceptance criteria.

## 2. Existing Behavior & Compatibility
- Inspect existing flows, APIs, components, and business rules before modifying code.
- Preserve existing functionality, public APIs, and backward compatibility unless explicitly approved.
- Do not introduce unrequested features, placeholders, or behavior changes.

## 3. Business Logic & State
- Enforce business rules consistently across all entry points.
- Keep business logic deterministic, testable, and separate from UI.
- Define clear ownership for data, state, navigation, persistence, actions, and side effects.
- Avoid duplicated state, hidden side effects, and conflicting state transitions.

## 4. Complete & Reliable Behavior
- Handle success, loading, empty, invalid, failure, offline, and retry states.
- Handle duplicate actions, concurrent requests, stale data, cancellation, and timeouts where applicable.
- Ensure retry-safe behavior and prevent unintended duplicate operations or transactions.
- Preserve user data and state across reloads, restarts, and interruptions where required.

## 5. Validation & Error Recovery
- Validate inputs and enforce business rules at the correct boundary.
- Provide clear, actionable errors and safe recovery paths.
- Do not silently ignore failures or hide incomplete functionality.

## 6. Verification & Completion
- Test happy paths, edge cases, repeated actions, and regressions.
- Verify end-to-end behavior against acceptance criteria before declaring completion.
- Do not claim functionality is complete without evidence.
- Update acceptance criteria and documentation when behavior changes.