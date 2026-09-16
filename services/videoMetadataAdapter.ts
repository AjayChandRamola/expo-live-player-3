// services/videoMetadataAdapter.ts
/**
 * Temporary bridge: VideoFeed, VideoCard, and UpNextList still expect the
 * legacy VideoMetadata shape. Deleted once they migrate to the domain Video
 * type.
 */
import type { Video } from "../types/domain";
import type { VideoMetadata } from "../types/video";

export function toVideoMetadata(video: Video): VideoMetadata {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    videoUrl: video.source.url,
    duration: video.durationSec,
    views: video.viewCount ?? 0,
    uploadedAt: video.publishedAt,
    channelName: video.channel.name,
    channelAvatar: video.channel.avatarUrl,
    channelId: video.channel.id,
    tags: video.tags ? [...video.tags] : undefined,
    captions: video.captions ? [...video.captions] : undefined,
    chapters: video.chapters ? [...video.chapters] : undefined,
  };
}
