// __tests__/navigation/tabLayout.test.tsx
// Verifies the tab set is exactly the four the MVP defines, in order.
// Expo Router builds routes from the filesystem, so this test asserts on
// the filesystem rather than rendering the router.
import fs from "fs";
import path from "path";

const TABS_DIR = path.join(__dirname, "..", "..", "app", "(tabs)");
const APP_DIR = path.join(__dirname, "..", "..", "app");

describe("route structure", () => {
  it("has exactly four tab screens", () => {
    const screens = fs
      .readdirSync(TABS_DIR)
      .filter((f) => f.endsWith(".tsx") && !f.startsWith("_"))
      .map((f) => f.replace(".tsx", ""))
      .sort();
    expect(screens).toEqual(["index", "live", "saved", "shorts"]);
  });

  it("does not keep the template explore or modal routes", () => {
    expect(fs.existsSync(path.join(TABS_DIR, "explore.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(APP_DIR, "modal.tsx"))).toBe(false);
  });

  it("exposes settings as a stack screen, not a tab", () => {
    expect(fs.existsSync(path.join(APP_DIR, "settings.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(TABS_DIR, "settings.tsx"))).toBe(false);
  });

  it("keeps the dynamic video route", () => {
    expect(fs.existsSync(path.join(APP_DIR, "video", "[id].tsx"))).toBe(true);
  });
});
