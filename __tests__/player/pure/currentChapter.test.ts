// __tests__/player/pure/currentChapter.test.ts
import { currentChapter } from "../../../components/VideoPlayer/engine/pure/currentChapter";
import type { ChapterItem } from "../../../types/domain";

const chapters: readonly ChapterItem[] = [
  { title: "Intro", startMs: 0 },
  { title: "Mantra", startMs: 60_000 },
  { title: "Aarti", startMs: 180_000 },
];

describe("currentChapter", () => {
  it("returns null for no chapters", () => expect(currentChapter([], 5)).toBeNull());
  it("returns the first chapter at 0", () => expect(currentChapter(chapters, 0)?.title).toBe("Intro"));
  it("returns the chapter whose start is the latest <= position", () => {
    expect(currentChapter(chapters, 59_999)?.title).toBe("Intro");
    expect(currentChapter(chapters, 60_000)?.title).toBe("Mantra");
    expect(currentChapter(chapters, 999_999)?.title).toBe("Aarti");
  });
  it("returns null before the first chapter when it does not start at 0", () => {
    expect(currentChapter([{ title: "Late", startMs: 10_000 }], 5_000)).toBeNull();
  });
});
