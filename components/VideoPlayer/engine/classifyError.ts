// components/VideoPlayer/engine/classifyError.ts
import { ERROR_MESSAGES, ERROR_SUBSTRINGS } from "../constants";
import type { PlaybackError, PlaybackErrorCode } from "./types";

const QUERY_STRING = /\?[^\s]*/g;

/** Removes "?..." segments so URLs with tokens never reach a log. */
export function stripQuery(text: string): string {
  return text.replace(QUERY_STRING, "");
}

function codeFor(message: string): PlaybackErrorCode {
  const lower = message.toLowerCase();
  for (const [code, needles] of ERROR_SUBSTRINGS) {
    if (needles.some((needle) => lower.includes(needle))) return code;
  }
  return "unknown";
}

export function classifyError(nativeMessage: string | undefined): PlaybackError {
  const code = nativeMessage === undefined ? "unknown" : codeFor(nativeMessage);
  return {
    code,
    message: ERROR_MESSAGES[code],
    retryable: code !== "unsupported",
    cause: nativeMessage === undefined ? undefined : stripQuery(nativeMessage),
  };
}
