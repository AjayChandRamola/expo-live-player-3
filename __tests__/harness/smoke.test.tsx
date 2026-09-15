// __tests__/harness/smoke.test.tsx
// Proves the Jest + jest-expo + RNTL toolchain is wired correctly.
// If this fails, no other test in the repo can be trusted.
import React from "react";
import { Text, View } from "react-native";
import { render, screen } from "@testing-library/react-native";

function Greeting({ name }: { name: string }) {
  return (
    <View testID="greeting-root">
      <Text>Namaste {name}</Text>
    </View>
  );
}

describe("test harness", () => {
  it("renders a React Native component tree", () => {
    render(<Greeting name="Yagna" />);
    expect(screen.getByTestId("greeting-root")).toBeTruthy();
  });

  it("finds text content", () => {
    render(<Greeting name="Yagna" />);
    expect(screen.getByText("Namaste Yagna")).toBeTruthy();
  });

  it("loads the extended matchers from @testing-library/react-native", () => {
    render(<Greeting name="Yagna" />);
    // toBeOnTheScreen comes from extend-expect, not from core Jest.
    expect(screen.getByTestId("greeting-root")).toBeOnTheScreen();
  });
});
