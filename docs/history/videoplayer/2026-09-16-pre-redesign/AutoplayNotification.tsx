/**
 * components/VideoPlayer/AutoplayNotification.tsx
 * 
 * Toast notification that displays when autoplay state changes
 * - Shows "Autoplay is on" or "Autoplay is off"
 * - Auto-dismisses after 3 seconds
 * - YouTube 2025 style design
 */

import React, { useEffect, useRef } from "react";
import * as RN from "react-native";

interface AutoplayNotificationProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

const AutoplayNotification: React.FC<AutoplayNotificationProps> = ({
  visible,
  message,
  onDismiss,
}) => {
  const fadeAnim = useRef(new RN.Animated.Value(0)).current;
  const translateYAnim = useRef(new RN.Animated.Value(-20)).current;
  const hasAnimatedOutRef = React.useRef(true);

  useEffect(() => {
    if (visible) {
      hasAnimatedOutRef.current = false;
      // Fade in and slide down
      RN.Animated.parallel([
        RN.Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: RN.Easing.out(RN.Easing.ease),
          useNativeDriver: true,
        }),
        RN.Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 200,
          easing: RN.Easing.out(RN.Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        // Fade out and slide up
        RN.Animated.parallel([
          RN.Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            easing: RN.Easing.in(RN.Easing.ease),
            useNativeDriver: true,
          }),
          RN.Animated.timing(translateYAnim, {
            toValue: -20,
            duration: 200,
            easing: RN.Easing.in(RN.Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss();
        });
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      // Reset animations when not visible
      hasAnimatedOutRef.current = true;
      fadeAnim.setValue(0);
      translateYAnim.setValue(-20);
    }
  }, [visible, fadeAnim, translateYAnim, onDismiss]);

  if (!visible && hasAnimatedOutRef.current) {
    return null;
  }

  return (
    <RN.Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <RN.View style={styles.notification}>
        <RN.Text style={styles.message}>{message}</RN.Text>
      </RN.View>
    </RN.Animated.View>
  );
};

const styles = RN.StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2000,
    pointerEvents: "none",
  },
  notification: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    // Shadow for depth
    ...RN.Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
      },
    }),
  },
  message: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default AutoplayNotification;

