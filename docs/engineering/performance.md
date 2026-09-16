
# Performance Engineering Rules

## 1. Measurement & Optimization
- Measure before optimizing; record relevant baselines.
- Define measurable performance targets for critical user journeys.
- Profile actual bottlenecks before choosing optimizations.
- Do not claim performance improvements without measurable evidence.

## 2. Rendering & Computation
- Avoid unnecessary renders, expensive computations, and render-time work.
- Keep expensive computation out of render paths.
- Avoid blocking the JavaScript thread.
- Use FlatList or virtualized lists for large collections.
- Memoize only when measurement or component behavior justifies it.
- Avoid unnecessary state updates, re-renders, and deep component trees.

## 3. Network, Data & Assets
- Avoid unnecessary network requests and large in-memory datasets.
- Use pagination, caching, and efficient image loading where appropriate.
- Prevent duplicate requests and uncontrolled data fetching.
- Optimize payload sizes, parsing, serialization, and response handling.
- Avoid loading large assets or data before they are needed.

## 4. Memory, Lifecycle & Resources
- Clean up timers, listeners, subscriptions, animations, and media resources.
- Prevent memory leaks, unbounded caches, and unnecessary object retention.
- Release resources when screens, components, or media sessions are no longer needed.
- Avoid unnecessary dependencies and excessive native or JavaScript resources.

## 5. Video & Mobile Performance
- Optimize video buffering, source handling, and lifecycle carefully.
- Consider startup time, battery, bandwidth, and mobile data usage.
- Avoid unnecessary video downloads, buffering, and playback interruptions.
- Handle background, foreground, unmount, and orientation transitions efficiently.
- Verify performance on representative low-end and high-end devices.

## 6. Performance Verification
- Test critical flows under realistic network, device, and data conditions.
- Measure startup time, render responsiveness, memory usage, and resource consumption where relevant.
- Compare results against the baseline and defined performance targets.
- Avoid premature optimization; prioritize measurable user impact.