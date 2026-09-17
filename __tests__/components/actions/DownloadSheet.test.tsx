import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

// VideoActionsProvider eagerly imports the real localVideoActionsRepository/
// downloadService singletons at module scope, which pull in the native
// AsyncStorage module even though this test overrides deps.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { VideoActionsProvider } from "../../../components/Video/actions/VideoActionsProvider";
import { DownloadSheet } from "../../../components/Video/actions/sheets/DownloadSheet";
import type { DownloadService } from "../../../services/videoActions/downloadService";
import type { DownloadRecord } from "../../../services/storage/downloadsStorage";
import { makeError } from "../../../services/appError";

function fakeDownloads() {
  let records: DownloadRecord[] = [];
  const listeners = new Set<(r: readonly DownloadRecord[]) => void>();
  const set = (r: DownloadRecord[]) => { records = r; listeners.forEach((l) => l(records)); };
  const service: DownloadService & { set: typeof set } = {
    list: jest.fn(async () => records),
    get: jest.fn(async (id: string) => records.find((r) => r.videoId === id) ?? null),
    start: jest.fn(async () => undefined),
    pause: jest.fn(async () => undefined),
    resume: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    resolveLocalUri: jest.fn(async () => null),
    set,
  };
  return service;
}
const rec = (o: Partial<DownloadRecord>): DownloadRecord => ({ videoId: "v1", sourceUrl: "u", fileUri: "f", status: "queued", progress: 0, bytesTotal: null, resumeData: null, error: null, updatedAt: "t", ...o });
const video = { id: "v1", url: "https://cdn.test/v1.mp4", kind: "mp4" as const, title: "Yagya" };

function renderSheet(downloads: DownloadService, kind: "mp4" | "hls" = "mp4") {
  return render(
    <VideoActionsProvider deps={{ downloads }}>
      <DownloadSheet visible onClose={jest.fn()} video={{ ...video, kind }} testID="dl" />
    </VideoActionsProvider>,
  );
}

describe("DownloadSheet", () => {
  it("not downloaded → Download starts", async () => {
    const d = fakeDownloads();
    renderSheet(d);
    await waitFor(() => expect(screen.getByLabelText("Download")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Download"));
    expect(d.start).toHaveBeenCalledWith({ id: "v1", url: video.url, kind: "mp4" });
  });
  it("downloading → progress, Pause, Cancel", async () => {
    const d = fakeDownloads();
    renderSheet(d);
    act(() => d.set([rec({ status: "downloading", progress: 0.4 })]));
    expect(screen.getByText("40%")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Pause download"));
    fireEvent.press(screen.getByLabelText("Cancel download"));
    expect(d.pause).toHaveBeenCalled();
    expect(d.cancel).toHaveBeenCalled();
  });
  it("paused → Resume; completed → Delete; failed → Retry", async () => {
    const d = fakeDownloads();
    renderSheet(d);
    act(() => d.set([rec({ status: "paused", progress: 0.4 })]));
    fireEvent.press(screen.getByLabelText("Resume download"));
    expect(d.resume).toHaveBeenCalled();
    act(() => d.set([rec({ status: "completed", progress: 1 })]));
    expect(screen.getByText("Downloaded")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Delete download"));
    expect(d.remove).toHaveBeenCalled();
    act(() => d.set([rec({ status: "failed", error: "network" })]));
    fireEvent.press(screen.getByLabelText("Retry download"));
    expect(d.start).toHaveBeenCalled();
  });
  it("storage full shows the safe message", async () => {
    const d = fakeDownloads();
    (d.start as jest.Mock).mockRejectedValueOnce(makeError("storage_full"));
    renderSheet(d);
    await waitFor(() => screen.getByLabelText("Download"));
    await act(async () => fireEvent.press(screen.getByLabelText("Download")));
    expect(screen.getByText("Not enough space on this device to download.")).toBeTruthy();
  });
  it("HLS source renders nothing", () => {
    renderSheet(fakeDownloads(), "hls");
    expect(screen.queryByTestId("dl")).toBeNull();
  });
});
