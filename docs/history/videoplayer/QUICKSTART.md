# 🚀 Quick Start - YouTube Video Control Buttons

Get started with YouTube-style Previous/Next video buttons in under 5 minutes.

---

## ⚡ Installation (Already Complete!)

These components are ready to use. Dependencies already installed:
- ✅ `react-native-svg` (for icons)
- ✅ `react-native` (core)

---

## 📖 Basic Usage

### 1. Import the Buttons

```tsx
import {
  PreviousVideoButton,
  NextVideoButton,
  PlayPauseButton,
} from '@/components/VideoPlayer/NavigationButtons';
```

### 2. Add to Your Video Player

```tsx
function VideoControls() {
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <View style={styles.controlBar}>
      {/* Previous Video */}
      <PreviousVideoButton
        onPress={() => console.log('Previous')}
        disabled={false}
      />
      
      {/* Play/Pause */}
      <PlayPauseButton
        opacity={new Animated.Value(1)}
        isPlaying={isPlaying}
        onPress={() => setIsPlaying(!isPlaying)}
        accentColor="#FFFFFF"
      />
      
      {/* Next Video */}
      <NextVideoButton
        onPress={() => console.log('Next')}
        disabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24, // spacing between buttons
  },
});
```

---

## 🎨 View Demo

See all button states in action:

```tsx
import { YouTubeControlsDemo } from '@/components/VideoPlayer/NavigationButtons';

export default function DemoScreen() {
  return <YouTubeControlsDemo />;
}
```

**Add to your app:**
```tsx
// app/(tabs)/explore.tsx or any screen
import { YouTubeControlsDemo } from '@/components/VideoPlayer/NavigationButtons';

export default function ExploreScreen() {
  return <YouTubeControlsDemo />;
}
```

---

## 🖼️ Export PNG Assets

### Option 1: Web Export Tool
1. Open `assets/button-export-tool.html` in browser
2. Click "Download PNG" buttons
3. Get 1024×1024px transparent PNGs

### Option 2: From Demo
1. Run `npm run web`
2. Navigate to demo component
3. Screenshot individual buttons

---

## 🎯 Common Use Cases

### With Playlist Navigation

```tsx
function PlaylistPlayer({ playlist, currentIndex }) {
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < playlist.length - 1;
  
  return (
    <View style={styles.controls}>
      <PreviousVideoButton
        onPress={() => playVideo(currentIndex - 1)}
        disabled={!hasPrevious}
      />
      
      <NextVideoButton
        onPress={() => playVideo(currentIndex + 1)}
        disabled={!hasNext}
      />
    </View>
  );
}
```

### With Animated Controls

```tsx
function VideoPlayer() {
  const controlOpacity = useRef(new Animated.Value(0)).current;
  
  const showControls = () => {
    Animated.timing(controlOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  
  return (
    <View>
      <PreviousVideoButton
        opacity={controlOpacity}
        onPress={handlePrevious}
      />
    </View>
  );
}
```

---

## 📱 Responsive Sizing

```tsx
// Mobile portrait (smaller)
<PreviousVideoButton size={56} />

// Tablet/Desktop (default)
<PreviousVideoButton size={64} />

// Large screens
<PreviousVideoButton size={72} />
```

---

## ✨ Button States

| State | When to Use | Visual |
|-------|-------------|--------|
| **Active** | Video available to navigate | White icon, shadow |
| **Disabled** | No video available | Gray icon, no shadow |
| **Pressed** | User tapping | Scales to 0.92 |

```tsx
// Dynamically toggle based on availability
<PreviousVideoButton
  disabled={currentVideoIndex === 0}
  onPress={navigateToPrevious}
/>
```

---

## 🎨 Visual Layout

```
Recommended YouTube-style layout:

┌────────────────────────────────┐
│                                │
│     ◄◄      ▶      ►►         │
│  Previous  Play   Next         │
│   64px    80px   64px          │
│                                │
└────────────────────────────────┘

Spacing: 24-32px between buttons
```

---

## ♿ Accessibility (Built-in)

All buttons include:
- ✅ Screen reader labels
- ✅ Button role
- ✅ Disabled state announcements
- ✅ 48px minimum touch targets

---

## 🔗 Related Files

- **Components**: `components/VideoPlayer/`
  - `PreviousVideoButton.tsx` - Previous button
  - `NextVideoButton.tsx` - Next button
  - `YouTubeControlsDemo.tsx` - Interactive demo
  - `NavigationButtons.ts` - Centralized exports

- **Documentation**:
  - `YOUTUBE_CONTROLS_README.md` - Full documentation
  - `QUICKSTART.md` - This file

- **Tools**:
  - `assets/button-export-tool.html` - PNG export tool

---

## 🐛 Need Help?

1. **Check the demo**: Run `<YouTubeControlsDemo />`
2. **Read full docs**: See `YOUTUBE_CONTROLS_README.md`
3. **Review existing code**: Check `PlayPauseButton.tsx` for patterns

---

## 📦 Export Summary

**What You Get:**
- ✅ `PreviousVideoButton` component (active + disabled)
- ✅ `NextVideoButton` component (active + disabled)
- ✅ `YouTubeControlsDemo` (interactive preview)
- ✅ PNG export tool (1024×1024px transparent)
- ✅ Complete documentation
- ✅ TypeScript types
- ✅ Accessibility support

**Ready to use in:**
- React Native (iOS/Android)
- Expo
- React Native Web

---

**🎉 You're all set!** Start by viewing the demo, then integrate into your video player.

```bash
# Run your app
npm start

# View on web (for PNG exports)
npm run web
```

