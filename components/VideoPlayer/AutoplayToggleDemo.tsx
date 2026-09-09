/**
 * components/VideoPlayer/AutoplayToggleDemo.tsx
 *
 * Demo component showcasing the YouTube 2025-style Autoplay Toggle Button
 * - ON/OFF states with smooth animations
 * - Blue glow effect when enabled
 * - Gray/disabled appearance when OFF
 * - Matches YouTube's 2025 dark mode aesthetic
 *
 * Use this component to preview and test the autoplay toggle design
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import AutoplayToggle from "./AutoplayToggle";

export const AutoplayToggleDemo: React.FC = () => {
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [autoplayDisabled, setAutoplayDisabled] = useState(false);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>YouTube-Style Autoplay Toggle</Text>
        <Text style={styles.subtitle}>
          2025 Dark Mode Material 3 Design
        </Text>
      </View>

      {/* Main Demo - Interactive State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interactive Demo</Text>
        <Text style={styles.sectionDesc}>
          Tap the toggle to switch between ON and OFF states. Auto-hides with other controls.
        </Text>
        <View style={styles.controlMock}>
          <Text style={styles.controlMockText}>Video Player Control Bar</Text>
          
          <View style={styles.controlRow}>
            <AutoplayToggle
              autoplayEnabled={autoplayEnabled}
              onToggle={() => setAutoplayEnabled(!autoplayEnabled)}
              size={28}
              opacity={1}
            />
            <Text style={styles.statusText}>
              Autoplay is {autoplayEnabled ? "ON" : "OFF"}
            </Text>
          </View>
        </View>
      </View>

      {/* ON State Demo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ON State (Active)</Text>
        <Text style={styles.sectionDesc}>
          Blue glowing capsule (#3EA6FF) with white play icon and pulse animation
        </Text>
        <View style={styles.displayBox}>
          <AutoplayToggle
            autoplayEnabled={true}
            onToggle={() => console.log("Autoplay ON toggled")}
            size={32}
          />
        </View>
        <View style={styles.specCard}>
          <Text style={styles.specText}>• Icon: Play (▶️)</Text>
          <Text style={styles.specText}>• Background: #0F0F0F (YouTube dark)</Text>
          <Text style={styles.specText}>• Icon Color: #FFFFFF</Text>
          <Text style={styles.specText}>• Glow: #3EA6FF with pulse animation</Text>
          <Text style={styles.specText}>• Animation: Continuous blue ring pulse (1s loop)</Text>
        </View>
      </View>

      {/* OFF State Demo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OFF State (Inactive)</Text>
        <Text style={styles.sectionDesc}>
          Gray translucent with pause icon, no glow or pulse
        </Text>
        <View style={styles.displayBox}>
          <AutoplayToggle
            autoplayEnabled={false}
            onToggle={() => console.log("Autoplay OFF toggled")}
            size={32}
          />
        </View>
        <View style={styles.specCard}>
          <Text style={styles.specText}>• Icon: Pause (⏸️)</Text>
          <Text style={styles.specText}>• Background: #0F0F0F</Text>
          <Text style={styles.specText}>• Icon Color: #7A7A7A (muted gray)</Text>
          <Text style={styles.specText}>• Glow: None</Text>
          <Text style={styles.specText}>• Animation: None</Text>
        </View>
      </View>

      {/* Disabled State Demo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disabled State</Text>
        <Text style={styles.sectionDesc}>
          When no next video is available or feature is unavailable
        </Text>
        <View style={styles.displayBox}>
          <AutoplayToggle
            autoplayEnabled={autoplayDisabled}
            onToggle={() => setAutoplayDisabled(!autoplayDisabled)}
            size={32}
            disabled={true}
          />
        </View>
        <View style={styles.specCard}>
          <Text style={styles.specText}>• Opacity: 50%</Text>
          <Text style={styles.specText}>• Cursor: Not allowed</Text>
          <Text style={styles.specText}>• Interactions: Disabled</Text>
        </View>
      </View>

      {/* Size Variations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Size Variations</Text>
        <View style={styles.sizeGrid}>
          <View style={styles.sizeItem}>
            <AutoplayToggle
              autoplayEnabled={true}
              onToggle={() => {}}
              size={20}
            />
            <Text style={styles.sizeLabel}>20px</Text>
          </View>
          <View style={styles.sizeItem}>
            <AutoplayToggle
              autoplayEnabled={true}
              onToggle={() => {}}
              size={24}
            />
            <Text style={styles.sizeLabel}>24px</Text>
          </View>
          <View style={styles.sizeItem}>
            <AutoplayToggle
              autoplayEnabled={true}
              onToggle={() => {}}
              size={28}
            />
            <Text style={styles.sizeLabel}>28px (default)</Text>
          </View>
          <View style={styles.sizeItem}>
            <AutoplayToggle
              autoplayEnabled={true}
              onToggle={() => {}}
              size={32}
            />
            <Text style={styles.sizeLabel}>32px</Text>
          </View>
        </View>
      </View>

      {/* Design Specifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Design Specifications</Text>
        <View style={styles.specCard}>
          <Text style={styles.specTitle}>Visual Design</Text>
          <Text style={styles.specText}>• Shape: Rounded capsule toggle (Material 3)</Text>
          <Text style={styles.specText}>• Default Size: 28-32px diameter</Text>
          <Text style={styles.specText}>• Background: #0F0F0F (YouTube 2025 dark mode)</Text>
          <Text style={styles.specText}>• Shadow: Material Design soft shadow</Text>
          
          <Text style={[styles.specTitle, { marginTop: 16 }]}>Colors</Text>
          <Text style={styles.specText}>• Active Glow: #3EA6FF (YouTube blue)</Text>
          <Text style={styles.specText}>• Icon (ON): #FFFFFF</Text>
          <Text style={styles.specText}>• Icon (OFF): #7A7A7A</Text>
          <Text style={styles.specText}>• Disabled: 50% opacity</Text>
          
          <Text style={[styles.specTitle, { marginTop: 16 }]}>Animations</Text>
          <Text style={styles.specText}>• Toggle: 0.25-0.3s cubic-bezier(0.4, 0, 0.2, 1)</Text>
          <Text style={styles.specText}>• Pulse: 1s continuous loop when ON</Text>
          <Text style={styles.specText}>• Press: Scale 0.98 → 1.02 → 1.0</Text>
          <Text style={styles.specText}>• Hover: Glow fade-in 200ms</Text>
          
          <Text style={[styles.specTitle, { marginTop: 16 }]}>Behavior</Text>
          <Text style={styles.specText}>• Purpose: Enable/disable next video autoplay</Text>
          <Text style={styles.specText}>• Placement: Top right of control bar</Text>
          <Text style={styles.specText}>• Position: Before Settings, after Loop</Text>
          <Text style={styles.specText}>• Tooltip: "Autoplay is on/off"</Text>
          
          <Text style={[styles.specTitle, { marginTop: 16 }]}>Accessibility</Text>
          <Text style={styles.specText}>• Role: button</Text>
          <Text style={styles.specText}>• State: checked (boolean)</Text>
          <Text style={styles.specText}>• Label: Descriptive state announcement</Text>
          <Text style={styles.specText}>• Support: Screen reader compatible</Text>
        </View>
      </View>

      {/* Integration Example */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integration Example</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeText}>
{`import AutoplayToggle from './AutoplayToggle';

<AutoplayToggle
  opacity={controller.opacity}  // Auto-hide support
  autoplayEnabled={autoplayEnabled}
  onToggle={handleToggleAutoplay}
  size={28}
  disabled={!hasNextVideo}
/>`}
          </Text>
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
  controlMock: {
    width: "100%",
    minHeight: 160,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    position: "relative",
  },
  controlMockText: {
    fontSize: 14,
    color: "#666666",
    position: "absolute",
    top: 16,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  displayBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    marginBottom: 16,
  },
  specCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  specTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3EA6FF",
    marginBottom: 8,
  },
  specText: {
    fontSize: 13,
    color: "#CCCCCC",
    marginBottom: 6,
    lineHeight: 20,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "space-around",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 24,
  },
  sizeItem: {
    alignItems: "center",
    gap: 12,
  },
  sizeLabel: {
    fontSize: 12,
    color: "#AAAAAA",
    marginTop: 8,
  },
  codeCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  codeText: {
    fontFamily: Platform.select({ 
      ios: "Menlo", 
      android: "monospace", 
      default: "monospace" 
    }),
    fontSize: 13,
    color: "#3EA6FF",
    lineHeight: 20,
  },
});

export default AutoplayToggleDemo;

