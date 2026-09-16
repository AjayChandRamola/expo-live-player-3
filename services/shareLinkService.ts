// services/shareLinkService.ts
import { LINKS } from "../constants/config";

export function forVideo(id: string): string {
  return `${LINKS.scheme}://${LINKS.videoPath}/${encodeURIComponent(id)}`;
}

export function forLive(): string {
  return `${LINKS.scheme}://${LINKS.livePath}`;
}
