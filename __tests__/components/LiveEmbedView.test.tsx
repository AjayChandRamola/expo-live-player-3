// __tests__/components/LiveEmbedView.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { LiveEmbedView } from "../../components/Live/LiveEmbedView";

const webViewProps: Record<string, unknown>[] = [];
jest.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    webViewProps.push(props);
    const React = require("react");
    return React.createElement("WebView", { testID: "webview" });
  },
}));

const target = {
  embedUrl: "https://www.youtube-nocookie.com/embed/abc12345678?playsinline=1",
  allowedOrigins: ["https://www.youtube.com", "https://www.youtube-nocookie.com"] as const,
};

function last() {
  return webViewProps[webViewProps.length - 1];
}

describe("LiveEmbedView", () => {
  beforeEach(() => {
    webViewProps.length = 0;
  });

  it("loads exactly the resolver-built url", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().source).toEqual({ uri: target.embedUrl });
  });

  it("passes the origin allowlist to the WebView", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().originWhitelist).toEqual(expect.arrayContaining([...target.allowedOrigins]));
  });

  it("refuses file and universal access", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().allowFileAccess).toBe(false);
    expect(last().allowUniversalAccessFromFileURLs).toBe(false);
  });

  it("injects no javascript", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(last().injectedJavaScript).toBeUndefined();
  });

  it("allows navigation within the allowlist", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    const guard = last().onShouldStartLoadWithRequest as (r: { url: string }) => boolean;
    expect(guard({ url: "https://www.youtube-nocookie.com/embed/abc12345678" })).toBe(true);
  });

  it.each([
    ["https://evil.test/phish"],
    ["https://youtube.evil.test/watch"],
    ["http://www.youtube.com/embed/a"],
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
  ])("blocks navigation to %s", (url) => {
    render(<LiveEmbedView target={target} testID="embed" />);
    const guard = last().onShouldStartLoadWithRequest as (r: { url: string }) => boolean;
    expect(guard({ url })).toBe(false);
  });

  it("renders the webview", () => {
    render(<LiveEmbedView target={target} testID="embed" />);
    expect(screen.getByTestId("webview")).toBeTruthy();
  });
});
