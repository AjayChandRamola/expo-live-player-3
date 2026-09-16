// Attribute generated bundle bytes to source files by decoding the source map
// mappings directly. source-map-explorer failed on this map ("generated column
// Infinity"), so we do the attribution ourselves.
const fs = require("fs");
const dir = ".baseline-export/_expo/static/js/android";
const jsFile = fs.readdirSync(dir).find((f) => f.endsWith(".js"));
const mapFile = fs.readdirSync(dir).find((f) => f.endsWith(".js.map"));
const code = fs.readFileSync(`${dir}/${jsFile}`, "utf8");
const map = JSON.parse(fs.readFileSync(`${dir}/${mapFile}`, "utf8"));

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVLQ(str) {
  const out = [];
  let shift = 0, value = 0;
  for (const c of str) {
    const digit = CHARS.indexOf(c);
    if (digit === -1) throw new Error("bad char " + c);
    const cont = digit & 32;
    value += (digit & 31) << shift;
    if (cont) { shift += 5; continue; }
    const negative = value & 1;
    value >>= 1;
    out.push(negative ? (value === 0 ? -0x80000000 : -value) : value);
    value = shift = 0;
  }
  return out;
}

// Offset of the start of each generated line within the bundle.
const lineStarts = [0];
for (let i = 0; i < code.length; i++) if (code[i] === "\n") lineStarts.push(i + 1);
const lineLen = (l) =>
  (l + 1 < lineStarts.length ? lineStarts[l + 1] - 1 : code.length) - lineStarts[l];
const absPos = (l, c) => lineStarts[l] + Math.min(c, lineLen(l));

// Decode every segment into {line, col, srcIdx}.
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

// Charge the bytes between each segment and the next to that segment's source.
const bySource = new Map();
let unmapped = 0;
for (let i = 0; i < segs.length; i++) {
  const s = segs[i], n = segs[i + 1];
  const start = absPos(s.line, s.col);
  const end = n ? absPos(n.line, n.col) : code.length;
  const size = Math.max(0, end - start);
  if (s.src === null) { unmapped += size; continue; }
  const name = map.sources[s.src] ?? "<unknown>";
  bySource.set(name, (bySource.get(name) ?? 0) + size);
}

const PLAYER =
  /components[\/]VideoPlayer|hooks[\/]useVideoProgress|hooks[\/]useVideoActions|services[\/]videoActionsService/;
let playerBytes = 0;
let appBytes = 0;
const playerFiles = [];
for (const [k, v] of bySource) {
  if (PLAYER.test(k)) { playerBytes += v; playerFiles.push([k, v]); }
  if (!/node_modules/.test(k)) appBytes += v;
}
const mappedTotal = [...bySource.values()].reduce((a, b) => a + b, 0);

playerFiles.sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({
  bundleFile: jsFile,
  bundleBytes: code.length,
  mappedBytes: mappedTotal,
  unmappedBytes: unmapped,
  appBytes,
  playerBytes,
  percentOfBundle: (100 * playerBytes / code.length).toFixed(2),
  percentOfAppCode: (100 * playerBytes / appBytes).toFixed(2),
  playerFileCount: playerFiles.length,
}, null, 2));
console.log("\nTop player files:");
for (const [k, v] of playerFiles.slice(0, 20)) console.log(String(v).padStart(8), k);
