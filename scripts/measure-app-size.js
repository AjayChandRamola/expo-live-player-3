#!/usr/bin/env node
// scripts/measure-app-size.js
// Reports the size of an `expo export` output directory:
//   node scripts/measure-app-size.js <exportDir> [--json] [--assert <budget.json>] [--no-autolinking]
// Prints bundle bytes, asset count/bytes, bundled TTFs, and (when a .js.map
// exists) byte attribution by package. With --assert, exits 1 when any value
// exceeds the budget for the platform. See docs/size-optimization/.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function parseArgs(argv) {
  const args = { dir: null, json: false, assert: null, autolinking: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--no-autolinking") args.autolinking = false;
    else if (a === "--assert") args.assert = argv[++i];
    else if (!args.dir) args.dir = a;
  }
  if (!args.dir) {
    console.error("usage: node scripts/measure-app-size.js <exportDir> [--json] [--assert <budget.json>] [--no-autolinking]");
    process.exit(2);
  }
  return args;
}

function readMetadata(dir) {
  const file = path.join(dir, "metadata.json");
  if (!fs.existsSync(file)) throw new Error(`metadata.json not found in ${dir}`);
  const meta = JSON.parse(fs.readFileSync(file, "utf8"));
  const platforms = Object.keys(meta.fileMetadata || {});
  if (platforms.length !== 1) throw new Error(`expected one platform in metadata.json, found ${platforms.length}`);
  const platform = platforms[0];
  return { platform, entry: meta.fileMetadata[platform] };
}

function findBundle(dir, platform, entry) {
  const jsDir = path.join(dir, "_expo", "static", "js", platform);
  if (entry && entry.bundle && fs.existsSync(path.join(dir, entry.bundle))) {
    return path.join(dir, entry.bundle);
  }
  const candidates = fs.readdirSync(jsDir).filter((f) => f.endsWith(".hbc") || f.endsWith(".js"));
  if (candidates.length === 0) throw new Error(`no .hbc or .js bundle in ${jsDir}`);
  candidates.sort((a, b) => fs.statSync(path.join(jsDir, b)).size - fs.statSync(path.join(jsDir, a)).size);
  return path.join(jsDir, candidates[0]);
}

const VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVLQ(str) {
  const out = [];
  let shift = 0;
  let value = 0;
  for (const c of str) {
    const digit = VLQ_CHARS.indexOf(c);
    if (digit === -1) throw new Error("bad VLQ char " + c);
    const cont = digit & 32;
    value += (digit & 31) << shift;
    if (cont) {
      shift += 5;
      continue;
    }
    const negative = value & 1;
    value >>= 1;
    out.push(negative ? -value : value);
    value = 0;
    shift = 0;
  }
  return out;
}

function attribute(bundleFile) {
  const mapFile = bundleFile + ".map";
  if (!fs.existsSync(mapFile)) return null;
  const code = fs.readFileSync(bundleFile, "utf8");
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === "\n") lineStarts.push(i + 1);
  const lineLen = (l) => (l + 1 < lineStarts.length ? lineStarts[l + 1] - 1 : code.length) - lineStarts[l];
  const absPos = (l, c) => lineStarts[l] + Math.min(c, lineLen(l));
  const segs = [];
  let srcIdx = 0;
  map.mappings.split(";").forEach((lineStr, line) => {
    let col = 0;
    if (!lineStr) return;
    for (const segStr of lineStr.split(",")) {
      if (!segStr) continue;
      const f = decodeVLQ(segStr);
      col += f[0];
      if (f.length >= 4) srcIdx += f[1];
      segs.push({ line, col, src: f.length >= 4 ? srcIdx : null });
    }
  });
  segs.sort((a, b) => a.line - b.line || a.col - b.col);
  const bySource = new Map();
  let unmapped = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const n = segs[i + 1];
    const start = absPos(s.line, s.col);
    const end = n ? absPos(n.line, n.col) : code.length;
    const size = Math.max(0, end - start);
    if (s.src === null) {
      unmapped += size;
      continue;
    }
    const name = map.sources[s.src] || "<unknown>";
    bySource.set(name, (bySource.get(name) || 0) + size);
  }
  const packages = new Map();
  let firstParty = 0;
  for (const [k, v] of bySource) {
    const m = k.match(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/);
    if (m) packages.set(m[1], (packages.get(m[1]) || 0) + v);
    else firstParty += v;
  }
  const mappedBytes = [...bySource.values()].reduce((a, b) => a + b, 0);
  const topPackages = [...packages].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([name, bytes]) => ({ name, bytes }));
  return { mappedBytes, unmappedBytes: unmapped, firstPartyBytes: firstParty, topPackages };
}

function autolinkingCounts() {
  const count = (platform) => {
    const out = execFileSync("npx", ["expo-modules-autolinking", "resolve", "-p", platform, "--json"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    return (JSON.parse(out).modules || []).length;
  };
  return { android: count("android"), ios: count("ios") };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.dir);
  const { platform, entry } = readMetadata(dir);
  const bundleFile = findBundle(dir, platform, entry);
  const bundleBytes = fs.statSync(bundleFile).size;
  const assets = (entry && entry.assets) || [];
  let assetBytes = 0;
  const ttf = [];
  for (const a of assets) {
    const p = path.join(dir, a.path);
    const bytes = fs.existsSync(p) ? fs.statSync(p).size : 0;
    assetBytes += bytes;
    if (a.ext === "ttf") ttf.push({ bytes, path: a.path });
  }
  ttf.sort((a, b) => b.bytes - a.bytes);
  const report = {
    platform,
    bundleFile: path.relative(dir, bundleFile),
    bundleBytes,
    assetCount: assets.length,
    assetBytes,
    ttfCount: ttf.length,
    ttf,
  };
  const attributed = attribute(bundleFile);
  if (attributed) Object.assign(report, attributed);
  if (args.autolinking) {
    try {
      report.autolinking = autolinkingCounts();
    } catch (e) {
      report.autolinking = { error: String(e && e.message) };
    }
  }

  let failed = false;
  if (args.assert) {
    const budget = JSON.parse(fs.readFileSync(path.resolve(args.assert), "utf8"))[platform] || {};
    for (const key of ["bundleBytes", "assetBytes", "assetCount", "ttfCount"]) {
      if (typeof budget[key] === "number" && report[key] > budget[key]) {
        failed = true;
        console.error(`BUDGET EXCEEDED ${platform}.${key}: measured ${report[key]} > budget ${budget[key]}`);
      }
    }
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`platform      ${report.platform}`);
    console.log(`bundle        ${report.bundleFile} ${report.bundleBytes} B`);
    console.log(`assets        ${report.assetCount} files, ${report.assetBytes} B`);
    console.log(`ttf           ${report.ttfCount}`);
    for (const t of report.ttf) console.log(`  ${String(t.bytes).padStart(9)} ${t.path}`);
    if (report.topPackages) {
      console.log(`mapped ${report.mappedBytes} unmapped ${report.unmappedBytes} first-party ${report.firstPartyBytes}`);
      for (const p of report.topPackages) console.log(`  ${String(p.bytes).padStart(9)} ${p.name}`);
    }
    if (report.autolinking) console.log(`autolinking   ${JSON.stringify(report.autolinking)}`);
  }
  process.exit(failed ? 1 : 0);
}

main();
