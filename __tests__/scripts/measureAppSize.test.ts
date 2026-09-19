// __tests__/scripts/measureAppSize.test.ts
// The size report is the initiative's measurement instrument; it must be
// deterministic on a fixture before it is trusted on real exports.
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "measure-app-size.js");
const FIXTURE = path.join(ROOT, "__tests__", "fixtures", "export-sample");

function run(args: string[]): { code: number; stdout: string } {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, stdout: String(err.stdout) + String(err.stderr) };
  }
}

describe("scripts/measure-app-size.js", () => {
  it("reports bundle bytes, asset count/bytes and ttf list for a fixture export", () => {
    const { code, stdout } = run([FIXTURE, "--json", "--no-autolinking"]);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.platform).toBe("android");
    expect(report.bundleBytes).toBe(10);
    expect(report.assetCount).toBe(2);
    expect(report.assetBytes).toBe(11);
    expect(report.ttfCount).toBe(1);
    expect(report.ttf[0].bytes).toBe(8);
  });

  it("passes --assert when the budget is met and fails when it is exceeded", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budget-"));
    const ok = path.join(dir, "ok.json");
    const bad = path.join(dir, "bad.json");
    fs.writeFileSync(
      ok,
      JSON.stringify({ android: { bundleBytes: 10, assetBytes: 11, assetCount: 2, ttfCount: 1 } }),
    );
    fs.writeFileSync(
      bad,
      JSON.stringify({ android: { bundleBytes: 9, assetBytes: 11, assetCount: 2, ttfCount: 1 } }),
    );
    expect(run([FIXTURE, "--json", "--no-autolinking", "--assert", ok]).code).toBe(0);
    const failed = run([FIXTURE, "--json", "--no-autolinking", "--assert", bad]);
    expect(failed.code).toBe(1);
    expect(failed.stdout).toContain("bundleBytes");
  });
});
