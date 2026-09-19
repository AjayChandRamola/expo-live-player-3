// __tests__/harness/setup.ts
// Loaded by jest.setupFilesAfterEnv for every test file. Mocks native
// modules the player touches so tests never hit a device API.

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  addOrientationChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  removeOrientationChangeListener: jest.fn(),
  OrientationLock: {
    DEFAULT: 0,
    ALL: 1,
    PORTRAIT: 2,
    PORTRAIT_UP: 3,
    PORTRAIT_DOWN: 4,
    LANDSCAPE: 5,
    LANDSCAPE_LEFT: 6,
    LANDSCAPE_RIGHT: 7,
  },
  Orientation: {
    UNKNOWN: 0,
    PORTRAIT_UP: 1,
    PORTRAIT_DOWN: 2,
    LANDSCAPE_LEFT: 3,
    LANDSCAPE_RIGHT: 4,
  },
}));

jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// Reanimated 4 delegates its worklet runtime to react-native-worklets, which
// under Jest has no native proxy ("loadUnpackers" is undefined). The package
// ships a JS-only mock; install it before Reanimated's own mock loads.
jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/lib/module/mock"),
);

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  // The shipped mock's useSharedValue returns a fresh object on every call
  // instead of persisting one across re-renders (it isn't backed by a ref),
  // unlike real Reanimated. Any hook that reads a shared value's .value
  // after a re-render triggered from inside a withTiming/withSpring callback
  // (a common pattern: mutate the shared value, then setState) would see a
  // reset value instead of the one just assigned. Wrap it with a real
  // React.useRef so identity survives re-renders, matching production.
  const React = require("react");
  return {
    ...Reanimated,
    useSharedValue: (initial: unknown) => {
      const created = Reanimated.useSharedValue(initial);
      const ref = React.useRef<unknown>(created);
      return ref.current;
    },
  };
});

// react-native-gesture-handler needs its Jest setup for GestureDetector and fireGestureHandler.
require("react-native-gesture-handler/jestSetup");
