// __tests__/constants/tokens.test.ts
import { tokens, getColors } from "../../constants/tokens";

describe("design tokens", () => {
  it("exposes a light and a dark palette with identical keys", () => {
    const light = Object.keys(getColors("light")).sort();
    const dark = Object.keys(getColors("dark")).sort();
    expect(light).toEqual(dark);
  });

  it("defines every semantic colour role the UI needs", () => {
    const required = [
      "primary",
      "onPrimary",
      "background",
      "surface",
      "surfaceElevated",
      "text",
      "textMuted",
      "border",
      "overlay",
      "live",
      "success",
      "danger",
      "skeleton",
    ];
    const light = getColors("light") as unknown as Record<string, string>;
    for (const role of required) {
      expect(light).toHaveProperty(role);
      expect(typeof light[role]).toBe("string");
    }
  });

  it("uses a 4-point spacing scale in ascending order", () => {
    const values = [
      tokens.spacing.xs,
      tokens.spacing.sm,
      tokens.spacing.md,
      tokens.spacing.lg,
      tokens.spacing.xl,
      tokens.spacing.xxl,
    ];
    expect(values).toEqual([4, 8, 12, 16, 24, 32]);
    for (const v of values) {
      expect(v % 4).toBe(0);
    }
  });

  it("defines four type sizes in ascending order", () => {
    const { caption, body, heading, title } = tokens.typography;
    expect(caption.fontSize).toBeLessThan(body.fontSize);
    expect(body.fontSize).toBeLessThan(heading.fontSize);
    expect(heading.fontSize).toBeLessThan(title.fontSize);
  });

  it("keeps every touch target at or above the 44 point minimum", () => {
    expect(tokens.touchTarget.min).toBeGreaterThanOrEqual(44);
  });
});
