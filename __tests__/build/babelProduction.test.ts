// __tests__/build/babelProduction.test.ts
// Production builds must drop console.log/info/debug (73 call sites today)
// while keeping console.error/warn, which utils/Logger uses for observability.
import path from "path";
import { transformSync } from "@babel/core";

const ROOT = path.join(__dirname, "..", "..");

type BabelConfigFactory = (api: { cache: { using: (fn: () => string | undefined) => void } }) => {
  env?: { production?: { plugins?: unknown[] } };
};

function productionPlugins(): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const factory = require(path.join(ROOT, "babel.config.js")) as BabelConfigFactory;
  const config = factory({ cache: { using: (fn) => fn() } });
  return config.env?.production?.plugins ?? [];
}

const SOURCE = 'console.log("drop me"); console.info("drop"); console.debug("drop"); console.warn("keep"); console.error("keep");';

describe("babel production config", () => {
  it("declares transform-remove-console for production", () => {
    expect(JSON.stringify(productionPlugins())).toContain("transform-remove-console");
  });

  it("removes log/info/debug and keeps warn/error", () => {
    const out = transformSync(SOURCE, { filename: "fixture.js", babelrc: false, configFile: false, plugins: productionPlugins() as never })?.code ?? "";
    expect(out).not.toContain("console.log");
    expect(out).not.toContain("console.info");
    expect(out).not.toContain("console.debug");
    expect(out).toContain("console.warn");
    expect(out).toContain("console.error");
  });
});
