// services/mediaSourceResolver.ts
/**
 * The media trust boundary.
 *
 * Everything a backend or deep link says about a URL is untrusted until it
 * passes through here. resolvePlayable is the only way a URL reaches the
 * player; resolveEmbed is the only way one reaches the live WebView.
 *
 * No React imports. No network calls.
 */
import { MEDIA, YOUTUBE_EMBED } from "../constants/config";
import { makeError } from "./appError";
import type {
  EmbedTarget,
  LiveSession,
  PlayableSource,
  Video,
} from "../types/domain";

/** YouTube ids are 11 characters of [A-Za-z0-9_-]. Anything else is rejected. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

function parse(url: string): URL {
  if (typeof url !== "string" || url.trim().length === 0) {
    throw makeError("invalid_source");
  }
  try {
    return new URL(url.trim());
  } catch (cause) {
    throw makeError("invalid_source", cause);
  }
}

function assertProtocol(parsed: URL): void {
  if (!(MEDIA.allowedProtocols as readonly string[]).includes(parsed.protocol)) {
    throw makeError("invalid_source");
  }
}

export function resolvePlayable(input: Video | LiveSession): PlayableSource {
  const { kind, url } = input.source;

  // The player cannot play YouTube. Callers must use resolveEmbed instead.
  if (kind === "youtube") {
    throw makeError("unsupported_source");
  }

  const parsed = parse(url);
  assertProtocol(parsed);

  const path = parsed.pathname.toLowerCase();
  const supported = (MEDIA.allowedExtensions as readonly string[]).some((ext) =>
    path.endsWith(ext),
  );
  if (!supported) {
    throw makeError("unsupported_source");
  }

  // The declared kind wins over the extension: a backend may legitimately
  // serve an HLS manifest from a path that does not end in .m3u8.
  return { kind, url: parsed.toString() };
}

function extractYouTubeId(parsed: URL): string {
  // youtu.be/<id>
  if (parsed.hostname === "youtu.be") {
    return parsed.pathname.replace(/^\//, "");
  }
  // youtube.com/watch?v=<id>
  const fromQuery = parsed.searchParams.get("v");
  if (fromQuery) return fromQuery;
  // youtube.com/embed/<id> and /live/<id>
  const match = parsed.pathname.match(/^\/(?:embed|live)\/([^/]+)/);
  return match ? match[1] : "";
}

export function resolveEmbed(session: LiveSession): EmbedTarget {
  if (session.source.kind !== "youtube") {
    throw makeError("unsupported_source");
  }

  const parsed = parse(session.source.url);
  assertProtocol(parsed);

  // Exact host match. A suffix check would accept youtube.evil.test.
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    throw makeError("invalid_source");
  }

  const id = extractYouTubeId(parsed);
  if (!YOUTUBE_ID.test(id)) {
    throw makeError("invalid_source");
  }

  return {
    embedUrl: `${YOUTUBE_EMBED.embedBase}${id}?playsinline=1&rel=0&modestbranding=1`,
    allowedOrigins: YOUTUBE_EMBED.allowedOrigins,
  };
}
