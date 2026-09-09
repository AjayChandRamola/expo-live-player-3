/**
 * components/ui/ShortsIcon.tsx
 * 
 * Custom icon component matching YouTube Shorts visual silhouette:
 * - Vertical pill/capsule shape (aspect ratio ~1.8:1)
 * - Rotated 15-20 degrees clockwise for dynamic appearance
 * - Centered play triangle cutout (negative space)
 * - Monochrome styling matching app theme (no colored logos)
 * - Active/inactive states for tab navigation
 * 
 * Production-ready, accessible, cross-platform compatible
 * Zero Trust: No external dependencies, pure SVG rendering
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Defs, Mask, Rect } from "react-native-svg";

interface ShortsIconProps {
  /**
   * Icon size in pixels (default: 24)
   */
  size?: number;

  /**
   * Icon color - should match theme tint/icon color
   */
  color: string;

  /**
   * Whether the icon is in active/selected state
   * Active: filled/solid appearance
   * Inactive: outline appearance
   */
  active?: boolean;

  /**
   * Optional testID for automated testing
   */
  testID?: string;
}

/**
 * ShortsIcon Component
 * 
 * Renders a YouTube Shorts-style icon with:
 * - Slanted vertical pill shape
 * - Play triangle cutout in center
 * - Configurable size and color
 * - Active/inactive visual states
 */
export function ShortsIcon({
  size = 24,
  color,
  active = false,
  testID = "shorts-icon",
}: ShortsIconProps) {
  // Calculate dimensions
  const width = size;
  const height = size;
  
  // Base pill dimensions (before rotation)
  const pillWidth = size * 0.42; // ~40% of size
  const pillHeight = size * 0.75; // ~75% of size for 1.8:1 aspect ratio
  const pillRadius = pillWidth / 2; // Fully rounded ends
  
  // Center position
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Rotation angle (18 degrees clockwise)
  const rotationDeg = 18;
  
  // Play triangle dimensions (scaled to fit inside pill)
  const triangleSize = size * 0.28;
  
  // Stroke width based on active state
  const strokeWidth = active ? size * 0.08 : size * 0.06;

  return (
    <View
      style={[styles.container, { width, height }]}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Shorts icon"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {/* Mask for the play triangle cutout */}
          <Mask id="play-cutout">
            {/* White background (visible) */}
            <Rect x="0" y="0" width={width} height={height} fill="white" />
            
            {/* Black triangle (invisible - creates cutout) */}
            <Path
              d={`
                M ${centerX - triangleSize * 0.35} ${centerY - triangleSize * 0.4}
                L ${centerX + triangleSize * 0.45} ${centerY}
                L ${centerX - triangleSize * 0.35} ${centerY + triangleSize * 0.4}
                Z
              `}
              fill="black"
            />
          </Mask>
        </Defs>

        {/* Main pill shape with rotation and play cutout */}
        <Path
          d={`
            M ${centerX - pillWidth / 2} ${centerY - pillHeight / 2 + pillRadius}
            A ${pillRadius} ${pillRadius} 0 0 1 ${centerX + pillWidth / 2} ${centerY - pillHeight / 2 + pillRadius}
            L ${centerX + pillWidth / 2} ${centerY + pillHeight / 2 - pillRadius}
            A ${pillRadius} ${pillRadius} 0 0 1 ${centerX - pillWidth / 2} ${centerY + pillHeight / 2 - pillRadius}
            Z
          `}
          fill={active ? color : "transparent"}
          stroke={color}
          strokeWidth={strokeWidth}
          mask="url(#play-cutout)"
          origin={`${centerX}, ${centerY}`}
          rotation={rotationDeg}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ShortsIcon;

