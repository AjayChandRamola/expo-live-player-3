// File: utils/Logger.ts
// Robust, defensive logger used across the app.
// Exports: default Logger object and named helpers (info, warn, error, debug).
// - Safe if console methods are missing
// - Adds ISO timestamp + tags
// - Provides installGlobalErrorHandlers() to catch uncaught errors and rejections

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

function safeConsole(method: keyof Console) {
  return (console as any)[method] ? (console as any)[method].bind(console) : () => {};
}

const cDebug = safeConsole("debug");
const cInfo = safeConsole("info");
const cWarn = safeConsole("warn");
const cError = safeConsole("error");
const cLog = safeConsole("log");

/** Format a structured log entry */
function fmt(level: LogLevel, scope: string | Array<string> | null, ...parts: any[]) {
  const tag = Array.isArray(scope) ? scope.join("] [") : scope ? String(scope) : "";
  const prefix = tag ? `[${tag}]` : "";
  const ts = nowIso();
  // convert objects safely
  const message = parts.map((p) => {
    try {
      if (typeof p === "string") return p;
      return typeof p === "object" ? JSON.stringify(p) : String(p);
    } catch (e) {
      return String(p);
    }
  });
  return `${ts} [${level}] ${prefix} ${message.join(" ")}`;
}

function debug(scope: string | null, ...parts: any[]) {
  cDebug(fmt("DEBUG", scope ?? null, ...parts));
}
function info(scope: string | null, ...parts: any[]) {
  cInfo(fmt("INFO", scope ?? null, ...parts));
}
function warn(scope: string | null, ...parts: any[]) {
  cWarn(fmt("WARN", scope ?? null, ...parts));
}
function error(scope: string | null, ...parts: any[]) {
  cError(fmt("ERROR", scope ?? null, ...parts));
}

/** Install global JS error handlers (ErrorUtils + unhandledrejection) */
function installGlobalErrorHandlers() {
  try {
    // React Native/JSCore error hook
    const anyGlobal = global as any;
    if (typeof anyGlobal.ErrorUtils?.setGlobalHandler === "function") {
      const defaultHandler = anyGlobal.ErrorUtils.getGlobalHandler?.();
      anyGlobal.ErrorUtils.setGlobalHandler((err: any, isFatal?: boolean) => {
        try {
          error("Global", "Uncaught Exception:", err?.message ?? err, err?.stack ?? "");
        } catch {}
        if (defaultHandler) {
          try {
            defaultHandler(err, isFatal);
          } catch {}
        }
      });
      info("Global", "Installed ErrorUtils global handler.");
    }

    if (typeof (globalThis as any).addEventListener === "function") {
      (globalThis as any).addEventListener("unhandledrejection", (ev: any) => {
        try {
          error("Global", "Unhandled Promise Rejection:", ev?.reason ?? ev);
        } catch {}
      });
      info("Global", "Installed unhandledrejection listener.");
    }
  } catch (e) {
    try {
      error("Global", "Failed to install global error handlers:", e);
    } catch {}
  }
}

/** Public API */
const Logger = {
  debug,
  info,
  warn,
  error,
  installGlobalErrorHandlers,
};

export default Logger;
// also export named helpers (some files may import named)
export { debug, info, warn, error, installGlobalErrorHandlers };
