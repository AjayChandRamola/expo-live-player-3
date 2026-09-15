
# React Native & Expo Rules

## 1. Project & Platform
- Use the existing React Native + Expo Managed Workflow.
- Follow actual package.json versions, app configuration, and existing Expo Router conventions.
- Verify package compatibility before installation or upgrades.
- Do not eject, migrate frameworks, or add native modules without approval.
- Do not replace existing libraries without an approved migration plan.
- Do not introduce a state-management library without justification.

## 2. Components & TypeScript
- Search existing components, hooks, and utilities before creating new ones.
- Use strict TypeScript, meaningful names, and stable list keys.
- Reuse existing components and design tokens; avoid duplicate UI logic.
- Keep screens focused; separate UI, domain logic, and data access.
- Keep navigation and platform-specific code separate from business logic.

## 3. Rendering & Lists
- Use FlatList or other virtualized lists for large collections.
- Avoid unnecessary re-renders, expensive effects, and render-time work.
- Keep expensive computation out of render paths.
- Use stable keys, appropriate memoization, and efficient state updates.
- Avoid unnecessary component nesting and large render trees.

## 4. State & Lifecycle
- Keep component, navigation, and global state ownership explicit.
- Avoid duplicated state and conflicting sources of truth.
- Clean up subscriptions, timers, listeners, animations, and media resources.
- Handle loading, empty, error, success, and offline states.
- Handle screen focus, unmount, background, foreground, and state restoration where relevant.
- Avoid unsafe effects, stale closures, and state updates after unmount.

## 5. UI & Device Behavior
- Support responsive layouts, safe areas, keyboard behavior, and accessibility.
- Support relevant Android and iOS platform differences.
- Handle screen dimensions, orientation, system UI, and device insets correctly.
- Use platform APIs and permissions only when required.
- Preserve consistent behavior across supported device sizes.

## 6. Native & Configuration
- Keep app configuration, environment settings, and platform-specific behavior consistent.
- Verify native dependency requirements before changing packages or configuration.
- Do not modify native configuration or permissions without justification and approval.
- Keep Expo SDK, React Native, and related package versions compatible.
- Do not use unsupported APIs or assume native capabilities exist.

## 7. Verification & Changes
- Test navigation, Android, iOS, and relevant device dimensions.
- Verify behavior on representative physical devices where applicable.
- Review changed files and configuration before completion.
- Do not change the framework, architecture, or libraries without documenting reason, impact, and migration plan.
- Prefer small, incremental, reviewable changes.