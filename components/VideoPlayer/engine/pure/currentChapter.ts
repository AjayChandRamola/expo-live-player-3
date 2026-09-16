// components/VideoPlayer/engine/pure/currentChapter.ts
import type { ChapterItem } from "../../../../types/domain";

/** The chapter with the greatest startMs <= positionMs, or null. Chapters are sorted by startMs. */
export function currentChapter(chapters: readonly ChapterItem[], positionMs: number): ChapterItem | null {
  let found: ChapterItem | null = null;
  for (const chapter of chapters) {
    if (chapter.startMs <= positionMs) found = chapter;
    else break;
  }
  return found;
}
