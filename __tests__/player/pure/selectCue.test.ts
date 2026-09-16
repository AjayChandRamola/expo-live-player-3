// __tests__/player/pure/selectCue.test.ts
import { selectCue } from "../../../components/VideoPlayer/engine/pure/selectCue";
import type { CaptionItem } from "../../../types/domain";

const cues: readonly CaptionItem[] = [
  { start: 0, end: 2, text: "one" },
  { start: 2, end: 4, text: "two" },
  { start: 6, text: "three" }, // open-ended until next start (none) → until infinity
];

describe("selectCue", () => {
  it("returns null for an empty list", () => expect(selectCue([], 1_000)).toBeNull());
  it("selects the cue containing the position", () => expect(selectCue(cues, 1_000)?.text).toBe("one"));
  it("start boundary is inclusive", () => expect(selectCue(cues, 2_000)?.text).toBe("two"));
  it("end boundary is exclusive", () => expect(selectCue(cues, 4_000)).toBeNull());
  it("returns null in a gap", () => expect(selectCue(cues, 5_000)).toBeNull());
  it("open-ended last cue lasts until the end", () => expect(selectCue(cues, 99_000)?.text).toBe("three"));
  it("open-ended cue ends at the next cue start", () => {
    const list: readonly CaptionItem[] = [{ start: 0, text: "a" }, { start: 3, end: 5, text: "b" }];
    expect(selectCue(list, 2_999)?.text).toBe("a");
    expect(selectCue(list, 3_000)?.text).toBe("b");
  });
  it("skips cues with empty text", () => {
    expect(selectCue([{ start: 0, end: 10, text: "" }], 1_000)).toBeNull();
  });
  it("returns null before the first cue", () => {
    expect(selectCue([{ start: 5, end: 6, text: "x" }], 1_000)).toBeNull();
  });
});
