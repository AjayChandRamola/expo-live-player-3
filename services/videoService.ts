/**
 * services/videoService.ts
 * 
 * Service layer for fetching video data
 * - Mock data for demonstration (replace with real API)
 * - Pagination support
 * - Error handling and validation
 * - Type-safe responses
 */

import type { VideoMetadata, VideoFeedResponse } from "../types/video";
import Logger from "../utils/Logger";

/**
 * Mock video data catalog
 * In production, replace with API calls to your backend
 */
const MOCK_VIDEOS: VideoMetadata[] = [
  // Short-format videos (Shorts - under 60 seconds)
  {
    id: "short1",
    title: "Morning Mantra - Quick 30 Second Meditation",
    description: "Start your day with this powerful 30-second morning mantra",
    thumbnailUrl: "https://picsum.photos/seed/short1/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 30,
    views: 45000,
    uploadedAt: "2024-11-14T06:00:00Z",
    channelName: "Quick Mantras",
    channelAvatar: "https://picsum.photos/seed/shortchannel1/100/100",
    channelId: "shortchannel1",
    likes: 3200,
  },
  {
    id: "short2",
    title: "Breathing Exercise - 45 Second Calm",
    description: "Quick breathing technique for instant relaxation",
    thumbnailUrl: "https://picsum.photos/seed/short2/640/360",
    videoUrl: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    duration: 45,
    views: 67000,
    uploadedAt: "2024-11-13T14:20:00Z",
    channelName: "Breathwork Daily",
    channelAvatar: "https://picsum.photos/seed/shortchannel2/100/100",
    channelId: "shortchannel2",
    likes: 5400,
  },
  {
    id: "short3",
    title: "Om Chant - Perfect 60 Second Practice",
    description: "Pure Om chanting for one minute of peace",
    thumbnailUrl: "https://picsum.photos/seed/short3/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 60,
    views: 123000,
    uploadedAt: "2024-11-12T09:15:00Z",
    channelName: "Sacred Sounds",
    channelAvatar: "https://picsum.photos/seed/shortchannel3/100/100",
    channelId: "shortchannel3",
    likes: 8900,
  },
  {
    id: "short4",
    title: "Quick Yoga Stretch - 40 Seconds",
    description: "Fast and effective yoga stretch you can do anywhere",
    thumbnailUrl: "https://picsum.photos/seed/short4/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 40,
    views: 89000,
    uploadedAt: "2024-11-11T11:30:00Z",
    channelName: "Yoga Shorts",
    channelAvatar: "https://picsum.photos/seed/shortchannel4/100/100",
    channelId: "shortchannel4",
    likes: 6700,
  },
  {
    id: "short5",
    title: "Mindful Moment - 55 Second Meditation",
    description: "Quick mindfulness practice for busy people",
    thumbnailUrl: "https://picsum.photos/seed/short5/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 55,
    views: 234000,
    uploadedAt: "2024-11-10T16:45:00Z",
    channelName: "Mindful Life",
    channelAvatar: "https://picsum.photos/seed/shortchannel5/100/100",
    channelId: "shortchannel5",
    likes: 15000,
  },
  // Regular longer videos
  {
    id: "1",
    title: "Yagna & Nature Balance - Sacred Fire Ritual for Ecological Harmony",
    description: "How Yagna (Vedic fire ritual) harmonizes the five elements and supports ecological balance.",
    thumbnailUrl: "https://picsum.photos/seed/video1/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 245, // 4:05
    views: 12500,
    uploadedAt: "2024-11-10T10:30:00Z",
    channelName: "Vedic Wisdom Channel",
    channelAvatar: "https://picsum.photos/seed/channel1/100/100",
    channelId: "channel1",
    chapters: [
      { title: "Opening", startMs: 0 },
      { title: "Offerings & Intent", startMs: 60000 },
      { title: "Closing Mantras", startMs: 180000 },
    ],
  },
  {
    id: "2",
    title: "Gayatri Mantra Chant - Meditative Practice for Inner Peace",
    description: "Meditative exposition of Gayatri chanting — resonance, breath, and devotion.",
    thumbnailUrl: "https://picsum.photos/seed/video2/640/360",
    videoUrl: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    duration: 596, // 9:56
    views: 45000,
    uploadedAt: "2024-11-08T14:20:00Z",
    channelName: "Spiritual Mantras",
    channelAvatar: "https://picsum.photos/seed/channel2/100/100",
    channelId: "channel2",
  },
  {
    id: "3",
    title: "Morning Meditation Routine - Start Your Day with Mindfulness",
    description: "A complete guide to morning meditation practices",
    thumbnailUrl: "https://picsum.photos/seed/video3/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 720, // 12:00
    views: 89000,
    uploadedAt: "2024-11-05T07:00:00Z",
    channelName: "Mindful Living",
    channelAvatar: "https://picsum.photos/seed/channel3/100/100",
    channelId: "channel3",
  },
  {
    id: "4",
    title: "Pranayama Breathing Techniques - Complete Guide",
    description: "Learn ancient breathing techniques for health and wellness",
    thumbnailUrl: "https://picsum.photos/seed/video4/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 890, // 14:50
    views: 156000,
    uploadedAt: "2024-11-01T09:15:00Z",
    channelName: "Yoga Masters",
    channelAvatar: "https://picsum.photos/seed/channel4/100/100",
    channelId: "channel4",
  },
  {
    id: "5",
    title: "Chakra Meditation Journey - Balance Your Energy Centers",
    description: "Guided meditation through the seven chakras",
    thumbnailUrl: "https://picsum.photos/seed/video5/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 1200, // 20:00
    views: 234000,
    uploadedAt: "2024-10-28T16:45:00Z",
    channelName: "Energy Healing",
    channelAvatar: "https://picsum.photos/seed/channel5/100/100",
    channelId: "channel5",
  },
  {
    id: "6",
    title: "Sanskrit Mantras for Beginners - Easy Learning Guide",
    description: "Start your mantra practice with these beginner-friendly Sanskrit chants",
    thumbnailUrl: "https://picsum.photos/seed/video6/640/360",
    videoUrl: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    duration: 456, // 7:36
    views: 67000,
    uploadedAt: "2024-10-25T11:30:00Z",
    channelName: "Learn Sanskrit",
    channelAvatar: "https://picsum.photos/seed/channel6/100/100",
    channelId: "channel6",
  },
  {
    id: "7",
    title: "Vedic Philosophy 101 - Understanding Ancient Wisdom",
    description: "An introduction to Vedic philosophy and its modern relevance",
    thumbnailUrl: "https://picsum.photos/seed/video7/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 1456, // 24:16
    views: 123000,
    uploadedAt: "2024-10-20T13:00:00Z",
    channelName: "Philosophy Explained",
    channelAvatar: "https://picsum.photos/seed/channel7/100/100",
    channelId: "channel7",
  },
  {
    id: "8",
    title: "Ayurvedic Daily Routine - Dinacharya for Modern Life",
    description: "Implement Ayurvedic daily practices for optimal health",
    thumbnailUrl: "https://picsum.photos/seed/video8/640/360",
    videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    duration: 678, // 11:18
    views: 98000,
    uploadedAt: "2024-10-15T08:20:00Z",
    channelName: "Ayurveda Today",
    channelAvatar: "https://picsum.photos/seed/channel8/100/100",
    channelId: "channel8",
  },
];

/**
 * Generate additional mock videos for infinite scroll demonstration
 * Includes both regular videos and shorts (30% are shorts under 60 seconds)
 */
const generateMoreVideos = (startId: number, count: number): VideoMetadata[] => {
  return Array.from({ length: count }, (_, i) => {
    const id = (startId + i).toString();
    const seedNum = startId + i;
    
    // 30% chance to generate a short video (under 60 seconds)
    const isShort = Math.random() < 0.3;
    const duration = isShort 
      ? Math.floor(Math.random() * 45) + 15  // 15-60 seconds for shorts
      : Math.floor(Math.random() * 1200) + 120; // 2-22 minutes for regular
    
    const shortTypes = [
      "Quick Meditation",
      "Fast Breathing Exercise", 
      "Instant Mantra",
      "Short Yoga Pose",
      "Mindful Moment",
      "Energy Boost",
      "Quick Stretch",
      "30 Second Peace"
    ];
    
    const regularTypes = [
      "Meditation and Mindfulness Practices",
      "Deep Breathing Techniques",
      "Guided Meditation Journey",
      "Yoga Practice Session",
      "Mantra Chanting Guide"
    ];
    
    const type = isShort 
      ? shortTypes[seedNum % shortTypes.length]
      : regularTypes[seedNum % regularTypes.length];
    
    return {
      id,
      title: `${isShort ? "Short: " : ""}${type} - Video ${id}`,
      description: `${isShort ? "Quick " : ""}${type.toLowerCase()} in video ${id}`,
      thumbnailUrl: `https://picsum.photos/seed/video${seedNum}/640/360`,
      videoUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      duration,
      views: Math.floor(Math.random() * 500000),
      uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      channelName: `${isShort ? "Quick" : ""}Channel ${(seedNum % 10) + 1}`,
      channelAvatar: `https://picsum.photos/seed/channel${(seedNum % 10) + 1}/100/100`,
      channelId: `channel${(seedNum % 10) + 1}`,
      likes: isShort ? Math.floor(Math.random() * 50000) : undefined,
    };
  });
};

/**
 * Fetch video feed with pagination
 * @param page - Page number (0-based)
 * @param pageSize - Number of videos per page
 * @returns Promise with video feed response
 */
export const fetchVideoFeed = async (
  page: number = 0,
  pageSize: number = 10
): Promise<VideoFeedResponse> => {
  try {
    Logger.info(`[VideoService] Fetching page ${page}, size ${pageSize}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Calculate slice
    const allVideos = [
      ...MOCK_VIDEOS,
      ...generateMoreVideos(MOCK_VIDEOS.length + 1, 50),
    ];
    
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const videos = allVideos.slice(startIdx, endIdx);
    const hasMore = endIdx < allVideos.length;

    Logger.info(`[VideoService] Returning ${videos.length} videos, hasMore: ${hasMore}`);

    return {
      videos,
      nextPageToken: hasMore ? `page_${page + 1}` : undefined,
      hasMore,
    };
  } catch (error) {
    Logger.error("[VideoService] Failed to fetch video feed:", error);
    throw new Error("Failed to load videos. Please try again.");
  }
};

/**
 * Fetch video by ID
 * @param id - Video ID
 * @returns Promise with video metadata or null
 */
export const fetchVideoById = async (id: string): Promise<VideoMetadata | null> => {
  try {
    Logger.info(`[VideoService] Fetching video ${id}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    const allVideos = [
      ...MOCK_VIDEOS,
      ...generateMoreVideos(MOCK_VIDEOS.length + 1, 50),
    ];

    const video = allVideos.find((v) => v.id === id);

    if (!video) {
      Logger.warn(`[VideoService] Video ${id} not found`);
      return null;
    }

    Logger.info(`[VideoService] Found video: ${video.title}`);
    return video;
  } catch (error) {
    Logger.error(`[VideoService] Failed to fetch video ${id}:`, error);
    return null;
  }
};

/**
 * Search videos by query
 * @param query - Search query string
 * @param page - Page number
 * @param pageSize - Results per page
 * @returns Promise with search results
 */
export const searchVideos = async (
  query: string,
  page: number = 0,
  pageSize: number = 10
): Promise<VideoFeedResponse> => {
  try {
    Logger.info(`[VideoService] Searching for: "${query}", page ${page}`);

    if (!query.trim()) {
      return { videos: [], hasMore: false };
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 400));

    const allVideos = [
      ...MOCK_VIDEOS,
      ...generateMoreVideos(MOCK_VIDEOS.length + 1, 30),
    ];

    // Simple search filter
    const searchTerm = query.toLowerCase();
    const filtered = allVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(searchTerm) ||
        v.description?.toLowerCase().includes(searchTerm) ||
        v.channelName.toLowerCase().includes(searchTerm)
    );

    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const videos = filtered.slice(startIdx, endIdx);
    const hasMore = endIdx < filtered.length;

    Logger.info(`[VideoService] Found ${filtered.length} results, returning ${videos.length}`);

    return {
      videos,
      nextPageToken: hasMore ? `search_page_${page + 1}` : undefined,
      hasMore,
    };
  } catch (error) {
    Logger.error("[VideoService] Search failed:", error);
    throw new Error("Search failed. Please try again.");
  }
};

