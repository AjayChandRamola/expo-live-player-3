// __tests__/services/liveService.test.ts
import { getLiveStatus, getRecentSessions } from "../../services/liveService";

jest.mock("../../services/contentSourceConfig", () => ({
  getContentSourceConfig: () => ({
    mode: "development",
    apiBaseUrl: "",
    allowedMediaHosts: [],
    liveSourceFallback: "youtube",
  }),
}));

describe("liveService in development mode", () => {
  it("returns a status with a known state", async () => {
    const status = await getLiveStatus();
    expect(["live", "upcoming", "ended", "none"]).toContain(status.state);
  });

  it("stamps the check time as a valid ISO date", async () => {
    const status = await getLiveStatus();
    expect(Number.isNaN(Date.parse(status.checkedAt))).toBe(false);
  });

  it("includes a session whenever the state is not none", async () => {
    const status = await getLiveStatus();
    if (status.state !== "none") {
      expect(status.session).toBeDefined();
      expect(typeof status.session?.id).toBe("string");
    }
  });

  it("gives any session an https source", async () => {
    const status = await getLiveStatus();
    if (status.session) {
      expect(status.session.source.url.startsWith("https://")).toBe(true);
      expect(["hls", "mp4", "youtube"]).toContain(status.session.source.kind);
    }
  });

  it("returns recent sessions that each point at a replay", async () => {
    const sessions = await getRecentSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      expect(typeof session.replayVideoId).toBe("string");
    }
  });

  it("gives an upcoming session a start time in the future", async () => {
    const status = await getLiveStatus();
    if (status.state === "upcoming" && status.session) {
      expect(Date.parse(status.session.startsAt)).toBeGreaterThan(Date.now());
    }
  });

  it("accepts an abort signal without throwing", async () => {
    const controller = new AbortController();
    await expect(getLiveStatus(controller.signal)).resolves.toBeDefined();
  });
});
