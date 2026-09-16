
# Testing & QA Rules

## 1. Test Planning & Coverage
- Derive tests from requirements, acceptance criteria, user journeys, and risk.
- Define expected results, test data, and coverage for critical behavior.
- Prioritize testing by business impact, security risk, and change scope.
- Cover happy paths, edge cases, invalid input, empty, loading, error, offline, and retry states.

## 2. Test Execution
- Run actual project scripts; never invent commands or results.
- Run relevant type checks, lint, unit tests, integration tests, end-to-end tests, and builds.
- Use the project's existing test framework and configuration.
- Test navigation, repeated actions, unmount, state restoration, and lifecycle behavior where relevant.
- Test Android and iOS behavior, supported device dimensions, and platform-specific behavior where applicable.

## 3. Test Quality & Reliability
- Keep tests deterministic, isolated, repeatable, and independent of execution order.
- Avoid unnecessary mocks; verify real integration behavior at important boundaries.
- Cover boundary values, malformed responses, timeouts, cancellations, concurrent actions, and duplicate requests where applicable.
- Identify and fix flaky tests; never ignore intermittent failures.
- Use controlled, representative test data; protect sensitive data in test environments.

## 4. Security & Regression
- Test security-sensitive paths, authentication, authorization, and data validation.
- Add regression tests for important defects and previously broken behavior.
- Verify API contracts, error handling, and backward compatibility where relevant.
- Review changed files and git diff before completion.

## 5. Defect Handling & Reporting
- Fix root causes; do not suppress errors, weaken assertions, or bypass validation to pass tests.
- Report failures, skipped checks, limitations, and environment issues honestly.
- Do not claim tests passed if they were not run.
- Do not claim coverage, quality, or release readiness without evidence.

## 6. Completion & Release
- Verify end-to-end behavior against acceptance criteria before completion.
- Run relevant regression checks after changes and before release.
- Confirm build artifacts and critical user journeys work in the target environment.
- Definition of Done requires validated behavior, documented limitations, and no unresolved critical defects.