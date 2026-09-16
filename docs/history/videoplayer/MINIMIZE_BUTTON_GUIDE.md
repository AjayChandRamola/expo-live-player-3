# 📐 Minimize/Restore Video Button - Implementation Guide

YouTube-style Picture-in-Picture minimize button with smooth state transitions.

---

## 🎨 Button Design

### Visual Specifications

#### Minimize State (˄)
```
┌─────────────┐
│             │
│  ┌───────┐  │
│  │   ˄   │  │  ← Upward caret
│  │       │  │     White #FFFFFF
│  │ 48px  │  │     Dark background
│  └───────┘  │     With shadow
│             │
└─────────────┘
```

**Properties:**
- **Icon**: Upward caret (˄)
- **Color**: `#FFFFFF` (white)
- **Background**: `rgba(0,0,0,0.65)`
- **Shadow**: `0px 2px 4px rgba(0,0,0,0.3)`
- **Size**: 48px diameter
- **Function**: Minimizes video to bottom-right corner

#### Restore State (˅)
```
┌─────────────┐
│             │
│  ┌───────┐  │
│  │   ˅   │  │  ← Downward caret
│  │       │  │     (rotated 180°)
│  │ 48px  │  │
│  └───────┘  │
│             │
└─────────────┘
```

**Properties:**
- **Icon**: Downward caret (˅) - rotated 180°
- **Color**: `#FFFFFF` (white)
- **Background**: `rgba(0,0,0,0.65)`
- **Shadow**: `0px 2px 4px rgba(0,0,0,0.3)`
- **Size**: 48px diameter
- **Function**: Restores video to full screen

#### Disabled State
```
┌─────────────┐
│             │
│  ┌───────┐  │
│  │   ˄   │  │  ← Gray icon
│  │ #999  │  │     40% opacity
│  │ 48px  │  │     No shadow
│  └───────┘  │
│             │
└─────────────┘
```

**Properties:**
- **Icon**: `#999999` (gray)
- **Background**: `rgba(0,0,0,0.4)`
- **Shadow**: None
- **Size**: 48px diameter

---

## 🎬 Animation Behavior

### Icon Rotation
- **Minimize → Restore**: Rotates 180° clockwise (smooth spring animation)
- **Restore → Minimize**: Rotates 180° counter-clockwise
- **Duration**: ~300ms with spring physics
- **Easing**: Native spring with bounce

### Press Animation
- **Scale**: 1.0 → 0.92 on press
- **Release**: Springs back to 1.0 with bounce
- **Duration**: 150ms

---

## 🚀 Usage

### Basic Implementation

```tsx
import { MinimizeButton } from '@/components/VideoPlayer/MinimizeButton';

function VideoControls() {
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
    // Add your minimize/restore logic here
  };

  return (
    <MinimizeButton
      isMinimized={isMinimized}
      onPress={handleToggleMinimize}
      size={48}
    />
  );
}
```

### With Animated Opacity

```tsx
import { Animated } from 'react-native';

const controlOpacity = useRef(new Animated.Value(1)).current;

<MinimizeButton
  opacity={controlOpacity}
  isMinimized={isMinimized}
  onPress={handleToggleMinimize}
  size={48}
/>
```

### In Control Bar (YouTube Layout)

```tsx
<View style={styles.controlRow}>
  <PreviousVideoButton {...prevProps} />
  
  <PlayPauseButton {...playProps} />
  
  <NextVideoButton {...nextProps} />
  
  <MinimizeButton
    isMinimized={isMinimized}
    onPress={handleToggleMinimize}
    size={48}
    style={{ marginLeft: 16 }}
  />
</View>
```

---

## 📋 Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onPress` | `() => void` | **Required** | Callback when button is pressed |
| `isMinimized` | `boolean` | `false` | Whether video is currently minimized (controls icon rotation) |
| `disabled` | `boolean` | `false` | Whether button is disabled (gray icon, no shadow) |
| `opacity` | `Animated.Value` | `undefined` | Animated opacity for fade in/out controls |
| `size` | `number` | `48` | Button diameter in pixels |
| `style` | `ViewStyle` | `undefined` | Additional container styles |
| `showPressedState` | `boolean` | `true` | Whether to animate press feedback |

---

## 🎯 Full Implementation Example

### Video Screen with Minimize

```tsx
// app/video/[id].tsx

import { useState, useCallback } from 'react';
import VideoPlayer from '@/components/VideoPlayer';

export default function VideoScreen() {
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
    console.log(`Video ${isMinimized ? "restored" : "minimized"}`);
  }, [isMinimized]);

  return (
    <View style={styles.container}>
      {/* Full or Minimized Video Container */}
      <View style={isMinimized ? styles.minimized : styles.full}>
        <VideoPlayer
          sourceUrl={videoUrl}
          isMinimized={isMinimized}
          onToggleMinimize={handleToggleMinimize}
        />
      </View>

      {/* Background content visible when minimized */}
      {isMinimized && (
        <View style={styles.backgroundContent}>
          <Text>Video minimized to bottom-right corner</Text>
          <Button
            title="Restore Video"
            onPress={handleToggleMinimize}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  full: {
    width: '100%',
  },
  minimized: {
    position: 'absolute',
    bottom: 20,
    right: 12,
    width: 240,
    zIndex: 1000,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
  },
  backgroundContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});
```

---

## 🎨 Button Position in Control Bar

### YouTube Layout (Left to Right)

```
┌────────────────────────────────────────────────┐
│                                                │
│    ◄◄        ▶        ►►        ˄            │
│  Previous   Play    Next    Minimize          │
│   (64px)   (80px)  (64px)   (48px)            │
│                                                │
└────────────────────────────────────────────────┘
```

### Spacing Recommendations
- **Between navigation buttons**: 24px
- **Before minimize button**: 16px (smaller gap for secondary control)
- **Button sizes**:
  - Previous/Next: 64px (80% of Play button)
  - Play/Pause: 80px (primary control)
  - Minimize: 48px (60% of Play button - secondary control)

---

## 🖼️ Minimized Video Appearance

### Default Minimized Style (YouTube-inspired)

```tsx
const minimizedStyle = {
  position: 'absolute',
  bottom: 20,
  right: 12,
  width: 240,              // 16:9 aspect ratio maintained
  zIndex: 1000,            // Always on top
  borderRadius: 12,        // Rounded corners
  overflow: 'hidden',
  elevation: 8,            // Material Design shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
};
```

### Visual Example

```
┌─────────────────────────────────────────┐
│                                         │
│  Background Content / Video List        │
│                                         │
│                     ┌──────────────┐    │
│                     │  Mini Video  │◄───┤ 240px wide
│                     │  ◄◄  ▶  ►►  │    │ Floating overlay
│                     │   Controls   │    │ Bottom-right
│                     └──────────────┘    │
└─────────────────────────────────────────┘
```

---

## ♿ Accessibility

### Screen Reader Announcements

**Minimize State (˄):**
- *"Minimize video to picture-in-picture, button"*

**Restore State (˅):**
- *"Restore video to full screen, button"*

**Disabled State:**
- *"Minimize video to picture-in-picture (unavailable), button, disabled"*

### Accessibility Features
- ✅ `accessible` prop enabled
- ✅ `accessibilityRole="button"`
- ✅ Dynamic `accessibilityLabel` based on state
- ✅ `accessibilityState={{ disabled }}` for disabled state
- ✅ Minimum 48px touch target (meets WCAG 2.1 AA)

---

## 🎨 State Visualization

### Full Screen → Minimized Transition

```
Step 1: Full Screen               Step 2: Minimized
┌──────────────────────┐          ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │          │                      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │          │   Background Content │
│ ▓▓▓  Video  ▓▓▓▓▓▓▓ │  ──────► │                      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │          │          ┌──────┐    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │          │          │ Mini │    │
│  ◄◄   ▶   ►►   ˄   │          │          └──────┘    │
└──────────────────────┘          └──────────────────────┘
   User taps ˄ (minimize)            Video shrinks & moves
```

---

## 📦 Export PNG Assets

### Using the Export Tool

1. Open `assets/youtube-controls-export-complete.html` in browser
2. Scroll to "Minimize / Restore Button" section
3. Download all variants:
   - ✅ Minimize (˄) - Active
   - ✅ Restore (˅) - Active
   - ✅ Minimize - Disabled

### File Outputs
```
minimize-video-active.png      1024×1024px, transparent
restore-video-active.png       1024×1024px, transparent
minimize-video-disabled.png    1024×1024px, transparent
```

---

## 🎓 Best Practices

### Do ✅
- Use 48px size for minimize button (secondary control)
- Place after navigation buttons in control bar
- Animate icon rotation smoothly (180° spring)
- Show clear feedback when video is minimized
- Provide restore button or tap-to-restore functionality
- Maintain 16:9 aspect ratio for minimized video
- Use rounded corners (12px) for minimized overlay

### Don't ❌
- Don't make button larger than Play/Pause (breaks hierarchy)
- Don't skip the rotation animation (feels abrupt)
- Don't hide minimized video without visual indicator
- Don't minimize without user action
- Don't obscure important UI with minimized video
- Don't use hard edges for minimized overlay (use rounded corners)

---

## 🔧 Customization

### Custom Button Size

```tsx
// Smaller for mobile
<MinimizeButton size={40} />

// Larger for desktop
<MinimizeButton size={56} />
```

### Custom Icon Color

Edit the component file:

```tsx
// MinimizeButton.tsx
const iconColor = disabled ? "#FF6B6B" : "#00FF00"; // Custom colors
```

### Custom Background

```tsx
const bgOpacity = disabled ? 0.3 : 0.8; // More/less transparency
```

---

## 🐛 Troubleshooting

### Icon Not Rotating

**Issue**: Icon doesn't rotate when `isMinimized` changes  
**Solution**: Ensure `isMinimized` prop is being updated correctly

```tsx
// Make sure state updates
const [isMinimized, setIsMinimized] = useState(false);

const handlePress = () => {
  setIsMinimized(!isMinimized); // ✅ Correct
  console.log('New state:', !isMinimized); // Debug
};
```

### Minimized Video Not Showing

**Issue**: Video disappears when minimized  
**Solution**: Check z-index and positioning

```tsx
const minimizedStyle = {
  position: 'absolute', // Must be absolute
  zIndex: 1000,         // Must be high enough
  bottom: 20,
  right: 12,
};
```

### Animation Lag

**Issue**: Rotation animation stutters  
**Solution**: Native driver is enabled by default, but ensure no heavy renders

```tsx
// Already optimized in component
useNativeDriver: true // ✅ Enabled
```

---

## 📱 Platform Support

| Platform | Status | Features |
|----------|--------|----------|
| **iOS** | ✅ Full | Native shadows, smooth animations, spring physics |
| **Android** | ✅ Full | Elevation shadows, native animations |
| **Web** | ✅ Full | CSS shadows, transform animations |
| **Mobile** | ✅ Optimized | 48px touch target, responsive sizing |
| **Tablet** | ✅ Optimized | Scales appropriately with larger buttons |
| **Desktop** | ✅ Optimized | Hover states, larger click area |

---

## 📊 Button Comparison Table

| Button | Size | Function | Position | Priority |
|--------|------|----------|----------|----------|
| **Previous** | 64px | Navigate to previous video | Left | Secondary |
| **Play/Pause** | 80px | Play/pause current video | Center | Primary |
| **Next** | 64px | Navigate to next video | Right-Center | Secondary |
| **Minimize** | 48px | Minimize/restore video | Right | Tertiary |

---

## 🎬 Complete Example

See the implementation in action:
- **Component**: `components/VideoPlayer/MinimizeButton.tsx`
- **Video Player**: `components/VideoPlayer/index.tsx`
- **Video Screen**: `app/video/[id].tsx`
- **Export Tool**: `assets/youtube-controls-export-complete.html`

---

**Created**: November 2025  
**Version**: 1.0.0  
**Aesthetic**: YouTube Dark Mode 2024-2025  
**Button Type**: Secondary Control (Minimize/PiP)

