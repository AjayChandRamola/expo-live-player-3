// File: app/video/[id].tsx
// -----------------------------------------------------------------------------
// Production-grade dynamic video screen using Expo Router.
// - Strictly Expo Managed Workflow (no native modules).
// - Clean architecture, defensive programming, thorough validation & logs.
// - Works with local catalog OR safe URL passed via query (?url=...).
// - Zero-trust: validates all inputs, never trusts route params blindly.
// - Accessible, responsive, and performant.
// -----------------------------------------------------------------------------

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Linking,
  useColorScheme,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import VideoPlayer from "../../components/VideoPlayer";
import UpNextList from "../../components/VideoFeed/UpNextList";
import { useVideoPlayerContext } from "../../contexts/VideoPlayerContext";
import { HomeVideoCommentsModal } from "../../components/Comments/Home";
import Logger from "../../utils/Logger";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ------------------------------- Types ---------------------------------------

type ChapterItem = { title: string; startMs: number };
type CaptionItem = { start: number; end?: number; text: string };
type CatalogEntry = {
  id: string;
  title: string;
  url: string;
  description?: string;
  chapters?: ChapterItem[];
  captions?: CaptionItem[];
};

type RouteParams = {
  id?: string;
  url?: string; // optional direct media URL (?url=...)
  title?: string; // optional title override
};

// ---------------------------- Constants & Config -----------------------------

/**
 * SAFE_VIDEO_CATALOG
 * Local, non-secret, non-PII demo catalog. In production, this can be fetched
 * from a secure backend (e.g., Supabase, Firebase, GraphQL).
 */
const SAFE_VIDEO_CATALOG: CatalogEntry[] = [
  {
    id: "1",
    title: "Yagna & Nature Balance",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    description:
      "How Yagna (Vedic fire ritual) harmonizes the five elements and supports ecological balance.",
    chapters: [
      { title: "Opening", startMs: 0 },
      { title: "Offerings & Intent", startMs: 60_000 },
      { title: "Closing Mantras", startMs: 180_000 },
    ],
    captions: [
      { start: 0, end: 6000, text: "Welcome to the Yagna Satsang." },
      { start: 6000, end: 12000, text: "Invoking divinity and inner purity." },
    ],
  },
  {
    id: "2",
    title: "Gayatri Mantra Chant",
    url: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    description:
      "Meditative exposition of Gayatri chanting — resonance, breath, and devotion.",
    chapters: [
      { title: "Intro", startMs: 0 },
      { title: "Chant Cycle 1", startMs: 45_000 },
      { title: "Chant Cycle 2", startMs: 120_000 },
    ],
  },
] as const;

/** Allowed URL schemes for direct playback. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Allowed media hints to reduce risk; you can expand as needed. */
const ALLOWED_MEDIA_HINTS = [
  ".m3u8", // HLS
  ".mp4",
  ".mpd", // DASH (if you handle it elsewhere)
];

// ----------------------------- Utility Guards --------------------------------

/**
 * isNonEmptyString
 * Tiny guard to validate incoming params.
 */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * isSafeMediaUrl
 * Validates that a URL is safe to attempt to load in the player.
 * - Must be http/https
 * - Should end with a known media hint (best-effort heuristic)
 */
function isSafeMediaUrl(candidate: unknown): candidate is string {
  if (!isNonEmptyString(candidate)) return false;
  try {
    const u = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
      Logger.warn(`[Security] Blocked URL with unsupported protocol: ${u.protocol}`);
      return false;
    }
    // Heuristic: path should end with known media hints
    const lowerPath = u.pathname.toLowerCase();
    const ok = ALLOWED_MEDIA_HINTS.some((ext) => lowerPath.endsWith(ext));
    if (!ok) {
      Logger.warn(
        `[Security] URL does not appear to be a direct media resource: ${candidate}`
      );
    }
    return ok;
  } catch (e) {
    Logger.warn(`[Validation] Invalid URL provided: ${String(candidate)}`);
    return false;
  }
}

/**
 * safeGetCatalogEntry
 * Finds a catalog entry by id. Returns undefined if not found.
 */
function safeGetCatalogEntry(id?: string): CatalogEntry | undefined {
  if (!isNonEmptyString(id)) return undefined;
  return SAFE_VIDEO_CATALOG.find((x) => x.id === id.trim());
}

/**
 * sanitizeTitle
 * Prevents accidental injection of control chars; trims length.
 */
function sanitizeTitle(t?: string): string | undefined {
  if (!isNonEmptyString(t)) return undefined;
  const cleaned = t.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned.slice(0, 200);
}

// ------------------------------ Screen Component -----------------------------

export default function VideoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<RouteParams>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  // Safe area insets for preventing overlap with system navigation
  const insets = useSafeAreaInsets();

  // Global state from context
  const videoContext = useVideoPlayerContext();
  const {
    videoList,
    currentIndex,
    currentVideo,
    playVideoAtIndex,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    isAutoplayEnabled,
  } = videoContext;

  // Local UI state
  const [resolved, setResolved] = useState<{
    title: string;
    url: string;
    chapters?: ChapterItem[];
    captions?: CaptionItem[];
    description?: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  
  // Minimize/PiP state
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Comments modal state
  const [showComments, setShowComments] = useState<boolean>(false);

  // Watch for global context changes (Next/Previous navigation)
  useEffect(() => {
    if (currentVideo) {
      Logger.info(`[Sync] Global currentVideo changed to: "${currentVideo.title}"`);
      
      setResolved({
        title: currentVideo.title,
        url: currentVideo.videoUrl,
        chapters: currentVideo.chapters,
        captions: currentVideo.captions,
        description: currentVideo.description,
      });
      
      setInitializing(false);
      setError(null);
    }
  }, [currentVideo]);

  // Resolve video source based on:
  // 1) Global context (if video already selected from Home)
  // 2) Safe direct ?url=... (if provided and validated)
  // 3) Catalog by id
  // 4) Fallback to first catalog entry
  useEffect(() => {
    // Skip if currentVideo is already set from global context
    if (currentVideo) {
      Logger.info(`[Resolve] Using currentVideo from global context: "${currentVideo.title}"`);
      return;
    }

    (async () => {
      setInitializing(true);
      setError(null);
      try {
        const rawId = isNonEmptyString(params.id) ? params.id.trim() : undefined;
        const rawUrl = params.url;
        const rawTitle = sanitizeTitle(params.title);

        Logger.info(`[Router] Enter /video/[id] with params: ${JSON.stringify(params)}`);

        // Prefer safe direct URL if provided
        if (isSafeMediaUrl(rawUrl)) {
          const pickedTitle =
            rawTitle ||
            (rawId ? `Video ${rawId}` : "External Media"); // fallback title for direct URLs

          setResolved({
            title: pickedTitle,
            url: rawUrl!,
          });

          Logger.info(`[Resolve] Using direct URL param for playback.`);
          return;
        }

        // Else, resolve via catalog by id
        const entry = safeGetCatalogEntry(rawId) ?? SAFE_VIDEO_CATALOG[0];
        if (!entry) {
          throw new Error("No available catalog entries to play.");
        }

        setResolved({
          title: rawTitle || entry.title,
          url: entry.url,
          chapters: entry.chapters,
          captions: entry.captions,
          description: entry.description,
        });

        Logger.info(
          `[Resolve] Using catalog entry id="${
            rawId ?? entry.id
          }", title="${rawTitle || entry.title}"`
        );
      } catch (e: any) {
        const msg = e?.message || "Unknown error resolving video source.";
        Logger.error(`[Error][Resolve] ${msg}`);
        setError(msg);
      } finally {
        setInitializing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.url, params.title]);

  // Header config with back button & title (Expo Router Stack)
  const headerTitle = useMemo(() => resolved?.title ?? "Video", [resolved?.title]);

  const onHelpPress = useCallback(() => {
    Alert.alert(
      "Help",
      "You can pass a direct media URL as a query parameter (?url=...) or use known IDs from the local catalog (1, 2). Only safe http/https URLs ending with .m3u8 or .mp4 are allowed.",
      [
        { text: "Docs (Expo Router)", onPress: () => Linking.openURL("https://expo.dev/router") },
        { text: "OK" },
      ],
      { cancelable: true }
    );
  }, []);

  // Navigation handlers using global context
  const handlePreviousVideo = useCallback(() => {
    const success = playPrevious();
    if (!success) {
      Logger.info("[Navigation] No previous video (at start of list)");
    }
  }, [playPrevious]);

  const handleNextVideo = useCallback(() => {
    const success = playNext();
    if (!success) {
      Logger.info("[Navigation] No next video (at end of list)");
    }
  }, [playNext]);

  // Handle Up Next item press
  const handleUpNextPress = useCallback(
    (video: VideoMetadata, index: number) => {
      Logger.info(`[UpNext] Selected video at index ${index}: "${video.title}"`);
      playVideoAtIndex(index);
    },
    [playVideoAtIndex]
  );
  
  // Log removal of video index panel
  useEffect(() => {
    Logger.info("[UI] removed_video_index_panel", {
      videoId: currentVideo?.id || "unknown",
      removedComponent: "Video X of Y banner",
    });
  }, [currentVideo?.id]);
  
  // Log safe area detection for video screen
  useEffect(() => {
    if (insets.bottom > 0) {
      Logger.info("[UI] safe_area_bottom_detected", {
        screen: "VideoScreen",
        bottom: insets.bottom,
        left: insets.left,
        right: insets.right,
        top: insets.top,
        platform: Platform.OS,
        appliedPadding: insets.bottom,
      });
    }
  }, [insets.bottom, insets.left, insets.right, insets.top]);

  // Toggle minimize/restore
  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
    Logger.info(`[Player] Video ${isMinimized ? "restored" : "minimized"}`);
  }, [isMinimized]);

  // Handle video finished (autoplay logic)
  const handleVideoFinished = useCallback(() => {
    if (isAutoplayEnabled && hasNext) {
      Logger.info("[Autoplay] Video finished, playing next video");
      playNext();
    } else {
      Logger.info("[Autoplay] Video finished, autoplay disabled or no next video");
    }
  }, [isAutoplayEnabled, hasNext, playNext]);

  // ------------------------------- Render ------------------------------------

  if (initializing) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Loading…",
            headerBackTitleVisible: false,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Preparing your video…</Text>
        </View>
      </>
    );
  }

  if (error || !resolved?.url) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Error",
            headerBackTitleVisible: false,
          }}
        />
        <View style={styles.errorWrap} accessibilityLabel="Playback error screen">
          <Text style={styles.errorTitle}>Unable to load video</Text>
          <Text style={styles.errorBody}>
            {error ??
              "We couldn't resolve a playable source. Check your link or try another video."}
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace("/")}
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
          >
            <Text style={styles.primaryBtnText}>Go Home</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, { marginTop: 8 }]}
            onPress={onHelpPress}
            accessibilityRole="button"
            accessibilityLabel="Open help"
          >
            <Text style={styles.secondaryBtnText}>Help</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // Happy path
  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerBackTitleVisible: false,
          headerRight: () => (
            <Pressable
              onPress={onHelpPress}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Help"
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ color: "#0ea5ff", fontWeight: "600" }}>Help</Text>
            </Pressable>
          ),
        }}
      />

      <View 
        style={[
          styles.container,
          // Apply bottom safe area padding to prevent overlap with system navigation
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 0 }
        ]}
      >
        {/* Video Player - Full or Minimized */}
        <View style={isMinimized ? styles.minimizedVideoContainer : styles.fullVideoContainer}>
          <VideoPlayer
          // Key forces remount when video changes (critical for loading new videos)
          key={`video-${currentVideo?.id || resolved.url}`}
          // Strict props; VideoPlayer itself contains additional guards & logs.
          sourceUrl={resolved.url}
          captions={resolved.captions}
          chapters={resolved.chapters}
          autoplay
          hideControlsTimeout={3000}
          theme="system"
          onFullscreenChange={(full) => {
            Logger.info(`[Player] Fullscreen changed: ${full}`);
          }}
          // Navigation props from global context
          hasPreviousVideo={hasPrevious}
          hasNextVideo={hasNext}
          onNavigateToPrevious={handlePreviousVideo}
          onNavigateToNext={handleNextVideo}
          // Minimize props
          isMinimized={isMinimized}
          onToggleMinimize={handleToggleMinimize}
          // Autoplay props
          isAutoplayEnabled={isAutoplayEnabled}
          onVideoFinished={handleVideoFinished}
          // Video metadata for actions
          videoId={currentVideo?.id}
          videoTitle={currentVideo?.title}
          videoUrl={currentVideo?.videoUrl}
          channelId={currentVideo?.channelId}
        />
        </View>

        {/* Minimized state overlay message */}
        {isMinimized && (
          <View style={styles.minimizedOverlay}>
            <Text style={styles.minimizedTitle}>📺 Video playing in mini player</Text>
            <Text style={styles.minimizedText}>
              Video minimized to bottom-right corner. Tap the video or the restore button (˅) to expand.
            </Text>
            <Pressable
              style={styles.restoreBtn}
              onPress={handleToggleMinimize}
              accessibilityRole="button"
              accessibilityLabel="Restore video to full screen"
            >
              <Text style={styles.restoreBtnText}>↑ Restore to Full Screen</Text>
            </Pressable>
          </View>
        )}

        {/* Meta / Description */}
        {(resolved.title || resolved.description) && (
          <ScrollView
            style={styles.meta}
            contentContainerStyle={{ paddingBottom: 24 }}
            accessibilityLabel="Video description"
          >

            {resolved.title ? (
              <Text style={styles.title} numberOfLines={2}>
                {resolved.title}
              </Text>
            ) : null}
            {resolved.description ? (
              <Text style={styles.desc}>{resolved.description}</Text>
            ) : null}

            {/* Comments Button */}
            {currentVideo?.id && (
              <Pressable
                style={styles.commentsButton}
                onPress={() => {
                  setShowComments(true);
                  Logger.info(`[VideoScreen] Opening comments for video ${currentVideo.id}`);
                }}
                accessible
                accessibilityLabel="View comments"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="comment-outline" size={20} color="#FFFFFF" />
                <Text style={styles.commentsButtonText}>Comments</Text>
              </Pressable>
            )}

            {/* Up Next Video List */}
            {videoList.length > 0 && (
              <UpNextList
                videos={videoList}
                currentVideoId={currentVideo?.id || null}
                onVideoPress={handleUpNextPress}
                maxItems={20}
              />
            )}
          </ScrollView>
        )}

        {/* Comments Modal */}
        {currentVideo?.id && (
          <HomeVideoCommentsModal
            videoId={currentVideo.id}
            visible={showComments}
            onClose={() => {
              setShowComments(false);
              Logger.info(`[VideoScreen] Comments modal closed`);
            }}
          />
        )}
      </View>
    </>
  );
}

// --------------------------------- Styles ------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  banner: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  meta: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  desc: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  commentsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  commentsButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    marginTop: 10,
    color: "#fff",
    fontSize: 14,
  },
  errorWrap: {
    flex: 1,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  errorBody: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: "#0ea5ff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderColor: "rgba(255,255,255,0.4)",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  // Minimize/Restore styles
  fullVideoContainer: {
    width: "100%",
  },
  minimizedVideoContainer: {
    position: "absolute",
    bottom: 20,
    right: 12,
    width: 240,
    zIndex: 1000,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {},
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
    }),
  },
  minimizedOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  minimizedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  minimizedText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  restoreBtn: {
    backgroundColor: "#0ea5ff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    elevation: 2,
  },
  restoreBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
