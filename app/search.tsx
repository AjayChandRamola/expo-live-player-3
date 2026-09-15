// app/search.tsx
// Placeholder. Increment 6 implements the search experience.
import React from "react";
import { Stack } from "expo-router";
import { Screen } from "../components/ui/Screen";
import { StateView } from "../components/ui/StateView";

export default function SearchScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />
      <Screen testID="search-screen">
        <StateView
          status="empty"
          emptyTitle="Search"
          emptyHint="Search will be available here."
          testID="search-placeholder"
        />
      </Screen>
    </>
  );
}
