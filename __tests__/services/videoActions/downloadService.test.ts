import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDownloadService, type DownloadFs } from "../../../services/videoActions/downloadService";
import { STORAGE_KEYS } from "../../../constants/config";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

type Progress = (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void;

function fakeFs() {
  const files = new Set<string>();
  let onProgress: Progress | null = null;
  let resolveDownload: ((r: { uri: string } | undefined) => void) | null = null;
  const resumable = {
    downloadAsync: jest.fn(() => new Promise<{ uri: string } | undefined>((resolve) => { resolveDownload = resolve; })),
    pauseAsync: jest.fn(async () => ({ resumeData: "RESUME" })),
    resumeAsync: jest.fn(() => new Promise<{ uri: string } | undefined>((resolve) => { resolveDownload = resolve; })),
    cancelAsync: jest.fn(async () => undefined),
    savable: jest.fn(() => ({ url: "u", fileUri: "f", options: {}, resumeData: "RESUME" })),
  };
  const fs: DownloadFs = {
    documentDirectory: "file:///docs/",
    makeDirectoryAsync: jest.fn(async () => undefined),
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: files.has(uri), uri, isDirectory: false })),
    deleteAsync: jest.fn(async (uri: string) => { files.delete(uri); }),
    getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024 * 1024),
    createDownloadResumable: jest.fn((_url: string, fileUri: string, _opts: unknown, cb?: Progress) => {
      onProgress = cb ?? null;
      return { ...resumable, fileUri };
    }),
  };
  return {
    fs,
    resumable,
    progress: (written: number, total: number) => onProgress?.({ totalBytesWritten: written, totalBytesExpectedToWrite: total }),
    complete: (uri: string) => { files.add(uri); resolveDownload?.({ uri }); },
    files,
  };
}

const MP4 = { id: "v1", url: "https://cdn.test/v1.mp4", kind: "mp4" as const };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useRealTimers();
});

describe("downloadService", () => {
  it("rejects HLS", async () => {
    const { fs } = fakeFs();
    await expect(createDownloadService({ fs }).start({ ...MP4, kind: "hls" })).rejects.toMatchObject({ code: "validation" });
  });

  it("start → downloading with throttled progress → completed; resolveLocalUri returns the file", async () => {
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    const seen: string[] = [];
    service.subscribe((records) => seen.push(records[0]?.status ?? "none"));
    await service.start(MP4);
    expect(f.fs.makeDirectoryAsync).toHaveBeenCalledWith("file:///docs/videos/", { intermediates: true });
    expect((await service.get("v1"))?.status).toBe("downloading");
    f.progress(50, 100);
    await flush();
    expect((await service.get("v1"))?.progress).toBe(0.5);
    f.complete("file:///docs/videos/v1.mp4");
    await flush();
    expect((await service.get("v1"))).toMatchObject({ status: "completed", progress: 1 });
    expect(await service.resolveLocalUri("v1")).toBe("file:///docs/videos/v1.mp4");
    expect(seen).toContain("completed");
  });

  it("pause stores resumeData; resume continues; cancel deletes file and record", async () => {
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    await service.start(MP4);
    await service.pause("v1");
    expect((await service.get("v1"))).toMatchObject({ status: "paused", resumeData: "RESUME" });
    await service.resume("v1");
    expect((await service.get("v1"))?.status).toBe("downloading");
    await service.cancel("v1");
    expect(f.fs.deleteAsync).toHaveBeenCalledWith("file:///docs/videos/v1.mp4", { idempotent: true });
    expect(await service.get("v1")).toBeNull();
  });

  it("storage full → storage_full error; download error → failed", async () => {
    const f = fakeFs();
    (f.fs.getFreeDiskStorageAsync as jest.Mock).mockResolvedValueOnce(1);
    const service = createDownloadService({ fs: f.fs });
    await expect(service.start(MP4)).rejects.toMatchObject({ code: "storage_full" });
    (f.resumable.downloadAsync as jest.Mock).mockRejectedValueOnce(new Error("net"));
    await service.start(MP4);
    await flush();
    expect((await service.get("v1"))).toMatchObject({ status: "failed", error: "network" });
  });

  it("only one active download; the second queues and starts when the first completes", async () => {
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    await service.start(MP4);
    await service.start({ id: "v2", url: "https://cdn.test/v2.mp4", kind: "mp4" });
    expect((await service.get("v2"))?.status).toBe("queued");
    f.complete("file:///docs/videos/v1.mp4");
    await flush();
    expect((await service.get("v2"))?.status).toBe("downloading");
  });

  it("a record left in downloading is shown as paused after restart; remove deletes completed files", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify({ version: 1, records: [{ videoId: "v9", sourceUrl: "u", fileUri: "file:///docs/videos/v9.mp4", status: "downloading", progress: 0.3, bytesTotal: null, resumeData: "R", error: null, updatedAt: "t" }] }));
    const f = fakeFs();
    const service = createDownloadService({ fs: f.fs });
    expect((await service.get("v9"))?.status).toBe("paused");
    f.files.add("file:///docs/videos/v9.mp4");
    await service.remove("v9");
    expect(await service.get("v9")).toBeNull();
    expect(f.fs.deleteAsync).toHaveBeenCalled();
  });
});
