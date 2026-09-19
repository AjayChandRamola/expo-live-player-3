/**
 * components/Shorts/ShortsSearchBar.tsx
 * 
 * YouTube-style search bar for Shorts
 * - Back button (left)
 * - Search input (center)
 * - Mic icon (right) with voice search
 * 
 * Features:
 * - Real-time search filtering
 * - Voice-to-text search
 * - Smooth animations
 * - Keyboard handling
 * - Clear button
 * 
 * Production-ready, cross-platform, accessible
 */

import React, { memo, useCallback, useRef, useEffect, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useVoiceSearch } from "../../hooks/useVoiceSearch";
import Logger from "../../utils/Logger";

interface ShortsSearchBarProps {
  /**
   * Search query value
   */
  value: string;

  /**
   * Called when search query changes
   */
  onChangeText: (text: string) => void;

  /**
   * Called when back button is pressed
   */
  onBack: () => void;

  /**
   * Called when search is submitted
   */
  onSubmit?: () => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Auto-focus on mount
   */
  autoFocus?: boolean;
}

/**
 * ShortsSearchBar Component
 * 
 * YouTube-style search bar with back, input, and voice search
 */
function ShortsSearchBarComponent({
  value,
  onChangeText,
  onBack,
  onSubmit,
  placeholder = "Search Shorts",
  autoFocus = true,
}: ShortsSearchBarProps) {
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Voice search hook
  const { isListening, startListening, stopListening } = useVoiceSearch({
    onResult: (text) => {
      onChangeText(text);
      Logger.info(`[ShortsSearch] Voice result: "${text}"`);
      
      // Auto-submit after voice input
      setTimeout(() => {
        onSubmit?.();
      }, 500);
    },
    onError: (error) => {
      // Just log, don't show error - Alert handles user communication
      Logger.info("[ShortsSearch] Voice search not available on this platform");
    },
  });

  /**
   * Slide in animation on mount
   */
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto-focus input
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [slideAnim, autoFocus]);

  /**
   * Handle back button press
   */
  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    
    // Slide out animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });

    Logger.info("[ShortsSearch] Back button pressed");
  }, [slideAnim, onBack]);

  /**
   * Handle clear button
   */
  const handleClear = useCallback(() => {
    onChangeText("");
    inputRef.current?.focus();
    Logger.info("[ShortsSearch] Search cleared");
  }, [onChangeText]);

  /**
   * Handle mic button press
   */
  const handleMicPress = useCallback(async () => {
    if (isListening) {
      stopListening();
      setIsVoiceActive(false);
    } else {
      setIsVoiceActive(true);
      await startListening();
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (isListening) {
          stopListening();
          setIsVoiceActive(false);
        }
      }, 10000);
    }

    Logger.info(`[ShortsSearch] Mic ${isListening ? "stopped" : "started"}`);
  }, [isListening, startListening, stopListening]);

  /**
   * Handle submit
   */
  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    onSubmit?.();
    Logger.info(`[ShortsSearch] Search submitted: "${value}"`);
  }, [value, onSubmit]);

  const animatedStyle = {
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-100, 0],
        }),
      },
    ],
    opacity: slideAnim,
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Back Button */}
      <Pressable
        style={styles.backButton}
        onPress={handleBack}
        accessible
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={28} color="#FFFFFF" />
      </Pressable>

      {/* Search Input */}
      <View style={styles.searchInputContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color="rgba(255, 255, 255, 0.7)"
          style={styles.searchIcon}
        />
        
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
          accessible
          accessibilityLabel="Search shorts"
          accessibilityHint="Type to search for short videos"
        />

        {/* Clear Button */}
        {value.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={handleClear}
            accessible
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close-circle" size={20} color="rgba(255, 255, 255, 0.7)" />
          </Pressable>
        )}
      </View>

      {/* Mic Button */}
      <Pressable
        style={[styles.micButton, isListening && styles.micButtonActive]}
        onPress={handleMicPress}
        accessible
        accessibilityLabel={isListening ? "Stop voice search" : "Start voice search"}
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name={isListening ? "waveform" : "microphone"}
          size={24}
          color={isListening ? "#FF0000" : "#FFFFFF"}
        />
      </Pressable>

      {/* Listening Indicator */}
      {isListening && (
        <View style={styles.listeningIndicator}>
          <View style={styles.listeningDot} />
          <View style={[styles.listeningDot, styles.listeningDotDelay1]} />
          <View style={[styles.listeningDot, styles.listeningDotDelay2]} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    ...Platform.select({
      ios: {
        paddingTop: 50,
      },
      android: {
        paddingTop: 8,
      },
      web: {
        paddingTop: 8,
      },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    ...Platform.select({
      web: {
        outlineStyle: "none",
      },
    }),
  },
  clearButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  micButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  micButtonActive: {
    backgroundColor: "rgba(255, 0, 0, 0.2)",
  },
  listeningIndicator: {
    position: "absolute",
    right: 16,
    bottom: -20,
    flexDirection: "row",
    gap: 4,
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF0000",
  },
  listeningDotDelay1: {
    opacity: 0.7,
  },
  listeningDotDelay2: {
    opacity: 0.4,
  },
});

export const ShortsSearchBar = memo(ShortsSearchBarComponent);

export default ShortsSearchBar;

