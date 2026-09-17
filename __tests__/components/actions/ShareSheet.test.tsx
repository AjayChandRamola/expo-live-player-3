// __tests__/player/VideoShareSheet.test.tsx
import React from "react";
import { Share } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { ShareSheet } from "../../../components/Video/actions/sheets/ShareSheet";
import { forVideo } from "../../../services/shareLinkService";

describe("ShareSheet", () => {
  let shareSpy: jest.SpyInstance;

  beforeEach(() => {
    shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it("shares the app deep link, not the raw media url", async () => {
    render(
      <ShareSheet
        videoId="v1"
        title="Gayatri Yagya"
        url="https://cdn.test/secret.m3u8"
        visible
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const [payload] = shareSpy.mock.calls[0] as [{ message?: string; url?: string }];
    const shared = `${payload.message ?? ""} ${payload.url ?? ""}`;
    expect(shared).toContain(forVideo("v1"));
    expect(shared).not.toContain("secret.m3u8");
  });

  it("includes the title in the shared message", async () => {
    render(
      <ShareSheet videoId="v1" title="Gayatri Yagya" url="https://cdn.test/a.m3u8" visible onClose={jest.fn()} />,
    );

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const [payload] = shareSpy.mock.calls[0] as [{ message?: string; title?: string }];
    expect(`${payload.message ?? ""} ${payload.title ?? ""}`).toContain("Gayatri Yagya");
  });

  it("closes after sharing", async () => {
    const onClose = jest.fn();
    render(
      <ShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible onClose={onClose} />,
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("does not crash when the user dismisses the system sheet", async () => {
    shareSpy.mockResolvedValue({ action: "dismissedAction" } as never);
    const onClose = jest.fn();
    render(
      <ShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible onClose={onClose} />,
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("does not crash when the system sheet rejects", async () => {
    shareSpy.mockRejectedValue(new Error("no share provider"));
    const onClose = jest.fn();
    render(
      <ShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible onClose={onClose} />,
    );
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("does not fire when not visible", () => {
    render(
      <ShareSheet videoId="v1" title="T" url="https://cdn.test/a.m3u8" visible={false} onClose={jest.fn()} />,
    );
    expect(shareSpy).not.toHaveBeenCalled();
  });
});
