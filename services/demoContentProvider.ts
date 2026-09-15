// services/demoContentProvider.ts
/**
 * Demo data only. Never reached when contentSourceConfig.mode is "production".
 * Do not import this file outside services/.
 */
import type { LiveSession, Video } from "../types/domain";

const HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const MP4_URL = "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4";

function video(i: number, overrides: Partial<Video> = {}): Video {
  const isHls = i % 2 === 0;
  return {
    id: `demo-${i}`,
    title: `Yagna Satsang ${i}`,
    description: `A demo Yagna video entry number ${i}, used for development content only.`,
    thumbnailUrl: `https://picsum.photos/seed/yagna${i}/640/360`,
    durationSec: 300 + i * 17,
    publishedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    viewCount: 1000 * i,
    channel: { id: `channel-${i % 3}`, name: `Yagna Channel ${i % 3}` },
    isLive: false,
    source: { kind: isHls ? "hls" : "mp4", url: isHls ? HLS_URL : MP4_URL },
    ...overrides,
  };
}

export const DEMO_VIDEOS: Video[] = Array.from({ length: 16 }, (_, i) => video(i + 1));

export const DEMO_FEATURED: Video = video(0, {
  id: "demo-featured",
  title: "Gayatri Yagya — Featured",
});

export const DEMO_LIVE_HLS: LiveSession = {
  id: "live-hls-1",
  title: "Gayatri Yagya — Live",
  thumbnailUrl: "https://picsum.photos/seed/yagna-live/640/360",
  startsAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  source: { kind: "hls", url: HLS_URL },
};

export const DEMO_LIVE_UPCOMING: LiveSession = {
  id: "live-upcoming-1",
  title: "Yagna Vishnu Bhagwan — Upcoming Live",
  thumbnailUrl: "https://picsum.photos/seed/yagna-upcoming/640/360",
  startsAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  source: { kind: "hls", url: HLS_URL },
};

export const DEMO_RECENT_SESSIONS: LiveSession[] = [
  {
    id: "session-1",
    title: "Yagna Satsang — Replay 1",
    thumbnailUrl: "https://picsum.photos/seed/yagna-session1/640/360",
    startsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    endedAt: new Date(Date.now() - 2 * 86_400_000 + 3_600_000).toISOString(),
    source: { kind: "hls", url: HLS_URL },
    replayVideoId: DEMO_VIDEOS[0].id,
  },
  {
    id: "session-2",
    title: "Yagna Satsang — Replay 2",
    thumbnailUrl: "https://picsum.photos/seed/yagna-session2/640/360",
    startsAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    endedAt: new Date(Date.now() - 5 * 86_400_000 + 3_600_000).toISOString(),
    source: { kind: "hls", url: HLS_URL },
    replayVideoId: DEMO_VIDEOS[1].id,
  },
  {
    id: "session-3",
    title: "Yagna Satsang — Replay 3",
    thumbnailUrl: "https://picsum.photos/seed/yagna-session3/640/360",
    startsAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    endedAt: new Date(Date.now() - 8 * 86_400_000 + 3_600_000).toISOString(),
    source: { kind: "hls", url: HLS_URL },
    replayVideoId: DEMO_VIDEOS[2].id,
  },
];
