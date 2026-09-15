// components/Live/LiveEmbedView.tsx
/**
 * The only place YouTube's embed player is rendered. Loads exactly the
 * resolver-built URL, blocks navigation outside target.allowedOrigins by
 * exact origin match, and injects no script. Every prop here is a security
 * boundary, not a convenience default.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type { EmbedTarget } from "../../types/domain";

export interface LiveEmbedViewProps {
  readonly target: EmbedTarget;
  readonly testID?: string;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function LiveEmbedView({ target, testID }: LiveEmbedViewProps) {
  const allowedOrigins = new Set(target.allowedOrigins);

  const handleShouldStartLoad = (request: WebViewNavigation | { url: string }): boolean => {
    const origin = originOf(request.url);
    return origin !== null && allowedOrigins.has(origin);
  };

  return (
    <WebView
      testID={testID}
      style={styles.webview}
      source={{ uri: target.embedUrl }}
      originWhitelist={[...target.allowedOrigins]}
      onShouldStartLoadWithRequest={handleShouldStartLoad}
      allowFileAccess={false}
      allowUniversalAccessFromFileURLs={false}
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1 },
});
