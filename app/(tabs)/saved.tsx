// app/(tabs)/saved.tsx
// Placeholder. Increment 4 implements the saved experience.
import React from "react";
import { Screen } from "../../components/ui/Screen";
import { StateView } from "../../components/ui/StateView";

export default function SavedScreen() {
  return (
    <Screen testID="saved-screen">
      <StateView
        status="empty"
        emptyTitle="Saved"
        emptyHint="Videos you save will appear here."
        testID="saved-placeholder"
      />
    </Screen>
  );
}
