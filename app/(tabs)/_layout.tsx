// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getColors, tokens } from "@/constants/tokens";

import ShortsActive from "@/assets/icons/shorts-active.svg";
import ShortsInactive from "@/assets/icons/shorts-inactive.svg";

export default function TabLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={tokens.iconSize.lg} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={tokens.iconSize.lg}
              name="dot.radiowaves.left.and.right"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: "Shorts",
          tabBarIcon: ({ focused }) =>
            focused ? (
              <ShortsActive width={tokens.iconSize.lg} height={tokens.iconSize.lg} />
            ) : (
              <ShortsInactive width={tokens.iconSize.lg} height={tokens.iconSize.lg} />
            ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={tokens.iconSize.lg} name="bookmark.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
