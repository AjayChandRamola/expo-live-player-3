// services/appError.ts
import type { AppError, AppErrorCode } from "../types/result";

const SAFE_MESSAGES: Record<AppErrorCode, string> = {
  network: "No connection. Check your network and try again.",
  timeout: "This is taking too long. Try again.",
  not_found: "This content is not available.",
  invalid_source: "This video cannot be played.",
  unsupported_source: "This format is not supported on your device.",
  storage: "Could not save your changes on this device.",
  storage_full: "Not enough space on this device to download.",
  payments_unavailable: "Thanks is coming soon.",
  unauthorized: "Please sign in to do that.",
  validation: "That input is not valid.",
  unknown: "Something went wrong. Try again.",
};

export function makeError(code: AppErrorCode, cause?: unknown): AppError {
  return { code, message: SAFE_MESSAGES[code], cause };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as AppError).message === "string"
  );
}

/** Last-resort mapping for anything thrown outside a service. */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return makeError("unknown", value);
}
