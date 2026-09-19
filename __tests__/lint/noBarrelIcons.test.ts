// __tests__/lint/noBarrelIcons.test.ts
// Importing from the @expo/vector-icons barrel bundles all 15 icon fonts
// (4 MB). The ESLint rule below must reject it and accept the deep path.
//
// This uses the `eslint` CLI as a subprocess rather than the `ESLint` class
// API: ESLint's flat-config loader uses a dynamic `import()` to read
// eslint.config.js, which requires `--experimental-vm-modules` when called
// from inside Jest's CommonJS environment. The CLI spawns its own Node
// process and is unaffected by Jest's module system.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const FIXTURE = path.join(ROOT, "components", "ui", "__eslint_fixture__.tsx");

function lint(code: string): string[] {
  fs.writeFileSync(FIXTURE, code);
  try {
    const out = execFileSync(
      "npx",
      ["eslint", FIXTURE, "--format", "json"],
      { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" },
    );
    const [result] = JSON.parse(out) as Array<{ messages: Array<{ ruleId: string | null }> }>;
    return result.messages.map((m) => m.ruleId ?? "");
  } catch (e) {
    const err = e as { stdout?: string };
    const [result] = JSON.parse(err.stdout ?? "[]") as Array<{ messages: Array<{ ruleId: string | null }> }>;
    return result.messages.map((m) => m.ruleId ?? "");
  } finally {
    fs.rmSync(FIXTURE, { force: true });
  }
}

describe("no-restricted-imports for @expo/vector-icons", () => {
  it("rejects the barrel import", () => {
    const rules = lint('import { MaterialCommunityIcons } from "@expo/vector-icons";\nexport const x = MaterialCommunityIcons;\n');
    expect(rules).toContain("no-restricted-imports");
  });

  it("accepts the deep family import", () => {
    const rules = lint('import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";\nexport const x = MaterialCommunityIcons;\n');
    expect(rules).not.toContain("no-restricted-imports");
  });
});
