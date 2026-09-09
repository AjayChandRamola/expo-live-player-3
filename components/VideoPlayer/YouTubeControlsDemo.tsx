/**
 * components/VideoPlayer/YouTubeControlsDemo.tsx
 *
 * Demo component showcasing YouTube-style video control buttons
 * - Previous Video, Play/Pause, Next Video in horizontal layout
 * - Both active and disabled states
 * - Matches YouTube's 2024-2025 dark mode aesthetic
 *
 * Use this component to preview and test the button designs
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { PreviousVideoButton } from "./PreviousVideoButton";
import { NextVideoButton } from "./NextVideoButton";
import { PlayPauseButton } from "./PlayPauseButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const YouTubeControlsDemo: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>YouTube-Style Video Controls</Text>
        <Text style={styles.subtitle}>
          2024-2025 Dark Mode Aesthetic
        </Text>
      </View>

      {/* Main Demo - Active State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active State</Text>
        <Text style={styles.sectionDesc}>
          All buttons enabled with white icons on dark circular backgrounds
        </Text>
        <View style={styles.videoMock}>
          <Text style={styles.videoMockText}>Video Background</Text>
          
          {/* YouTube-style control bar */}
          <View style={styles.controlBar}>
            {/* Previous Button */}
            <View style={styles.buttonWrapper}>
              <PreviousVideoButton
                onPress={() => console.log("Previous video")}
                disabled={false}
                size={64}
              />
            </View>

            {/* Play/Pause Button (larger) */}
            <View style={[styles.buttonWrapper, { marginHorizontal: 24 }]}>
              <PlayPauseButton
                opacity={new Animated.Value(1)}
                isPlaying={isPlaying}
                onPress={() => setIsPlaying(!isPlaying)}
                size={80}
                accentColor="#FFFFFF"
              />
            </View>

            {/* Next Button */}
            <View style={styles.buttonWrapper}>
              <NextVideoButton
                onPress={() => console.log("Next video")}
                disabled={false}
                size={64}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Disabled State Demo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disabled State</Text>
        <Text style={styles.sectionDesc}>
          Gray icons (#999999) at 40% opacity with no shadow
        </Text>
        <View style={styles.videoMock}>
          <Text style={styles.videoMockText}>Video Background</Text>
          
          <View style={styles.controlBar}>
            {/* Previous Button - Disabled */}
            <View style={styles.buttonWrapper}>
              <PreviousVideoButton
                onPress={() => console.log("No previous video")}
                disabled={true}
                size={64}
              />
            </View>

            {/* Play/Pause Button */}
            <View style={[styles.buttonWrapper, { marginHorizontal: 24 }]}>
              <PlayPauseButton
                opacity={new Animated.Value(1)}
                isPlaying={false}
                onPress={() => {}}
                size={80}
                accentColor="#FFFFFF"
              />
            </View>

            {/* Next Button - Disabled */}
            <View style={styles.buttonWrapper}>
              <NextVideoButton
                onPress={() => console.log("No next video")}
                disabled={true}
                size={64}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Individual Button Showcase */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Individual Buttons</Text>
        
        {/* Previous Video - Active */}
        <View style={styles.individualDemo}>
          <View style={styles.buttonDisplay}>
            <PreviousVideoButton
              onPress={() => console.log("Previous")}
              disabled={false}
              size={64}
            />
          </View>
          <View style={styles.buttonInfo}>
            <Text style={styles.buttonName}>Previous Video (Active)</Text>
            <Text style={styles.buttonSpec}>64px • #FFFFFF icon • 65% black bg</Text>
          </View>
        </View>

        {/* Previous Video - Disabled */}
        <View style={styles.individualDemo}>
          <View style={styles.buttonDisplay}>
            <PreviousVideoButton
              onPress={() => {}}
              disabled={true}
              size={64}
            />
          </View>
          <View style={styles.buttonInfo}>
            <Text style={styles.buttonName}>Previous Video (Disabled)</Text>
            <Text style={styles.buttonSpec}>64px • #999999 icon • 40% opacity</Text>
          </View>
        </View>

        {/* Next Video - Active */}
        <View style={styles.individualDemo}>
          <View style={styles.buttonDisplay}>
            <NextVideoButton
              onPress={() => console.log("Next")}
              disabled={false}
              size={64}
            />
          </View>
          <View style={styles.buttonInfo}>
            <Text style={styles.buttonName}>Next Video (Active)</Text>
            <Text style={styles.buttonSpec}>64px • #FFFFFF icon • 65% black bg</Text>
          </View>
        </View>

        {/* Next Video - Disabled */}
        <View style={styles.individualDemo}>
          <View style={styles.buttonDisplay}>
            <NextVideoButton
              onPress={() => {}}
              disabled={true}
              size={64}
            />
          </View>
          <View style={styles.buttonInfo}>
            <Text style={styles.buttonName}>Next Video (Disabled)</Text>
            <Text style={styles.buttonSpec}>64px • #999999 icon • 40% opacity</Text>
          </View>
        </View>
      </View>

      {/* Design Specs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Design Specifications</Text>
        <View style={styles.specCard}>
          <Text style={styles.specText}>• Button diameter: 64px (Previous/Next), 80px (Play/Pause)</Text>
          <Text style={styles.specText}>• Icon color (active): #FFFFFF</Text>
          <Text style={styles.specText}>• Icon color (disabled): #999999</Text>
          <Text style={styles.specText}>• Background: rgba(0,0,0,0.65) active, rgba(0,0,0,0.4) disabled</Text>
          <Text style={styles.specText}>• Shadow: Material Design soft shadow (2px offset, 4px blur)</Text>
          <Text style={styles.specText}>• Press animation: Scale to 0.92 with spring bounce</Text>
          <Text style={styles.specText}>• Layout: Previous → Play/Pause → Next (centered)</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#AAAAAA",
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: "#AAAAAA",
    marginBottom: 16,
  },
  videoMock: {
    width: "100%",
    height: 240,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  videoMockText: {
    fontSize: 16,
    color: "#666666",
    position: "absolute",
    top: 20,
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  buttonWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  individualDemo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  buttonDisplay: {
    width: 100,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonInfo: {
    flex: 1,
    marginLeft: 16,
  },
  buttonName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  buttonSpec: {
    fontSize: 13,
    color: "#AAAAAA",
  },
  specCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  specText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default YouTubeControlsDemo;

