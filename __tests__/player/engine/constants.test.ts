// __tests__/player/engine/constants.test.ts
import {
  ERROR_MESSAGES,
  ERROR_SUBSTRINGS,
  MAX_RETRIES,
  PLAYBACK_RATES,
  RETRY_DELAYS_MS,
} from "../../../components/VideoPlayer/constants";

describe("player constants", () => {
  it("retry delays are ascending and MAX_RETRIES matches their count", () => {
    expect([...RETRY_DELAYS_MS]).toEqual([1_000, 2_000, 4_000]);
    expect(MAX_RETRIES).toBe(3);
  });

  it("playback rates are ascending and include 1", () => {
    const rates = [...PLAYBACK_RATES];
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(rates).toContain(1);
  });

  it("every error code has a user-safe message without a URL", () => {
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/https?:\/\//);
    }
  });

  it("error substrings are lower-case so matching can lower-case the input once", () => {
    for (const [, needles] of ERROR_SUBSTRINGS) {
      for (const needle of needles) expect(needle).toBe(needle.toLowerCase());
    }
  });
});
