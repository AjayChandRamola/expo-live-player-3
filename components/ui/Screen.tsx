// components/ui/Screen.tsx
/**
 * Safe-area-aware wrapper used by every new screen. Reads background colour
 * from the design tokens so no screen hard-codes it.
 */
import React from "react";
import { StyleSheet, useColorScheme, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getColors } from "../../constants/tokens";
import { OfflineBanner } from "./OfflineBanner";

export interface ScreenProps extends ViewProps {
  readonly children?: React.ReactNode;
  readonly testID?: string;
}

export function Screen({ children, style, testID, ...rest }: ScreenProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        style,
      ]}
      {...rest}
    >
      <OfflineBanner testID={testID ? `${testID}-offline` : undefined} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
