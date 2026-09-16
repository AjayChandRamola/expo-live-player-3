// __tests__/services/httpClient.test.ts
import { httpGet } from "../../services/httpClient";
import { TIMING } from "../../constants/config";

jest.mock("../../services/contentSourceConfig", () => ({
  getContentSourceConfig: () => ({
    mode: "production",
    apiBaseUrl: "https://api.test",
    allowedMediaHosts: [],
    liveSourceFallback: "none",
  }),
}));

interface Payload {
  readonly id: string;
}
const isPayload = (v: unknown): v is Payload =>
  typeof v === "object" && v !== null && typeof (v as Payload).id === "string";

describe("httpGet", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("returns parsed data that satisfies the guard", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "abc" }),
    }) as unknown as typeof fetch;

    await expect(httpGet({ path: "/videos/abc", guard: isPayload })).resolves.toEqual({ id: "abc" });
  });

  it("requests the configured base url over https", async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "a" }) });
    global.fetch = spy as unknown as typeof fetch;

    await httpGet({ path: "/videos/a", guard: isPayload });
    const requested = String(spy.mock.calls[0][0]);
    expect(requested.startsWith("https://api.test")).toBe(true);
  });

  it("maps a 404 to not_found", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(httpGet({ path: "/missing", guard: isPayload })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("maps a 500 to unknown", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(httpGet({ path: "/boom", guard: isPayload })).rejects.toMatchObject({
      code: "unknown",
    });
  });

  it("maps a thrown fetch to network", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;
    await expect(httpGet({ path: "/a", guard: isPayload })).rejects.toMatchObject({
      code: "network",
    });
  });

  it("maps an abort to timeout", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    global.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    await expect(httpGet({ path: "/a", guard: isPayload })).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("rejects a response that fails the guard", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ wrong: true }),
    }) as unknown as typeof fetch;

    await expect(httpGet({ path: "/a", guard: isPayload })).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("uses the configured timeout", () => {
    expect(TIMING.httpTimeoutMs).toBe(10_000);
  });
});
