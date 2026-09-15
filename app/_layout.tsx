// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { PlayQueueProvider } from "@/contexts/PlayQueueContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PlayQueueProvider>
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
