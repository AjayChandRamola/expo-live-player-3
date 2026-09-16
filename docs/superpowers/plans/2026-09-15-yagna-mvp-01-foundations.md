# Increment 1 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-09-15-yagna-mvp-lld-index.md` first.** Every type and signature in this plan is defined there. Copy them verbatim; do not invent variants.

**Goal:** Build the shared layer every screen depends on: design tokens, the error model, storage, the HTTP client, content services, the media source resolver, the hook status machine, and the shared UI state components.

**Architecture:** Bottom-up. Types first, then services with no React dependency, then the hook that adapts services to React, then the presentational components. Nothing in this increment renders a screen or touches the player.

**Tech Stack:** TypeScript 5.9 strict, AsyncStorage 2.2, expo-constants 18, React Native Testing Library 13.3.

**Spec:** `docs/superpowers/specs/2026-09-15-yagna-mobile-hld-design.md`, sections G, H, I.

**Depends on:** Increment 0A (test harness). Increment 0B is independent of this one and the two can run in parallel, except that 0B Task 6 creates `constants/config.ts` with only the `PLAYER_FEATURE_FLAGS` block. If 0B ran first, append to that file. If not, create it whole.

---

## Global Constraints

All constraints from the LLD index apply. Specific to this increment:

- **No React imports in `services/`.** These are plain async functions and must be testable without a renderer.
- **Only `services/storage/asyncStorageAdapter.ts` imports AsyncStorage. Only `services/httpClient.ts` calls `fetch`.**
- Every service rejects with an `AppError`, never a raw `Error`.
- Every file created here is under 200 lines.

---

### Task 1: The error model

**Files:**
- Create: `types/result.ts`
- Create: `services/appError.ts`
- Test: `__tests__/services/appError.test.ts`

**Interfaces:**
- Produces: `AppErrorCode`, `AppError`, `LoadStatus`, `Loadable`, `PagedLoadable`, `makeError`, `isAppError`, `toAppError`. Every later task in every later increment uses these.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/appError.test.ts`:

```ts
// __tests__/services/appError.test.ts
import { makeError, isAppError, toAppError } from "../../services/appError";
import type { AppErrorCode } from "../../types/result";

const ALL_CODES: AppErrorCode[] = [
  "network",
  "timeout",
  "not_found",
  "invalid_source",
  "unsupported_source",
  "storage",
  "validation",
  "unknown",
];

describe("appError", () => {
  it("produces a safe message for every code", () => {
    for (const code of ALL_CODES) {
      const err = makeError(code);
      expect(err.code).toBe(code);
      expect(typeof err.message).toBe("string");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it("never leaks a URL, stack, or code identifier into the user message", () => {
    for (const code of ALL_CODES) {
      const { message } = makeError(code, new Error("https://secret.test/a?token=abc"));
      expect(message).not.toMatch(/https?:\/\//);
      expect(message).not.toContain("token");
      expect(message).not.toContain("Error:");
    }
  });

  it("keeps the cause for logging without rendering it", () => {
    const cause = new Error("boom");
    expect(makeError("network", cause).cause).toBe(cause);
  });

  it("recognises its own shape", () => {
    expect(isAppError(makeError("timeout"))).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError({})).toBe(false);
  });

  it("passes an AppError through toAppError unchanged", () => {
    const original = makeError("not_found");
    expect(toAppError(original)).toBe(original);
  });

  it("wraps anything else as unknown", () => {
    const wrapped = toAppError(new Error("surprise"));
    expect(wrapped.code).toBe("unknown");
    expect(wrapped.cause).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=appError
```
Expected: fails with `Cannot find module '../../services/appError'`.

- [ ] **Step 3: Create `types/result.ts`**

Copy the block from LLD index section 5.1 verbatim.

- [ ] **Step 4: Create `services/appError.ts`**

Copy the block from LLD index section 5.3 verbatim.

- [ ] **Step 5: Run the test**

Run:
```bash
npm test -- --testPathPattern=appError
```
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add types/result.ts services/appError.ts __tests__/services/appError.test.ts
git commit -m "feat: add the AppError model and load status types

One error shape crosses every service boundary, with user-safe messages
held separately from causes so raw exceptions are never rendered.

Verified: npm test -- --testPathPattern=appError => 6 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Configuration constants and design tokens

**Files:**
- Create or extend: `constants/config.ts`
- Create: `constants/tokens.ts`
- Test: `__tests__/constants/tokens.test.ts`

**Interfaces:**
- Produces: `TIMING`, `LIMITS`, `STORAGE_KEYS`, `PLAYER_FEATURE_FLAGS`, `MEDIA`, `LINKS`, `YOUTUBE_EMBED` from `constants/config.ts`; `tokens` and `getColors` from `constants/tokens.ts`.

- [ ] **Step 1: Complete `constants/config.ts`**

Copy section 5.4 of the LLD index verbatim. If Increment 0B already created the file with `PLAYER_FEATURE_FLAGS`, add the other six blocks around it rather than duplicating it.

- [ ] **Step 2: Write the failing token test**

Create `__tests__/constants/tokens.test.ts`:

```ts
// __tests__/constants/tokens.test.ts
import { tokens, getColors } from "../../constants/tokens";

describe("design tokens", () => {
  it("exposes a light and a dark palette with identical keys", () => {
    const light = Object.keys(getColors("light")).sort();
    const dark = Object.keys(getColors("dark")).sort();
    expect(light).toEqual(dark);
  });

  it("defines every semantic colour role the UI needs", () => {
    const required = [
      "primary",
      "onPrimary",
      "background",
      "surface",
      "surfaceElevated",
      "text",
      "textMuted",
      "border",
      "overlay",
      "live",
      "success",
      "danger",
      "skeleton",
    ];
    const light = getColors("light");
    for (const role of required) {
      expect(light).toHaveProperty(role);
      expect(typeof (light as Record<string, string>)[role]).toBe("string");
    }
  });

  it("uses a 4-point spacing scale in ascending order", () => {
    const values = [
      tokens.spacing.xs,
      tokens.spacing.sm,
      tokens.spacing.md,
      tokens.spacing.lg,
      tokens.spacing.xl,
      tokens.spacing.xxl,
    ];
    expect(values).toEqual([4, 8, 12, 16, 24, 32]);
    for (const v of values) {
      expect(v % 4).toBe(0);
    }
  });

  it("defines four type sizes in ascending order", () => {
    const { caption, body, heading, title } = tokens.typography;
    expect(caption.fontSize).toBeLessThan(body.fontSize);
    expect(body.fontSize).toBeLessThan(heading.fontSize);
    expect(heading.fontSize).toBeLessThan(title.fontSize);
  });

  it("keeps every touch target at or above the 44 point minimum", () => {
    expect(tokens.touchTarget.min).toBeGreaterThanOrEqual(44);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=tokens
```
Expected: `Cannot find module '../../constants/tokens'`.

- [ ] **Step 4: Create `constants/tokens.ts`**

```ts
// constants/tokens.ts
/**
 * The single source of design values for all new UI.
 * No component may hard-code a colour, size, radius, or duration.
 *
 * The existing constants/theme.ts stays for now because components/VideoFeed,
 * components/Shorts, and components/Comments still import it. New code uses
 * this file only.
 */
import type { TextStyle } from "react-native";

export type ColorScheme = "light" | "dark";

export interface Palette {
  readonly primary: string;
  readonly onPrimary: string;
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly overlay: string;
  readonly live: string;
  readonly success: string;
  readonly danger: string;
  readonly skeleton: string;
}

/** Saffron primary, chosen for the Yagna context and legible on both surfaces. */
const LIGHT: Palette = {
  primary: "#C2410C",
  onPrimary: "#FFFFFF",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceElevated: "#FFFFFF",
  text: "#11181C",
  textMuted: "#5B6670",
  border: "#E2E8F0",
  overlay: "rgba(0,0,0,0.45)",
  live: "#E53935",
  success: "#15803D",
  danger: "#B91C1C",
  skeleton: "#E9EDF2",
};

const DARK: Palette = {
  primary: "#FB923C",
  onPrimary: "#1A1207",
  background: "#0F1113",
  surface: "#16191C",
  surfaceElevated: "#1E2226",
  text: "#ECEDEE",
  textMuted: "#9BA1A6",
  border: "#2A2F35",
  overlay: "rgba(0,0,0,0.6)",
  live: "#FF5A52",
  success: "#4ADE80",
  danger: "#F87171",
  skeleton: "#22272C",
};

export function getColors(scheme: ColorScheme): Palette {
  return scheme === "dark" ? DARK : LIGHT;
}

const typography = {
  title: { fontSize: 24, fontWeight: "600" } as TextStyle,
  heading: { fontSize: 18, fontWeight: "600" } as TextStyle,
  body: { fontSize: 15, fontWeight: "400" } as TextStyle,
  caption: { fontSize: 12, fontWeight: "400" } as TextStyle,
} as const;

export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  iconSize: { sm: 18, md: 24, lg: 28 },
  motion: { fast: 150, normal: 250 },
  /** Accessibility floor. Every pressable must be at least this tall and wide. */
  touchTarget: { min: 44 },
  elevation: {
    level1: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    level2: {
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  },
  typography,
} as const;
```

- [ ] **Step 5: Run the test**

Run:
```bash
npm test -- --testPathPattern=tokens
```
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add constants/tokens.ts constants/config.ts __tests__/constants/tokens.test.ts
git commit -m "feat: add design tokens and configuration constants

Centralises colours, type scale, spacing, radius, elevation, and motion,
plus every interval, limit, storage key, and allowlist the app needs, so
no magic values appear in feature code.

Verified: npm test -- --testPathPattern=tokens => 5 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Domain types

**Files:**
- Create: `types/domain.ts`

**Interfaces:**
- Produces: `Channel`, `SourceDescriptor`, `PlayableSource`, `EmbedTarget`, `CaptionItem`, `ChapterItem`, `Video`, `LiveSession`, `LiveState`, `LiveStatus`.

There is no test for a type-only file; `npx tsc --noEmit` is the check.

- [ ] **Step 1: Create the file**

Copy LLD index section 5.2 verbatim.

- [ ] **Step 2: Confirm it compiles and does not collide with the existing types**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "types/domain"
```
Expected: `0`.

Do **not** edit or delete `types/video.ts` in this increment. `components/VideoFeed/`, `components/Shorts/`, and `components/Comments/` all import `VideoMetadata` from it. Increment 3 adds the `toVideo` adapter and migrates consumers.

- [ ] **Step 3: Commit**

```bash
git add types/domain.ts
git commit -m "feat: add domain types for video, live, and media sources

SourceDescriptor carries what a backend claims; PlayableSource is what the
resolver has validated. Keeping them distinct is what stops an unvalidated
URL reaching the player.

Verified: npx tsc --noEmit reports no errors in types/domain.ts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Media source resolver

**Files:**
- Create: `services/mediaSourceResolver.ts`
- Test: `__tests__/services/mediaSourceResolver.test.ts`

**Interfaces:**
- Consumes: `Video`, `LiveSession`, `PlayableSource`, `EmbedTarget` from `types/domain`; `MEDIA`, `YOUTUBE_EMBED` from `constants/config`; `makeError` from `services/appError`.
- Produces: `resolvePlayable(input: Video | LiveSession): PlayableSource` and `resolveEmbed(session: LiveSession): EmbedTarget`, both throwing `AppError`.

**Why this gets the heaviest tests:** this is the app's media trust boundary. Everything the backend says about a URL is untrusted until it passes here. A weak validator here is a security defect, not a bug.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/mediaSourceResolver.test.ts`:

```ts
// __tests__/services/mediaSourceResolver.test.ts
import { resolvePlayable, resolveEmbed } from "../../services/mediaSourceResolver";
import { isAppError } from "../../services/appError";
import type { Video, LiveSession, SourceDescriptor } from "../../types/domain";

function videoWith(source: SourceDescriptor): Video {
  return {
    id: "v1",
    title: "Test",
    thumbnailUrl: "https://cdn.test/t.jpg",
    durationSec: 10,
    publishedAt: "2026-01-01T00:00:00Z",
    channel: { id: "c1", name: "Channel" },
    isLive: false,
    source,
  };
}

function sessionWith(source: SourceDescriptor): LiveSession {
  return {
    id: "s1",
    title: "Live",
    thumbnailUrl: "https://cdn.test/t.jpg",
    startsAt: "2026-01-01T00:00:00Z",
    source,
  };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return isAppError(e) ? e.code : "not-an-app-error";
  }
  return "did-not-throw";
}

describe("resolvePlayable", () => {
  it("accepts an HTTPS HLS url", () => {
    const result = resolvePlayable(
      videoWith({ kind: "hls", url: "https://cdn.test/stream.m3u8" }),
    );
    expect(result).toEqual({ kind: "hls", url: "https://cdn.test/stream.m3u8" });
  });

  it("accepts an HTTPS MP4 url", () => {
    const result = resolvePlayable(
      videoWith({ kind: "mp4", url: "https://cdn.test/movie.mp4" }),
    );
    expect(result.kind).toBe("mp4");
  });

  it("accepts a url with a query string when the path extension is valid", () => {
    const result = resolvePlayable(
      videoWith({ kind: "hls", url: "https://cdn.test/stream.m3u8?token=abc" }),
    );
    expect(result.url).toContain("stream.m3u8");
  });

  it("rejects plain HTTP", () => {
    expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url: "http://cdn.test/a.mp4" }))))
      .toBe("invalid_source");
  });

  it.each([
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
    ["data:video/mp4;base64,AAAA"],
    ["ftp://cdn.test/a.mp4"],
  ])("rejects the dangerous scheme %s", (url) => {
    expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url })))).toBe("invalid_source");
  });

  it.each([[""], ["   "], ["not a url"], ["//cdn.test/a.mp4"]])(
    "rejects the malformed url %p",
    (url) => {
      expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url })))).toBe("invalid_source");
    },
  );

  it("rejects an extension it cannot play", () => {
    expect(codeOf(() => resolvePlayable(videoWith({ kind: "mp4", url: "https://cdn.test/a.mkv" }))))
      .toBe("unsupported_source");
  });

  it("refuses to hand a youtube source to the player", () => {
    expect(
      codeOf(() =>
        resolvePlayable(videoWith({ kind: "youtube", url: "https://youtube.com/watch?v=abc" })),
      ),
    ).toBe("unsupported_source");
  });

  it("resolves a live session the same way as a video", () => {
    const result = resolvePlayable(sessionWith({ kind: "hls", url: "https://cdn.test/live.m3u8" }));
    expect(result.kind).toBe("hls");
  });

  it("trusts the declared kind over the extension when they disagree", () => {
    // A backend may serve HLS from a .mp4 path. The declared kind wins,
    // but the extension must still be one we support.
    const result = resolvePlayable(videoWith({ kind: "hls", url: "https://cdn.test/a.mp4" }));
    expect(result.kind).toBe("hls");
  });
});

describe("resolveEmbed", () => {
  it("builds a no-cookie embed url from a youtube watch link", () => {
    const target = resolveEmbed(
      sessionWith({ kind: "youtube", url: "https://www.youtube.com/watch?v=abc123" }),
    );
    expect(target.embedUrl).toContain("youtube-nocookie.com/embed/abc123");
  });

  it("accepts a youtu.be short link", () => {
    const target = resolveEmbed(sessionWith({ kind: "youtube", url: "https://youtu.be/abc123" }));
    expect(target.embedUrl).toContain("abc123");
  });

  it("returns the origin allowlist the WebView must enforce", () => {
    const target = resolveEmbed(
      sessionWith({ kind: "youtube", url: "https://www.youtube.com/watch?v=abc123" }),
    );
    expect(target.allowedOrigins.length).toBeGreaterThan(0);
    for (const origin of target.allowedOrigins) {
      expect(origin.startsWith("https://")).toBe(true);
    }
  });

  it("rejects a non-youtube source", () => {
    expect(codeOf(() => resolveEmbed(sessionWith({ kind: "hls", url: "https://cdn.test/a.m3u8" }))))
      .toBe("unsupported_source");
  });

  it("rejects a look-alike host", () => {
    expect(
      codeOf(() =>
        resolveEmbed(sessionWith({ kind: "youtube", url: "https://youtube.evil.test/watch?v=a" })),
      ),
    ).toBe("invalid_source");
  });

  it("rejects a youtube url with no video id", () => {
    expect(
      codeOf(() => resolveEmbed(sessionWith({ kind: "youtube", url: "https://www.youtube.com/" }))),
    ).toBe("invalid_source");
  });

  it("rejects a video id containing url-control characters", () => {
    expect(
      codeOf(() =>
        resolveEmbed(sessionWith({ kind: "youtube", url: "https://youtu.be/abc?a=1&b=../../x" })),
      ),
    ).not.toBe("did-not-throw");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=mediaSourceResolver
```
Expected: `Cannot find module '../../services/mediaSourceResolver'`.

- [ ] **Step 3: Implement the resolver**

Create `services/mediaSourceResolver.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=mediaSourceResolver
```
Expected: every test passes.

If the "trusts the declared kind" test fails, re-read the implementation: the returned `kind` comes from `input.source.kind`, not from the extension.

- [ ] **Step 5: Commit**

```bash
git add services/mediaSourceResolver.ts __tests__/services/mediaSourceResolver.test.ts
git commit -m "feat: add the media source resolver

The single trust boundary between backend-claimed URLs and the player.
Enforces HTTPS, an extension allowlist, exact-host matching for YouTube,
and an 11-character id pattern, rejecting javascript:, data:, file:, and
look-alike hosts.

Verified: npm test -- --testPathPattern=mediaSourceResolver => all passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Storage layer

**Files:**
- Create: `services/storage/asyncStorageAdapter.ts`
- Create: `services/storage/savedStorage.ts`
- Create: `services/storage/settingsStorage.ts`
- Test: `__tests__/services/storage.test.ts`

**Interfaces:**
- Produces the eight functions listed in LLD index section 5.6 under the three storage modules. `SavedContext` (Increment 4) and `SettingsContext` (Increment 6) depend on them.

**Why versioned and guarded:** a payload written by an older build, or corrupted on disk, must never crash the app or feed a malformed object into state. Every read validates and falls back.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/storage.test.ts`:

```ts
// __tests__/services/storage.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSaved, writeSaved } from "../../services/storage/savedStorage";
import {
  readSettings,
  writeSettings,
  readRecentSearches,
  writeRecentSearches,
} from "../../services/storage/settingsStorage";
import { STORAGE_KEYS, LIMITS } from "../../constants/config";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("savedStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("returns an empty state when nothing is stored", async () => {
    await expect(readSaved()).resolves.toEqual({ savedIds: [], likedIds: [] });
  });

  it("round-trips a saved state", async () => {
    await writeSaved({ savedIds: ["a", "b"], likedIds: ["b"] });
    await expect(readSaved()).resolves.toEqual({ savedIds: ["a", "b"], likedIds: ["b"] });
  });

  it("writes under the versioned key", async () => {
    await writeSaved({ savedIds: ["a"], likedIds: [] });
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.saved);
    expect(raw).toBeTruthy();
  });

  it("resets to empty when the payload is not valid JSON", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.saved, "{not json");
    await expect(readSaved()).resolves.toEqual({ savedIds: [], likedIds: [] });
  });

  it("resets to empty when the payload has the wrong shape", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.saved, JSON.stringify({ savedIds: "nope" }));
    await expect(readSaved()).resolves.toEqual({ savedIds: [], likedIds: [] });
  });

  it("drops non-string entries from a partially corrupt array", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.saved,
      JSON.stringify({ savedIds: ["a", 5, null, "b"], likedIds: [] }),
    );
    const result = await readSaved();
    expect(result.savedIds).toEqual(["a", "b"]);
  });

  it("rejects with a storage AppError when the device write fails", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await expect(writeSaved({ savedIds: [], likedIds: [] })).rejects.toMatchObject({
      code: "storage",
    });
  });
});

describe("settingsStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("defaults to system theme with autoplay on", async () => {
    await expect(readSettings()).resolves.toEqual({ theme: "system", autoplayDefault: true });
  });

  it("round-trips settings", async () => {
    await writeSettings({ theme: "dark", autoplayDefault: false });
    await expect(readSettings()).resolves.toEqual({ theme: "dark", autoplayDefault: false });
  });

  it("falls back to defaults when the stored theme is not a known value", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ theme: "neon", autoplayDefault: true }),
    );
    await expect(readSettings()).resolves.toEqual({ theme: "system", autoplayDefault: true });
  });

  it("round-trips recent searches", async () => {
    await writeRecentSearches(["yagna", "gayatri"]);
    await expect(readRecentSearches()).resolves.toEqual(["yagna", "gayatri"]);
  });

  it("caps recent searches at the configured maximum", async () => {
    const many = Array.from({ length: LIMITS.recentSearchesMax + 10 }, (_, i) => `q${i}`);
    await writeRecentSearches(many);
    const stored = await readRecentSearches();
    expect(stored).toHaveLength(LIMITS.recentSearchesMax);
    expect(stored[0]).toBe("q0");
  });

  it("returns an empty list when recent searches are corrupt", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.recentSearches, "[[[");
    await expect(readRecentSearches()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=storage
```
Expected: module-not-found failures.

- [ ] **Step 3: Create the adapter**

Create `services/storage/asyncStorageAdapter.ts`:

```ts
// services/storage/asyncStorageAdapter.ts
/**
 * The only module in the app that imports AsyncStorage.
 *
 * Every read is guarded: bad JSON or an unexpected shape resolves to the
 * caller's fallback and logs, rather than throwing into a render.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logger from "../../utils/Logger";
import { makeError } from "../appError";

export async function readJson<T>(
  key: string,
  guard: (value: unknown) => value is T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!guard(parsed)) {
      Logger.warn("[Storage]", `Discarding malformed payload for ${key}`);
      return fallback;
    }
    return parsed;
  } catch (cause) {
    Logger.warn("[Storage]", `Read failed for ${key}`, cause);
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (cause) {
    Logger.error("[Storage]", `Write failed for ${key}`, cause);
    throw makeError("storage", cause);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (cause) {
    Logger.error("[Storage]", `Remove failed for ${key}`, cause);
    throw makeError("storage", cause);
  }
}
```

- [ ] **Step 4: Create the saved store**

Create `services/storage/savedStorage.ts`:

```ts
// services/storage/savedStorage.ts
import { STORAGE_KEYS } from "../../constants/config";
import { readJson, writeJson } from "./asyncStorageAdapter";

export interface SavedState {
  readonly savedIds: string[];
  readonly likedIds: string[];
}

const EMPTY: SavedState = { savedIds: [], likedIds: [] };

function onlyStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function isSavedShape(value: unknown): value is { savedIds: unknown; likedIds: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { savedIds?: unknown }).savedIds)
  );
}

export async function readSaved(): Promise<SavedState> {
  const raw = await readJson(STORAGE_KEYS.saved, isSavedShape, EMPTY as unknown as {
    savedIds: unknown;
    likedIds: unknown;
  });
  return {
    savedIds: onlyStrings(raw.savedIds),
    likedIds: onlyStrings(raw.likedIds),
  };
}

export async function writeSaved(state: SavedState): Promise<void> {
  await writeJson(STORAGE_KEYS.saved, {
    savedIds: onlyStrings(state.savedIds),
    likedIds: onlyStrings(state.likedIds),
  });
}
```

- [ ] **Step 5: Create the settings store**

Create `services/storage/settingsStorage.ts`:

```ts
// services/storage/settingsStorage.ts
import { LIMITS, STORAGE_KEYS } from "../../constants/config";
import { readJson, writeJson } from "./asyncStorageAdapter";

export type ThemePreference = "system" | "light" | "dark";

export interface Settings {
  readonly theme: ThemePreference;
  readonly autoplayDefault: boolean;
}

const DEFAULTS: Settings = { theme: "system", autoplayDefault: true };
const THEMES: readonly ThemePreference[] = ["system", "light", "dark"];

function isSettings(value: unknown): value is Settings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Settings>;
  return (
    typeof candidate.theme === "string" &&
    THEMES.includes(candidate.theme) &&
    typeof candidate.autoplayDefault === "boolean"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export async function readSettings(): Promise<Settings> {
  return readJson(STORAGE_KEYS.settings, isSettings, DEFAULTS);
}

export async function writeSettings(settings: Settings): Promise<void> {
  await writeJson(STORAGE_KEYS.settings, settings);
}

export async function readRecentSearches(): Promise<string[]> {
  return readJson(STORAGE_KEYS.recentSearches, isStringArray, []);
}

export async function writeRecentSearches(queries: readonly string[]): Promise<void> {
  // Bounded so the key cannot grow without limit.
  await writeJson(STORAGE_KEYS.recentSearches, queries.slice(0, LIMITS.recentSearchesMax));
}
```

- [ ] **Step 6: Run the tests**

Run:
```bash
npm test -- --testPathPattern=storage
```
Expected: all 13 pass.

- [ ] **Step 7: Commit**

```bash
git add services/storage __tests__/services/storage.test.ts
git commit -m "feat: add versioned, guarded device storage

One AsyncStorage importer behind readJson/writeJson. Every read validates
shape and falls back rather than throwing, so a payload from an older build
or a corrupted key cannot crash a render.

Verified: npm test -- --testPathPattern=storage => 13 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Content source config and HTTP client

**Files:**
- Create: `services/contentSourceConfig.ts`
- Create: `services/httpClient.ts`
- Modify: `app.json` (add the `extra` block)
- Test: `__tests__/services/httpClient.test.ts`

**Interfaces:**
- Produces: `getContentSourceConfig()` and `httpGet<T>()` as declared in LLD index section 5.6.

- [ ] **Step 1: Add the config block to `app.json`**

Inside the `"expo"` object, after `"experiments"`, add:

```json
    "extra": {
      "contentMode": "development",
      "apiBaseUrl": "https://api.yagna.example",
      "allowedMediaHosts": [],
      "liveSourceFallback": "youtube"
    }
```

`allowedMediaHosts` empty means "no host restriction", which is correct while the production host is unknown. Increment 7 fills it in. Nothing here is a secret; do not put a key, token, or credential in `extra`, because it ships readable inside the app bundle.

- [ ] **Step 2: Create `services/contentSourceConfig.ts`**

```ts
// services/contentSourceConfig.ts
/**
 * Build-time switch between demo content and a real API.
 * Nothing outside services/ knows which is active.
 */
import Constants from "expo-constants";

export type ContentMode = "production" | "development";

export interface ContentSourceConfig {
  readonly mode: ContentMode;
  readonly apiBaseUrl: string;
  readonly allowedMediaHosts: readonly string[];
  readonly liveSourceFallback: "youtube" | "none";
}

const FALLBACK: ContentSourceConfig = {
  mode: "development",
  apiBaseUrl: "",
  allowedMediaHosts: [],
  liveSourceFallback: "none",
};

export function getContentSourceConfig(): ContentSourceConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

  const mode: ContentMode = extra.contentMode === "production" ? "production" : "development";
  const apiBaseUrl = typeof extra.apiBaseUrl === "string" ? extra.apiBaseUrl : FALLBACK.apiBaseUrl;
  const allowedMediaHosts = Array.isArray(extra.allowedMediaHosts)
    ? extra.allowedMediaHosts.filter((h): h is string => typeof h === "string")
    : [];
  const liveSourceFallback = extra.liveSourceFallback === "youtube" ? "youtube" : "none";

  return { mode, apiBaseUrl, allowedMediaHosts, liveSourceFallback };
}
```

- [ ] **Step 3: Write the failing HTTP client test**

Create `__tests__/services/httpClient.test.ts`:

```ts
// __tests__/services/httpClient.test.ts
import { httpGet } from "../../services/httpClient";
import { TIMING } from "../../constants/config";

jest.mock("../../services/contentSourceConfig", () => ({
  getContentSourceConfig: () => ({
    mode: "production",
    apiBaseUrl: "https://api.test",
    allowedMediaHosts: [],
    liveSourceFallback: "none",
  }),
}));

interface Payload {
  readonly id: string;
}
const isPayload = (v: unknown): v is Payload =>
  typeof v === "object" && v !== null && typeof (v as Payload).id === "string";

describe("httpGet", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("returns parsed data that satisfies the guard", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "abc" }),
    }) as unknown as typeof fetch;

    await expect(httpGet({ path: "/videos/abc", guard: isPayload })).resolves.toEqual({ id: "abc" });
  });

  it("requests the configured base url over https", async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "a" }) });
    global.fetch = spy as unknown as typeof fetch;

    await httpGet({ path: "/videos/a", guard: isPayload });
    const requested = String(spy.mock.calls[0][0]);
    expect(requested.startsWith("https://api.test")).toBe(true);
  });

  it("maps a 404 to not_found", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(httpGet({ path: "/missing", guard: isPayload })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("maps a 500 to unknown", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(httpGet({ path: "/boom", guard: isPayload })).rejects.toMatchObject({
      code: "unknown",
    });
  });

  it("maps a thrown fetch to network", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;
    await expect(httpGet({ path: "/a", guard: isPayload })).rejects.toMatchObject({
      code: "network",
    });
  });

  it("maps an abort to timeout", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    global.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    await expect(httpGet({ path: "/a", guard: isPayload })).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("rejects a response that fails the guard", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ wrong: true }),
    }) as unknown as typeof fetch;

    await expect(httpGet({ path: "/a", guard: isPayload })).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("uses the configured timeout", () => {
    expect(TIMING.httpTimeoutMs).toBe(10_000);
  });
});
```

- [ ] **Step 4: Implement the client**

Create `services/httpClient.ts`:

```ts
// services/httpClient.ts
/**
 * The only module in the app that calls fetch.
 *
 * Every response is shape-checked before it is returned, so a malformed or
 * hostile payload cannot reach a component. Every failure becomes an AppError.
 */
import { TIMING } from "../constants/config";
import Logger from "../utils/Logger";
import { makeError } from "./appError";
import { getContentSourceConfig } from "./contentSourceConfig";

export interface HttpGetOptions<T> {
  readonly path: string;
  readonly guard: (value: unknown) => value is T;
  readonly signal?: AbortSignal;
}

function statusToCode(status: number): "not_found" | "unknown" {
  return status === 404 ? "not_found" : "unknown";
}

export async function httpGet<T>({ path, guard, signal }: HttpGetOptions<T>): Promise<T> {
  const { apiBaseUrl } = getContentSourceConfig();
  const url = `${apiBaseUrl}${path}`;

  if (!url.startsWith("https://")) {
    // Never fall back to cleartext, even if the config is wrong.
    throw makeError("invalid_source");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMING.httpTimeoutMs);

  // Honour a caller's cancellation as well as our own timeout.
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      Logger.warn("[Http]", `GET ${path} returned ${response.status}`);
      throw makeError(statusToCode(response.status));
    }

    const body: unknown = await response.json();
    if (!guard(body)) {
      Logger.warn("[Http]", `GET ${path} returned an unexpected shape`);
      throw makeError("validation");
    }
    return body;
  } catch (caught) {
    // Re-throw an AppError we produced above unchanged.
    if (typeof caught === "object" && caught !== null && "code" in caught) {
      throw caught;
    }
    if (caught instanceof Error && caught.name === "AbortError") {
      throw makeError("timeout", caught);
    }
    throw makeError("network", caught);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
```

- [ ] **Step 5: Run the tests**

Run:
```bash
npm test -- --testPathPattern=httpClient
```
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add services/contentSourceConfig.ts services/httpClient.ts app.json __tests__/services/httpClient.test.ts
git commit -m "feat: add content source config and the HTTPS-only http client

One fetch caller, with a timeout, caller-cancellation support, status-to-code
mapping, and a mandatory shape guard so no unchecked payload reaches a
component. Cleartext URLs are refused even if misconfigured.

Verified: npm test -- --testPathPattern=httpClient => 8 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Demo content provider and content service

**Files:**
- Create: `services/demoContentProvider.ts`
- Create: `services/contentService.ts`
- Test: `__tests__/services/contentService.test.ts`

**Interfaces:**
- Produces the six `contentService` functions from LLD index section 5.6. Increments 2, 3, 4, and 6 all consume them.

**Why a demo provider:** `app/video/[id].tsx` holds a hard-coded `SAFE_VIDEO_CATALOG` today, and `services/videoService.ts` holds `MOCK_VIDEOS`. Both are demo data living in production paths. Moving them behind the config switch is the fix for the HLD's architecture issue C.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/contentService.test.ts`:

```ts
// __tests__/services/contentService.test.ts
import {
  getFeatured,
  getLatest,
  getVideoById,
  getVideosByIds,
  getRelated,
  search,
} from "../../services/contentService";
import { isAppError } from "../../services/appError";
import { LIMITS } from "../../constants/config";

jest.mock("../../services/contentSourceConfig", () => ({
  getContentSourceConfig: () => ({
    mode: "development",
    apiBaseUrl: "",
    allowedMediaHosts: [],
    liveSourceFallback: "youtube",
  }),
}));

describe("contentService in development mode", () => {
  it("returns a featured video", async () => {
    const featured = await getFeatured();
    expect(featured).not.toBeNull();
    expect(typeof featured?.id).toBe("string");
  });

  it("returns a first page no larger than the configured page size", async () => {
    const { videos, hasMore } = await getLatest(0);
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.length).toBeLessThanOrEqual(LIMITS.feedPageSize);
    expect(typeof hasMore).toBe("boolean");
  });

  it("returns a different page for a different index", async () => {
    const first = await getLatest(0);
    const second = await getLatest(1);
    if (second.videos.length > 0) {
      expect(second.videos[0].id).not.toBe(first.videos[0].id);
    }
  });

  it("returns an empty page past the end rather than throwing", async () => {
    const { videos, hasMore } = await getLatest(9999);
    expect(videos).toEqual([]);
    expect(hasMore).toBe(false);
  });

  it("finds a video by id", async () => {
    const { videos } = await getLatest(0);
    const found = await getVideoById(videos[0].id);
    expect(found.id).toBe(videos[0].id);
  });

  it("rejects an unknown id with not_found instead of falling back", async () => {
    try {
      await getVideoById("no-such-id");
      throw new Error("should have rejected");
    } catch (e) {
      expect(isAppError(e) && e.code).toBe("not_found");
    }
  });

  it("rejects an empty id with validation", async () => {
    try {
      await getVideoById("   ");
      throw new Error("should have rejected");
    } catch (e) {
      expect(isAppError(e) && e.code).toBe("validation");
    }
  });

  it("hydrates a list of ids and silently omits the ones it cannot find", async () => {
    const { videos } = await getLatest(0);
    const result = await getVideosByIds([videos[0].id, "missing", videos[1].id]);
    expect(result.map((v) => v.id)).toEqual([videos[0].id, videos[1].id]);
  });

  it("preserves the caller's order when hydrating ids", async () => {
    const { videos } = await getLatest(0);
    const result = await getVideosByIds([videos[2].id, videos[0].id]);
    expect(result.map((v) => v.id)).toEqual([videos[2].id, videos[0].id]);
  });

  it("returns an empty list for no ids without calling through", async () => {
    await expect(getVideosByIds([])).resolves.toEqual([]);
  });

  it("returns related videos that exclude the current one", async () => {
    const { videos } = await getLatest(0);
    const related = await getRelated(videos[0].id);
    expect(related.every((v) => v.id !== videos[0].id)).toBe(true);
    expect(related.length).toBeLessThanOrEqual(LIMITS.relatedCount);
  });

  it("matches a search query case-insensitively", async () => {
    const { videos } = await getLatest(0);
    const word = videos[0].title.split(" ")[0];
    const { videos: hits } = await search(word.toLowerCase(), 0);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("returns no results for a query that matches nothing", async () => {
    const { videos } = await search("zzzzzzzznomatch", 0);
    expect(videos).toEqual([]);
  });

  it("rejects a query shorter than the minimum with validation", async () => {
    try {
      await search("a", 0);
      throw new Error("should have rejected");
    } catch (e) {
      expect(isAppError(e) && e.code).toBe("validation");
    }
  });

  it("gives every video a source the resolver can accept", async () => {
    const { videos } = await getLatest(0);
    for (const video of videos) {
      expect(["hls", "mp4", "youtube"]).toContain(video.source.kind);
      expect(video.source.url.startsWith("https://")).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=contentService
```
Expected: module-not-found.

- [ ] **Step 3: Create the demo provider**

Create `services/demoContentProvider.ts`. It exports one constant, `DEMO_VIDEOS: Video[]`, of at least 12 entries so the pagination and related tests have room.

Build it by converting the existing `MOCK_VIDEOS` in `services/videoService.ts` into the `Video` shape from `types/domain`. The field mapping is:

| Old `VideoMetadata` | New `Video` |
|---|---|
| `videoUrl` | `source.url`, with `source.kind` set to `"hls"` when the URL ends in `.m3u8`, else `"mp4"` |
| `duration` | `durationSec` |
| `views` | `viewCount` |
| `uploadedAt` | `publishedAt` |
| `channelName`, `channelAvatar`, `channelId` | `channel: { id, name, avatarUrl }` |
| `thumbnailUrl`, `title`, `description`, `captions`, `chapters`, `tags` | unchanged |
| — | `isLive: false` for all demo videos |

Every `source.url` must be `https://`. The two known-good streams already in the repo are `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` (HLS) and `https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4` (MP4).

Add a header comment stating that this file is demo data, is never reached when `mode` is `production`, and must not be imported outside `services/`.

- [ ] **Step 4: Create the content service**

Create `services/contentService.ts`. Every function branches on `getContentSourceConfig().mode`:

- In `development`, read from `DEMO_VIDEOS`.
- In `production`, call `httpGet` with a shape guard.

Required behavior, each covered by a test above:

- `getVideoById` rejects `makeError("validation")` for an empty or whitespace id, and `makeError("not_found")` for an id that does not exist. **It must not fall back to the first entry**, which is what `app/video/[id].tsx` does today.
- `getVideosByIds` returns results in the caller's order, omits ids it cannot find, and returns `[]` for an empty input without touching the data source.
- `getRelated` excludes the requested id and returns at most `LIMITS.relatedCount`.
- `search` rejects `makeError("validation")` below `LIMITS.searchQueryMinLength`, trims, strips control characters, caps at `LIMITS.searchQueryMaxLength`, and matches case-insensitively on title and description.
- `getLatest` pages by `LIMITS.feedPageSize` and returns `{ videos: [], hasMore: false }` past the end.

Write a `isVideoResponse` style guard for each production path. Do not use `any`.

- [ ] **Step 5: Run the tests**

Run:
```bash
npm test -- --testPathPattern=contentService
```
Expected: all 15 pass.

- [ ] **Step 6: Verify nothing outside services imports the demo data**

Run:
```bash
grep -rn "demoContentProvider\|DEMO_VIDEOS" app components contexts hooks | grep -v node_modules
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add services/demoContentProvider.ts services/contentService.ts __tests__/services/contentService.test.ts
git commit -m "feat: add content service with a build-time demo switch

Demo data moves out of the video screen and behind contentSourceConfig, so
production builds cannot reach it. Unknown ids now reject with not_found
instead of silently falling back to the first catalogue entry.

Verified: npm test -- --testPathPattern=contentService => 15 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The shared hook status machine

**Files:**
- Create: `hooks/useLoadable.ts`
- Test: `__tests__/hooks/useLoadable.test.tsx`

**Interfaces:**
- Produces: `useLoadable<T>({ load, isEmpty, enabled }): Loadable<T>`. Every feature hook in Increments 2 through 6 is built on it.

**Why one shared machine:** stale-response handling, unmount cancellation, and error-to-status mapping are easy to get subtly wrong. Writing them once and testing them hard means seven feature hooks inherit correct behavior instead of each reinventing it.

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useLoadable.test.tsx`:

```tsx
// __tests__/hooks/useLoadable.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useLoadable } from "../../hooks/useLoadable";
import { makeError } from "../../services/appError";

describe("useLoadable", () => {
  it("moves from loading to success", async () => {
    const load = jest.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useLoadable({ load }));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(["a"]);
    expect(result.current.error).toBeNull();
  });

  it("reports empty when the isEmpty predicate matches", async () => {
    const load = jest.fn().mockResolvedValue([]);
    const { result } = renderHook(() =>
      useLoadable({ load, isEmpty: (d: unknown[]) => d.length === 0 }),
    );
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("maps a network error to the offline status", async () => {
    const load = jest.fn().mockRejectedValue(makeError("network"));
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("offline"));
    expect(result.current.error?.code).toBe("network");
  });

  it("maps any other error to the error status", async () => {
    const load = jest.fn().mockRejectedValue(makeError("not_found"));
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("not_found");
  });

  it("wraps a raw thrown error as unknown rather than leaking it", async () => {
    const load = jest.fn().mockRejectedValue(new Error("raw"));
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("unknown");
  });

  it("stays idle and does not call load when disabled", async () => {
    const load = jest.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useLoadable({ load, enabled: false }));
    expect(result.current.status).toBe("idle");
    expect(load).not.toHaveBeenCalled();
  });

  it("re-runs load when retry is called", async () => {
    const load = jest.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useLoadable({ load }));
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => result.current.retry());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("ignores a slow first response when a second has already resolved", async () => {
    let resolveFirst: (v: string) => void = () => {};
    const first = new Promise<string>((r) => {
      resolveFirst = r;
    });

    const load = jest
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce("second");

    const { result } = renderHook(() => useLoadable({ load }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toBe("second"));

    // The stale first request now lands. It must not overwrite the newer data.
    await act(async () => {
      resolveFirst("first");
      await first;
    });
    expect(result.current.data).toBe("second");
  });

  it("does not set state after unmount", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    let resolveLoad: (v: string) => void = () => {};
    const pending = new Promise<string>((r) => {
      resolveLoad = r;
    });

    const { unmount } = renderHook(() => useLoadable({ load: () => pending }));
    unmount();

    await act(async () => {
      resolveLoad("late");
      await pending;
    });

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("state update on an unmounted"),
    );
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=useLoadable
```
Expected: module-not-found.

- [ ] **Step 3: Create the hook**

Copy LLD index section 5.5 verbatim into `hooks/useLoadable.ts`.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=useLoadable
```
Expected: 9 passed.

The stale-response and unmount tests are the important ones. If either fails, the bug is in `requestIdRef` or `mountedRef` handling, not in the test.

- [ ] **Step 5: Commit**

```bash
git add hooks/useLoadable.ts __tests__/hooks/useLoadable.test.tsx
git commit -m "feat: add the shared loadable status machine

Owns the stale-response guard, unmount cancellation, and error-to-status
mapping once, so the seven feature hooks that follow inherit correct
behaviour instead of each reimplementing it.

Verified: npm test -- --testPathPattern=useLoadable => 9 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Shared UI components

**Files:**
- Create: `components/ui/Screen.tsx`
- Create: `components/ui/StateView.tsx`
- Create: `components/ui/Skeleton.tsx`
- Create: `components/ui/PrimaryButton.tsx`
- Create: `components/ui/IconButton.tsx`
- Test: `__tests__/components/StateView.test.tsx`

**Interfaces:**
- Consumes: `tokens`, `getColors` from `constants/tokens`; `LoadStatus`, `AppError` from `types/result`.
- Produces: `Screen`, `StateView`, `Skeleton`, `PrimaryButton`, `IconButton`. Every screen in Increments 2 through 6 uses `Screen` and `StateView`.

- [ ] **Step 1: Write the failing StateView test**

Create `__tests__/components/StateView.test.tsx`:

```tsx
// __tests__/components/StateView.test.tsx
import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StateView } from "../../components/ui/StateView";
import { makeError } from "../../services/appError";

describe("StateView", () => {
  it("renders nothing when idle", () => {
    render(<StateView status="idle" testID="sv" />);
    expect(screen.queryByTestId("sv")).toBeNull();
  });

  it("renders nothing when successful, because the caller renders content", () => {
    render(<StateView status="success" testID="sv" />);
    expect(screen.queryByTestId("sv")).toBeNull();
  });

  it("renders a spinner while loading", () => {
    render(<StateView status="loading" testID="sv" />);
    expect(screen.getByTestId("sv-loading")).toBeTruthy();
  });

  it("renders a supplied skeleton instead of the spinner", () => {
    render(
      <StateView status="loading" testID="sv" loadingSkeleton={<Text>bones</Text>} />,
    );
    expect(screen.getByText("bones")).toBeTruthy();
  });

  it("shows the empty title and hint", () => {
    render(
      <StateView status="empty" testID="sv" emptyTitle="Nothing saved" emptyHint="Tap Save" />,
    );
    expect(screen.getByText("Nothing saved")).toBeTruthy();
    expect(screen.getByText("Tap Save")).toBeTruthy();
  });

  it("shows the error message from the AppError, not a hard-coded string", () => {
    const error = makeError("not_found");
    render(<StateView status="error" error={error} testID="sv" />);
    expect(screen.getByText(error.message)).toBeTruthy();
  });

  it("shows the offline message from the AppError", () => {
    const error = makeError("network");
    render(<StateView status="offline" error={error} testID="sv" />);
    expect(screen.getByText(error.message)).toBeTruthy();
  });

  it("calls onRetry when the retry button is pressed", () => {
    const onRetry = jest.fn();
    render(<StateView status="error" error={makeError("unknown")} onRetry={onRetry} testID="sv" />);
    fireEvent.press(screen.getByTestId("sv-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when no handler is given", () => {
    render(<StateView status="error" error={makeError("unknown")} testID="sv" />);
    expect(screen.queryByTestId("sv-retry")).toBeNull();
  });

  it("exposes the retry button to assistive technology", () => {
    render(<StateView status="error" error={makeError("unknown")} onRetry={jest.fn()} testID="sv" />);
    const retry = screen.getByTestId("sv-retry");
    expect(retry.props.accessibilityRole).toBe("button");
    expect(typeof retry.props.accessibilityLabel).toBe("string");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
npm test -- --testPathPattern=StateView
```
Expected: module-not-found.

- [ ] **Step 3: Build the five components**

Each reads colours through `getColors(useColorScheme() === "dark" ? "dark" : "light")` and sizes through `tokens`. None may hard-code a colour or a number.

`StateView` must follow exactly the render rules in LLD index section 5.8, and the test above pins them: `idle` and `success` render `null`; `loading` renders `loadingSkeleton` or a spinner with `testID` suffix `-loading`; `empty` renders `emptyTitle` and `emptyHint`; `error` and `offline` render `error.message` and, when `onRetry` is supplied, a pressable with `testID` suffix `-retry`, `accessibilityRole="button"`, and an `accessibilityLabel`.

`Screen` wraps children in a `View` using `useSafeAreaInsets()` from `react-native-safe-area-context` and the `background` colour.

`Skeleton` renders a `View` with the `skeleton` colour, a `radius.sm` corner, and `width`/`height` props.

`PrimaryButton` and `IconButton` each enforce `tokens.touchTarget.min` as their minimum height and width, take `accessibilityLabel` as a required prop, and accept `onPress`, `disabled`, and `testID`.

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- --testPathPattern=StateView
```
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add components/ui __tests__/components/StateView.test.tsx
git commit -m "feat: add shared Screen, StateView, Skeleton, and button components

StateView renders loading, empty, error, and offline from one status prop
so every screen presents the same states the same way, and always shows the
AppError message rather than a hard-coded string.

Verified: npm test -- --testPathPattern=StateView => 10 passed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Remove the stray theme test files

**Files:**
- Delete: `ThemeTest.tsx` (repository root)
- Delete: `constants/ThemeTest.tsx`

**Why:** both are leftover scratch components in production folders. The root one contributes a lint error (`import/no-unresolved` for `./theme`) and a type error. Neither is reachable from any route.

- [ ] **Step 1: Confirm neither is imported**

Run:
```bash
grep -rn "ThemeTest" app components contexts hooks services utils __tests__ --include=*.ts --include=*.tsx
```
Expected: no output. If there is output, stop and report.

- [ ] **Step 2: Delete them**

```bash
git rm ThemeTest.tsx constants/ThemeTest.tsx
```

- [ ] **Step 3: Verify the counts improved**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx eslint . --ext .js,.jsx,.ts,.tsx 2>&1 | tail -3
npm test
```
Expected: two fewer type errors, one fewer lint error, and a green suite.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove stray ThemeTest scratch components

Neither was reachable from any route; the root copy imported a nonexistent
./theme module and contributed one lint and one type error.

Verified: npm test => all suites pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Exit Criteria

- [ ] `npm test` passes, with new suites for appError, tokens, mediaSourceResolver, storage, httpClient, contentService, useLoadable, and StateView.
- [ ] `npx tsc --noEmit` reports no errors in any file created by this increment.
- [ ] `grep -rn "AsyncStorage" --include=*.ts --include=*.tsx app components contexts hooks services utils` returns only `services/storage/asyncStorageAdapter.ts`.
- [ ] `grep -rn "fetch(" --include=*.ts --include=*.tsx services` returns only `services/httpClient.ts`.
- [ ] No file created here imports React inside `services/`.
- [ ] No screen, navigation, or player file was modified.
