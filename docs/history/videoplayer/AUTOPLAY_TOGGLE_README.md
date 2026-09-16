# Autoplay Toggle Button - YouTube 2025 Style

## Overview

A modern, YouTube 2025-inspired autoplay toggle button with Material 3 design principles. This component enables users to control whether the next video plays automatically after the current one ends.

## ✨ Features

- **YouTube 2025 Design**: Matches YouTube's latest dark mode aesthetic
- **Material 3 Styling**: Rounded capsule toggle with smooth animations
- **Auto-Hide**: Fades in/out with other video controls (tap to show/hide)
- **Smart States**: ON (blue glow), OFF (gray muted), Disabled (dimmed)
- **Smooth Animations**: 
  - Continuous pulse animation when ON
  - Smooth state transitions (0.25-0.3s)
  - Press feedback with scale animation
  - Hover glow effects
  - Auto-hide fade animation (synced with other controls)
- **Accessibility**: Full screen reader support with proper ARIA labels
- **Cross-Platform**: Works on iOS, Android, and Web

## 🎨 Visual Design

### Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#0F0F0F` | YouTube 2025 dark mode background |
| Icon (ON) | `#FFFFFF` | Active white icon |
| Icon (OFF) | `#7A7A7A` | Muted gray icon |
| Active Glow | `#3EA6FF` | YouTube blue glow |
| Disabled | `50% opacity` | When no next video available |

### States

#### 🟢 ON State (Active)
- **Icon**: Play (▶️)
- **Appearance**: White icon with blue glowing ring
- **Animation**: Continuous pulse (1s loop)
- **Hover**: Stronger blue glow + scale (102% → 98%)
- **Meaning**: Next video will play automatically

#### ⚫ OFF State (Inactive)
- **Icon**: Pause (⏸️)
- **Appearance**: Gray translucent without glow
- **Animation**: None
- **Hover**: Faint white glow (10% opacity)
- **Meaning**: Autoplay is disabled

#### 🔒 Disabled State
- **Appearance**: Dimmed (50% opacity)
- **Cursor**: Not allowed
- **Meaning**: No next video available or feature unavailable

## 📦 Installation & Usage

### Basic Usage

```tsx
import AutoplayToggle from '@/components/VideoPlayer/AutoplayToggle';

function VideoControls() {
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  return (
    <AutoplayToggle
      opacity={controller.opacity}  // Auto-hide with other controls
      autoplayEnabled={autoplayEnabled}
      onToggle={() => setAutoplayEnabled(!autoplayEnabled)}
      size={28}
    />
  );
}
```

### Integration with Controls Component

The autoplay toggle is already integrated into the main `Controls.tsx` component:

```tsx
import Controls from '@/components/VideoPlayer/Controls';

// Controls will automatically render the autoplay toggle
<Controls
  // ... other props
  autoplayEnabled={autoplayEnabled}
  handlers={{
    // ... other handlers
    toggleAutoplay: handleToggleAutoplay,
  }}
/>
```

### Integration with useVideoPlayer Hook

```tsx
import useVideoPlayer from '@/components/VideoPlayer/hooks/useVideoPlayer';

function MyVideoPlayer({ sourceUrl }) {
  const { state, handlers, derived } = useVideoPlayer({
    sourceUrl,
    autoplay: true,
    // ... other props
  });

  // Access autoplay state
  const { autoplayEnabled } = state;
  
  // Toggle autoplay
  handlers.toggleAutoplay();

  return (
    <Controls
      autoplayEnabled={state.autoplayEnabled}
      handlers={handlers}
      // ... other props
    />
  );
}
```

## 🎯 Props API

### AutoplayToggle Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoplayEnabled` | `boolean` | required | Whether autoplay is currently enabled |
| `onToggle` | `() => void` | required | Callback when toggle is pressed |
| `size` | `number` | `28` | Button diameter in pixels |
| `disabled` | `boolean` | `false` | Whether the button is disabled |
| `opacity` | `Animated.Value \| number` | `1` | Animated opacity for auto-hide (0-1) |

## 🎬 Animations

### 1. Pulse Animation (ON State)
- **Duration**: 1000ms
- **Loop**: Continuous
- **Effect**: Blue ring scales from 1.0 to 1.15
- **Opacity**: Fades between 0.3 and 0.6

### 2. Press Animation
```typescript
Sequence:
1. Scale to 0.98 (100ms) - Press down
2. Scale to 1.02 (150ms) - Bounce
3. Scale to 1.0 (150ms)  - Settle
Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### 3. Hover Glow
- **Duration**: 200ms
- **Easing**: cubic-bezier(0.4, 0, 0.2, 1)
- **Effect**: Glow fades in/out

## 🔍 Implementation Details

### Component Structure

```
AutoplayToggle
├── Pressable (Touch area)
│   ├── Animated.View (Button container)
│   │   ├── Animated.View (Pulse ring - ON state only)
│   │   ├── Animated.View (Hover glow)
│   │   └── View (Icon wrapper)
│   │       └── IconButton (Play/Pause icon)
│   └── View (Tooltip - Web only)
```

### Animation Values

```typescript
scaleAnim     // Button scale for press feedback
glowAnim      // Hover glow opacity
pulseAnim     // Pulse ring scale & opacity
```

## 🎨 Placement Guidelines

### In Control Bar

```
Left Side          |  Center  |  Right Side
─────────────────────────────────────────────
Play  Mute  Mode   |          |  Loop  [Autoplay]  Fullscreen  Menu
```

**Recommended Position**: Far top right, between Loop and Fullscreen

### Spacing

- **Padding**: 8-10px around the button
- **Spacing from neighbors**: 12px
- **Alignment**: Vertically centered in control bar

## 🧪 Testing

### Demo Component

Preview the autoplay toggle with all states:

```tsx
import { AutoplayToggleDemo } from '@/components/VideoPlayer/AutoplayToggleDemo';

// In your app
<AutoplayToggleDemo />
```

The demo includes:
- Interactive state switching
- All three states (ON, OFF, Disabled)
- Size variations
- Complete design specifications
- Integration examples

### Manual Testing Checklist

- [ ] Toggle switches between ON and OFF
- [ ] Pulse animation plays when ON
- [ ] No animation when OFF
- [ ] Hover effects work (web)
- [ ] Press animation provides feedback
- [ ] Disabled state prevents interaction
- [ ] Tooltip appears on hover (web)
- [ ] Accessible with screen readers
- [ ] Works on all platforms (iOS/Android/Web)

## ♿ Accessibility

### Screen Reader Support

```typescript
accessibilityRole="button"
accessibilityLabel={autoplayEnabled ? "Autoplay is on" : "Autoplay is off"}
accessibilityState={{ checked: autoplayEnabled, disabled }}
```

### Keyboard Navigation

- **Web**: Fully keyboard accessible
- **Tab Navigation**: Focus indicator visible
- **Enter/Space**: Toggles state

## 🎨 Customization

### Custom Sizes

```tsx
<AutoplayToggle size={20} /> // Small
<AutoplayToggle size={24} /> // Medium-small
<AutoplayToggle size={28} /> // Default
<AutoplayToggle size={32} /> // Large
```

### Integration with Theme

The component uses colors from the TOKENS system:

```typescript
// components/VideoPlayer/tokens.ts
export const TOKENS = {
  accent: "#0ea5ff",
  // ... other tokens
};
```

## 📱 Platform-Specific Behavior

### iOS
- Native shadow with shadowColor, shadowOffset, shadowOpacity
- Haptic feedback on toggle (if available)

### Android
- Elevation-based shadow
- Ripple effect on press

### Web
- CSS box-shadow
- Cursor: pointer on hover
- Tooltip appears on hover
- Mouse enter/leave events

## 🚀 Performance

- **Animation**: Uses `useNativeDriver: true` for 60 FPS
- **Memoization**: Component wrapped in `React.memo()`
- **Optimized Re-renders**: Only updates on prop changes

## 🐛 Troubleshooting

### Issue: Pulse animation not showing

**Solution**: Ensure `autoplayEnabled={true}` and `disabled={false}`

### Issue: Tooltip not appearing

**Solution**: Tooltips only work on Web platform. Check `Platform.OS === "web"`

### Issue: Press animation feels sluggish

**Solution**: Verify `useNativeDriver: true` in animation config

## 📚 Related Components

- **Controls**: Main control bar component
- **useVideoPlayer**: Video player state management hook
- **PlayPauseButton**: Center play/pause button
- **NextVideoButton**: Navigate to next video
- **PreviousVideoButton**: Navigate to previous video

## 🎯 Best Practices

1. **State Management**: Store autoplay preference in persistent storage
2. **User Experience**: Default to OFF for better user control
3. **Feedback**: Provide visual confirmation when state changes
4. **Accessibility**: Always include descriptive labels
5. **Performance**: Use memoization to prevent unnecessary re-renders

## 📝 License

Part of the expo-live-player video player component library.

## 🤝 Contributing

When modifying the autoplay toggle:

1. Maintain YouTube 2025 design consistency
2. Test on all platforms (iOS, Android, Web)
3. Verify accessibility with screen readers
4. Update the demo component
5. Document any new props or behaviors
6. Run linter: `npm run lint`

## 📖 Additional Resources

- [YouTube Design System](https://www.youtube.com)
- [Material 3 Design](https://m3.material.io/)
- [React Native Animated API](https://reactnative.dev/docs/animated)
- [Accessibility Guidelines](https://reactnative.dev/docs/accessibility)

