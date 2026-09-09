import React from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { useThemeColors, Fonts } from "./theme";

export default function ThemeTest() {
  const colors = useThemeColors();

  console.log("[ThemeTest] Colors:", colors);
  console.log("[ThemeTest] Fonts:", Fonts);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Theme Test OK</Text>
      <Text style={{ color: colors.icon }}>
        Background: {colors.background}
      </Text>
      <Button
        title="Log theme"
        onPress={() => console.log("Current theme:", colors)}
        color={colors.tint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: Fonts.sans, marginBottom: 8 },
});
