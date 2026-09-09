# Autoplay Notification Component

## Overview

A toast notification component that displays temporary messages when the autoplay state changes. The notification appears for 3 seconds and then automatically dismisses with smooth fade animations.

## ✨ Features

- **Auto-Dismiss**: Automatically disappears after 3 seconds
- **Smooth Animations**: 
  - Fade in/out (200ms)
  - Slide down/up animation
  - Uses native driver for 60 FPS
- **YouTube 2025 Style**: Dark semi-transparent background
- **Non-Intrusive**: Positioned at top center, doesn't block controls
- **Accessible**: Proper ARIA labels for screen readers

## 🎨 Visual Design

### Appearance
- **Background**: `rgba(0, 0, 0, 0.85)` - Semi-transparent black
- **Border**: `1px solid rgba(255, 255, 255, 0.1)` - Subtle white border
- **Text**: White, 14px, semi-bold (font-weight: 600)
- **Padding**: 12px vertical, 20px horizontal
- **Border Radius**: 8px (rounded corners)
- **Shadow**: Material Design elevation shadow

### Position
- **Top**: 60px from top of video player
- **Horizontal**: Centered
- **Z-Index**: 2000 (appears above all controls)

## 📦 Usage

### Basic Usage

```tsx
import AutoplayNotification from '@/components/VideoPlayer/AutoplayNotification';

function VideoPlayer() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const showNotification = (text: string) => {
    setMessage(text);
    setVisible(true);
  };

  return (
    <View>
      {/* Your video player */}
      
      <AutoplayNotification
        visible={visible}
        message={message}
        onDismiss={() => setVisible(false)}
      />
    </View>
  );
}
```

### With Autoplay Toggle

```tsx
const handleToggleAutoplay = () => {
  setAutoplayEnabled((prev) => {
    const newState = !prev;
    setNotificationMessage(newState ? "Autoplay is on" : "Autoplay is off");
    setNotificationVisible(true);
    return newState;
  });
};

<AutoplayNotification
  visible={notificationVisible}
  message={notificationMessage}
  onDismiss={() => setNotificationVisible(false)}
/>
```

## 🎯 Props API

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `boolean` | ✅ | Controls visibility of the notification |
| `message` | `string` | ✅ | Text to display in the notification |
| `onDismiss` | `() => void` | ✅ | Callback when notification dismisses |

## 🎬 Animation Timeline

```
User Action (Toggle):
    ↓
Notification Appears:
    - Opacity: 0 → 1 (200ms)
    - TranslateY: -20 → 0 (200ms)
    ↓
Display for 3 seconds
    ↓
Auto-Dismiss:
    - Opacity: 1 → 0 (200ms)
    - TranslateY: 0 → -20 (200ms)
    ↓
onDismiss() callback fired
```

### Animation Details

**Fade In:**
- Duration: 200ms
- Easing: `Easing.out(Easing.ease)`
- Property: opacity (0 → 1)
- Property: translateY (-20 → 0)

**Display Duration:**
- 3000ms (3 seconds)

**Fade Out:**
- Duration: 200ms
- Easing: `Easing.in(Easing.ease)`
- Property: opacity (1 → 0)
- Property: translateY (0 → -20)

## 📱 Platform Support

### iOS
- Native shadow with shadowColor, shadowOffset
- Smooth 60 FPS animations
- Works with VoiceOver

### Android
- Elevation-based shadow
- Material Design compliant
- Works with TalkBack

### Web
- CSS box-shadow
- Smooth transitions
- Keyboard accessible

## 🎨 Customization

The component uses inline styles, but you can easily customize by modifying the `styles` object:

```tsx
const styles = RN.StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,  // Adjust position
    // ...
  },
  notification: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",  // Change color
    paddingVertical: 12,  // Adjust padding
    // ...
  },
  message: {
    color: "#FFFFFF",  // Change text color
    fontSize: 14,  // Adjust font size
    // ...
  },
});
```

## ⚡ Performance

- **Native Driver**: Uses `useNativeDriver: true` for all animations
- **Efficient Rendering**: Only renders when visible
- **Automatic Cleanup**: Timer is properly cleared on unmount
- **Zero Re-renders**: Animations don't trigger component re-renders

## 🧪 Testing

### Manual Testing Checklist

- [ ] Notification appears when triggered
- [ ] Message text displays correctly
- [ ] Fades in smoothly (200ms)
- [ ] Displays for exactly 3 seconds
- [ ] Fades out smoothly (200ms)
- [ ] onDismiss callback fires
- [ ] Multiple triggers queue properly
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web

## 🎯 Common Use Cases

### 1. Autoplay State Change
```tsx
const message = autoplayEnabled ? "Autoplay is on" : "Autoplay is off";
showNotification(message);
```

### 2. Quality Change
```tsx
showNotification(`Quality changed to ${quality}`);
```

### 3. Playback Speed
```tsx
showNotification(`Playback speed: ${speed}x`);
```

### 4. Caption Toggle
```tsx
const message = captionsEnabled ? "Captions on" : "Captions off";
showNotification(message);
```

## 🐛 Troubleshooting

### Issue: Notification doesn't appear

**Solution**: 
- Check that `visible={true}` is set
- Verify `message` prop has content
- Ensure component is rendered in the tree

### Issue: Notification doesn't dismiss

**Solution**:
- Check that `onDismiss` callback is provided
- Verify the callback sets `visible={false}`
- Check console for timer cleanup errors

### Issue: Multiple notifications overlap

**Solution**:
- Implement a queue system
- Or dismiss current before showing new
- Or prevent multiple triggers

```tsx
const showNotification = (text: string) => {
  setNotificationVisible(false);  // Dismiss current
  setTimeout(() => {
    setNotificationMessage(text);
    setNotificationVisible(true);
  }, 250);  // Brief delay for clean transition
};
```

## 🎓 Best Practices

1. **Keep Messages Short**: Max 3-4 words for readability
2. **Use Consistent Timing**: Stick to 3 seconds for predictability
3. **Don't Spam**: Limit notifications to important state changes
4. **Provide Feedback**: Always show notification for toggle actions
5. **Test Accessibility**: Verify screen reader announcements

## 🔗 Related Components

- **AutoplayToggle**: The toggle button that triggers this notification
- **Controls**: Main control bar component
- **VideoPlayer**: Main video player component

## 📝 Example: Complete Integration

```tsx
import { useState, useCallback } from 'react';
import AutoplayToggle from './AutoplayToggle';
import AutoplayNotification from './AutoplayNotification';

function VideoPlayer() {
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  const handleToggleAutoplay = useCallback(() => {
    setAutoplayEnabled((prev) => {
      const newState = !prev;
      setNotificationMessage(newState ? "Autoplay is on" : "Autoplay is off");
      setNotificationVisible(true);
      return newState;
    });
  }, []);

  return (
    <View style={styles.player}>
      {/* Video content */}
      
      <AutoplayToggle
        autoplayEnabled={autoplayEnabled}
        onToggle={handleToggleAutoplay}
      />
      
      <AutoplayNotification
        visible={notificationVisible}
        message={notificationMessage}
        onDismiss={() => setNotificationVisible(false)}
      />
    </View>
  );
}
```

## 📄 License

Part of the expo-live-player video player component library.

