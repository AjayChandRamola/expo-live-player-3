// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import "react-native-reanimated";

import { PlayQueueProvider } from "@/contexts/PlayQueueContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { parseDeepLink } from "@/services/deepLinkService";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <SettingsProvider>
      <SavedProvider>
        <RootLayoutInner />
      </SavedProvider>
    </SettingsProvider>
  );
}

function RootLayoutInner() {
  const systemColorScheme = useColorScheme();
  const { theme, autoplayDefault } = useSettings();
  const colorScheme = theme === "system" ? systemColorScheme : theme;
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    const target = parseDeepLink(url);
    if (target.kind === "video") {
      router.push(`/video/${target.id}`);
    } else if (target.kind === "live") {
      router.push("/live");
    }
    // "home" needs no navigation: the app already opens there.
  }, [url, router]);

  return (
    <PlayQueueProvider initialAutoplay={autoplayDefault}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="video/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ title: "Search" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PlayQueueProvider>
  );
}
