// services/demoContentProvider.ts
/**
 * Demo data only. Never reached when contentSourceConfig.mode is "production".
 * Do not import this file outside services/.
 */
import type { Video } from "../types/domain";

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
