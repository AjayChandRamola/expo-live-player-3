// __tests__/scripts/dependencyGuards.test.ts
// Packages removed by the 2026-09 size initiative must not be re-added
// silently. See docs/size-optimization/optimization/dependency-audit.md.
import fs from "fs";
import path from "path";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

const FORBIDDEN_DEPENDENCIES = [
  "expo-audio",
  "expo-linear-gradient",
  "expo-web-browser",
  "@react-native-community/slider",
  "react-native-paper",
  "react-native-calendars",
  "react-native-collapsible",
  "ajv",
  "@expo-google-fonts/mukta",
  "@expo-google-fonts/noto-sans-devanagari",
  "@expo-google-fonts/roboto",
];

describe("dependency guards", () => {
  it.each(FORBIDDEN_DEPENDENCIES)("%s is not a dependency", (name) => {
    expect(pkg.dependencies[name]).toBeUndefined();
    expect(pkg.devDependencies[name]).toBeUndefined();
  });
});
