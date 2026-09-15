// app/(tabs)/live.tsx
// Placeholder. Increment 5 implements the live experience.
import React from "react";
import { Screen } from "../../components/ui/Screen";
import { StateView } from "../../components/ui/StateView";

export default function LiveScreen() {
  return (
    <Screen testID="live-screen">
      <StateView
        status="empty"
        emptyTitle="Live Yagna"
        emptyHint="Live sessions will appear here."
        testID="live-placeholder"
      />
    </Screen>
  );
}
