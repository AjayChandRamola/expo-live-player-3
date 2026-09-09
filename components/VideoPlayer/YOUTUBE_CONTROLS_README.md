# YouTube-Style Video Control Buttons

High-quality UI control buttons designed to exactly match YouTube's in-player dark theme interface (2024-2025 aesthetic).

## 📦 Components

### `PreviousVideoButton.tsx`
YouTube-style Previous Video button with left-pointing double arrows (◄◄).

### `NextVideoButton.tsx`
YouTube-style Next Video button with right-pointing double arrows (►►).

### `YouTubeControlsDemo.tsx`
Interactive demo component showcasing all button states and layouts.

---

## 🎨 Design Specifications

### Visual Style
- **Aesthetic**: Modern YouTube dark mode (2024-2025)
- **Shape**: Circular buttons with translucent black backgrounds
- **Icons**: Bold white SVG double-arrows (active) or gray (disabled)
- **Shadows**: Soft Material Design shadows for depth
- **Background**: Transparent for easy integration

### Button Dimensions
- **Previous/Next**: 64px diameter (smaller than Play/Pause for visual hierarchy)
- **Play/Pause**: 80px diameter (primary control)
- **Export Resolution**: 1024×1024px PNG (4× scale for crisp rendering)

### Color Palette

#### Active State
- Icon: `#FFFFFF` (pure white)
- Background: `rgba(0,0,0,0.65)` (65% opacity black)
- Shadow: `rgba(0,0,0,0.3)` with 4px blur, 2px offset

#### Disabled State
- Icon: `#999999` (light gray)
- Background: `rgba(0,0,0,0.4)` (40% opacity black)
- Shadow: None (visually inactive)

### Animations
- **Press**: Scale down to 0.92 with spring bounce (YouTube-style feedback)
- **Hover**: Slight brightness increase (web)
- **Duration**: 150-200ms with cubic-bezier easing

---

## 🚀 Usage

### Basic Implementation

```tsx
import { PreviousVideoButton } from '@/components/VideoPlayer/PreviousVideoButton';
import { NextVideoButton } from '@/components/VideoPlayer/NextVideoButton';

function MyVideoPlayer() {
  const handlePrevious = () => {
    // Navigate to previous video
    console.log('Previous video');
  };

  const handleNext = () => {
    // Navigate to next video
    console.log('Next video');
  };

  return (
    <View style={styles.controlBar}>
      {/* Previous Button */}
      <PreviousVideoButton
        onPress={handlePrevious}
        disabled={!hasPreviousVideo}
        size={64}
      />

      {/* Play/Pause Button */}
      <PlayPauseButton
        opacity={controlOpacity}
        isPlaying={isPlaying}
        onPress={togglePlayPause}
        size={80}
        accentColor="#FFFFFF"
      />

      {/* Next Button */}
      <NextVideoButton
        onPress={handleNext}
        disabled={!hasNextVideo}
        size={64}
      />
    </View>
  );
}
```

### With Animated Opacity (YouTube-style fade in/out)

```tsx
import { Animated } from 'react-native';

const controlOpacity = useRef(new Animated.Value(1)).current;

<PreviousVideoButton
  opacity={controlOpacity}
  onPress={handlePrevious}
  disabled={false}
  size={64}
/>
```

### Custom Styling

```tsx
<PreviousVideoButton
  onPress={handlePrevious}
  size={64}
  style={{
    position: 'absolute',
    bottom: 100,
    left: 100,
  }}
  showPressedState={true}
/>
```

---

## 📋 Component Props

### `PreviousVideoButton` & `NextVideoButton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onPress` | `() => void` | **Required** | Callback when button is pressed |
| `disabled` | `boolean` | `false` | Whether button is disabled (gray icon, no shadow) |
| `opacity` | `Animated.Value` | `undefined` | Animated opacity for fade in/out controls |
| `size` | `number` | `64` | Button diameter in pixels |
| `style` | `ViewStyle` | `undefined` | Additional container styles |
| `showPressedState` | `boolean` | `true` | Whether to animate press feedback |

---

## 🎬 Demo Component

View all button states and variations:

```tsx
import { YouTubeControlsDemo } from '@/components/VideoPlayer/YouTubeControlsDemo';

export default function DemoScreen() {
  return <YouTubeControlsDemo />;
}
```

The demo includes:
- ✅ Active state buttons
- ✅ Disabled state buttons
- ✅ Complete control bar layout (Previous → Play/Pause → Next)
- ✅ Individual button showcase
- ✅ Design specifications reference

---

## 🖼️ Generating PNG Exports

### Method 1: Web Export Tool (Recommended)

1. Open `assets/button-export-tool.html` in your browser
2. Click **"Download PNG"** for each button variant
3. Exports as 1024×1024px PNG with transparent background

### Method 2: Screenshot from Demo

1. Run the demo component: `<YouTubeControlsDemo />`
2. Take high-resolution screenshots of individual buttons
3. Crop to square (1:1 aspect ratio)
4. Export as PNG with transparency

### Method 3: React Native to PNG

```bash
# Run on web platform
npm run web

# Navigate to demo component
# Use browser dev tools to capture canvas/screenshot
# Recommended tools: Chrome DevTools, Figma, Sketch
```

---

## 🎯 Layout Guidelines

### YouTube Control Bar Pattern

```
┌─────────────────────────────────────┐
│                                     │
│    ◄◄        ▶        ►►           │
│  Previous   Play    Next            │
│   (64px)   (80px)  (64px)           │
│                                     │
└─────────────────────────────────────┘
```

### Spacing Recommendations
- **Between buttons**: 24-32px
- **Control bar padding**: 16-24px
- **Bottom offset**: 60-80px from video bottom
- **Horizontal alignment**: Center

### Visual Hierarchy
1. **Primary**: Play/Pause (80px, center, most prominent)
2. **Secondary**: Previous/Next (64px, flanking play button)
3. **Tertiary**: Other controls (mute, fullscreen, etc.)

---

## ♿ Accessibility

All buttons include:
- ✅ `accessible` prop enabled
- ✅ `accessibilityRole="button"`
- ✅ `accessibilityLabel` (descriptive text)
- ✅ `accessibilityState={{ disabled }}` for disabled buttons
- ✅ Touch target: minimum 48×48px (meets WCAG 2.1 AA)

### Screen Reader Announcements

**Active State:**
- Previous: *"Previous video, button"*
- Next: *"Next video, button"*

**Disabled State:**
- Previous: *"Previous video (unavailable), button, disabled"*
- Next: *"Next video (unavailable), button, disabled"*

---

## 🎨 Integration with Existing Controls

These buttons work seamlessly with your existing `VideoPlayer` components:

```tsx
// components/VideoPlayer/Controls.tsx

import { PreviousVideoButton } from './PreviousVideoButton';
import { NextVideoButton } from './NextVideoButton';

// Add to control bar alongside existing buttons
<RN.View style={handlers.styles.row}>
  <PreviousVideoButton
    opacity={anim}
    onPress={handlers.navigateToPrevious}
    disabled={!hasPreviousVideo}
    size={64}
  />
  
  <Pressable onPress={handlers.togglePlay}>
    <IconButton icon={isPlaying ? "pause" : "play"} />
  </Pressable>
  
  <NextVideoButton
    opacity={anim}
    onPress={handlers.navigateToNext}
    disabled={!hasNextVideo}
    size={64}
  />
</RN.View>
```

---

## 🔧 Customization

### Changing Button Size

```tsx
// Smaller buttons (mobile portrait)
<PreviousVideoButton size={56} />

// Larger buttons (tablet/desktop)
<PreviousVideoButton size={72} />
```

### Custom Icon Colors

Edit the component files to change colors:

```tsx
// PreviousVideoButton.tsx
const iconColor = disabled ? "#FF6B6B" : "#00FF00"; // Custom colors
```

### Background Opacity

```tsx
const bgOpacity = disabled ? 0.3 : 0.8; // More/less transparency
```

---

## 📱 Platform Support

| Platform | Supported | Notes |
|----------|-----------|-------|
| **iOS** | ✅ | Full support with native shadows |
| **Android** | ✅ | Uses elevation for shadows |
| **Web** | ✅ | CSS box-shadow fallback |
| **Mobile** | ✅ | Optimized touch targets |
| **Tablet** | ✅ | Scales appropriately |
| **Desktop** | ✅ | Hover states included |

---

## 🐛 Troubleshooting

### Icons Not Showing

**Issue**: SVG icons don't render
**Solution**: Ensure `react-native-svg` is installed

```bash
npm install react-native-svg
# or
expo install react-native-svg
```

### Buttons Not Pressable

**Issue**: Buttons don't respond to touch
**Solution**: Check `pointerEvents` on parent containers

```tsx
<View pointerEvents="box-none"> {/* Allow touch passthrough */}
  <PreviousVideoButton ... />
</View>
```

### Animation Lag

**Issue**: Press animation stutters
**Solution**: Enable native driver (already enabled by default)

```tsx
Animated.spring(scaleAnim, {
  toValue: 0.92,
  useNativeDriver: true, // ✅ Enabled
})
```

---

## 📦 Dependencies

Required packages (already in your project):
- `react` ✅
- `react-native` ✅
- `react-native-svg` ✅

No additional dependencies needed!

---

## 🎓 Best Practices

### Do ✅
- Use `disabled` prop when no previous/next video exists
- Maintain consistent button sizes across your app
- Test on multiple device sizes (phone, tablet, desktop)
- Include accessibility labels
- Use animated opacity for showing/hiding controls

### Don't ❌
- Don't make buttons too small (< 48px touch target)
- Don't override `onPress` error handling without logging
- Don't remove accessibility props
- Don't use non-standard colors (breaks YouTube aesthetic)
- Don't animate both `opacity` and `scale` simultaneously (performance)

---

## 📄 License

These components are part of the Expo Live Player project.
Free to use and modify within the project scope.

---

## 🤝 Contributing

To improve these components:

1. Test on iOS, Android, and Web
2. Maintain YouTube aesthetic consistency
3. Keep accessibility support intact
4. Update this README with changes
5. Add unit tests if modifying core logic

---

## 📞 Support

For issues or questions:
- Check the demo component: `YouTubeControlsDemo.tsx`
- Review existing `PlayPauseButton.tsx` for patterns
- Consult `tokens.ts` for design tokens

---

**Created**: November 2025  
**Version**: 1.0.0  
**Aesthetic**: YouTube Dark Mode 2024-2025

