// services/deepLinkService.ts
/**
 * Validates every incoming deep link before it can influence navigation.
 * Anything unrecognised, malformed, or hostile resolves to home rather than
 * surfacing an error dialog or reaching an unvalidated route.
 */
import { LINKS } from "../constants/config";
import Logger from "../utils/Logger";

export type DeepLinkTarget =
  | { readonly kind: "video"; readonly id: string }
  | { readonly kind: "live" }
  | { readonly kind: "home" };

const VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/;
const HOME: DeepLinkTarget = { kind: "home" };

export function parseDeepLink(url: string): DeepLinkTarget {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    Logger.warn("[deepLinkService] Unparseable deep link");
    return HOME;
  }

  if (parsed.protocol !== `${LINKS.scheme}:`) {
    Logger.warn("[deepLinkService] Rejected deep link with an unexpected scheme");
    return HOME;
  }

  const host = parsed.hostname;

  if (host === LINKS.livePath) {
    return { kind: "live" };
  }

  if (host === LINKS.videoPath) {
    const segment = parsed.pathname.replace(/^\//, "");
    if (!segment) {
      Logger.warn("[deepLinkService] Rejected a video deep link with no id");
      return HOME;
    }
    let id: string;
    try {
      id = decodeURIComponent(segment);
    } catch {
      Logger.warn("[deepLinkService] Rejected an unparseable video id");
      return HOME;
    }
    if (!VIDEO_ID.test(id)) {
      Logger.warn("[deepLinkService] Rejected a video id outside the allowed pattern");
      return HOME;
    }
    return { kind: "video", id };
  }

  Logger.warn("[deepLinkService] Rejected a deep link with an unrecognised host");
  return HOME;
}
