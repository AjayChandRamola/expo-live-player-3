#!/usr/bin/env node

/**
 * Launches `expo start` inside an OS-native TTY-preserving recorder
 * (PowerShell Start-Transcript on Windows, `script` on macOS/Linux) and
 * persists the full session — bundler output, device console logs,
 * warnings, stack traces — to logs/expo-dev-<timestamp>.log and
 * logs/expo-dev-latest.log.
 *
 * Piping expo's output through a plain stdout pipe (e.g. `| tee`) strips
 * process.stdout.isTTY, which silently disables the QR code and the
 * interactive platform menu. Both recorders below capture at the host/PTY
 * level instead, so the child process still sees a real TTY.
 *
 * Usage: node ./scripts/start-logged.js [args forwarded to expo start]
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const root = process.cwd();
const logsDir = path.join(root, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const forwardedArgs = process.argv.slice(2);
const logFile = path.join(logsDir, `expo-dev-${timestamp()}.log`);
const latestLogFile = path.join(logsDir, "expo-dev-latest.log");

const header = [
  `Expo dev session log`,
  `Started: ${new Date().toISOString()}`,
  `Platform: ${process.platform} (${os.release()})`,
  `Node: ${process.version}`,
  `Forwarded args: ${forwardedArgs.join(" ") || "(none)"}`,
  `----------------------------------------`,
  "",
].join("\n");
fs.writeFileSync(logFile, header, "utf8");

const expoArgs = ["expo", "start", ...forwardedArgs];
const expoCommand = `npx ${expoArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`;

let result;

if (process.platform === "win32") {
  const psCommand = [
    `Start-Transcript -Path '${logFile}' -Append`,
    `try { ${expoCommand} } finally { Stop-Transcript }`,
  ].join("; ");

  result = spawnSync("powershell.exe", ["-NoProfile", "-Command", psCommand], {
    stdio: "inherit",
  });
} else {
  // macOS/Linux best-effort: `script` is preinstalled on both.
  const isLinux = process.platform === "linux";
  const scriptArgs = isLinux
    ? ["-q", "-a", logFile, "-c", expoCommand]
    : ["-q", "-a", logFile, "/bin/sh", "-c", expoCommand];

  result = spawnSync("script", scriptArgs, { stdio: "inherit" });
}

try {
  fs.copyFileSync(logFile, latestLogFile);
} catch {
  // Non-fatal: the timestamped log still has the full session.
}

process.exit(result.status ?? 1);
