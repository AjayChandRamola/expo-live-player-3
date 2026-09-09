# Shorts Feature - Quick Start Guide

## 🚀 Getting Started

This guide will help you quickly understand and use the new Shorts feature.

## For Users

### How to Access Shorts

1. **Open the app**
2. **Look at the bottom navigation bar**
3. **Tap the Shorts tab** (2nd icon from the left)

The Shorts icon looks like a slanted pill with a play triangle - similar to YouTube Shorts!

### How to Use Shorts

#### Navigation
- **Swipe UP**: Go to next video
- **Swipe DOWN**: Go to previous video
- **Tap center**: Play/Pause video
- **Tap tab again**: Return to first video

#### Controls
- **🔇 Mute Icon**: Toggle sound on/off (bottom right)
- **👍 Like**: Like the video
- **👎 Dislike**: Dislike the video
- **🔗 Share**: Share the video

### Features
- ✅ Videos auto-play when you scroll to them
- ✅ Full-screen vertical format (optimized for mobile)
- ✅ Smooth swipe gestures
- ✅ Muted by default (tap to unmute)
- ✅ See channel name, title, and view count

---

## For Developers

### File Locations

```
app/(tabs)/shorts.tsx              # Main Shorts screen
components/ui/ShortsIcon.tsx       # Tab icon
components/Shorts/ShortVideoPlayer.tsx  # Video player
```

### Quick Code Tour

#### 1. Tab Integration (app/(tabs)/_layout.tsx)

```tsx
import { ShortsIcon } from "../../components/ui/ShortsIcon";

<Tabs.Screen
  name="shorts"
  options={{
    tabBarIcon: ({ color, focused }) => (
      <ShortsIcon color={color} active={focused} />
    ),
  }}
  listeners={{
    tabPress: () => {
      Logger.info("[Analytics] shorts_tab_open", {
        source: "tab",
        timestamp: new Date().toISOString(),
      });
    },
  }}
/>
```

#### 2. Shorts Screen (app/(tabs)/shorts.tsx)

Key features:
- FlatList with vertical paging
- Lazy loading of video player
- Auto-play focused video
- Error handling with retry
- Analytics logging

```tsx
<FlatList
  data={shorts}
  renderItem={renderShort}
  pagingEnabled
  snapToInterval={SCREEN_HEIGHT}
  onViewableItemsChanged={handleViewableItemsChanged}
/>
```

#### 3. Video Player (components/Shorts/ShortVideoPlayer.tsx)

Features:
- expo-video integration
- Play/pause, mute/unmute
- Info overlay
- Action buttons

```tsx
const player = useVideoPlayer(video.videoUrl, (player) => {
  player.loop = true;
  player.muted = isMuted;
});
```

### Customization

#### Change Video Filter (only show videos < 60 seconds)

```tsx
// In app/(tabs)/shorts.tsx
const shortVideos = response.videos.filter((v) => v.duration <= 60);
```

#### Modify Page Size

```tsx
// In app/(tabs)/shorts.tsx
const response = await getVideos({ pageSize: 20 }); // Default: 10
```

#### Customize Icon

```tsx
// In components/ui/ShortsIcon.tsx
const pillWidth = size * 0.42;  // Adjust width
const pillHeight = size * 0.75; // Adjust height
const rotationDeg = 18;         // Adjust rotation
```

#### Add Analytics Platform

```tsx
// In app/(tabs)/_layout.tsx
import analytics from '@your-analytics-lib';

listeners={{
  tabPress: async () => {
    await analytics.logEvent('shorts_tab_open', {
      source: 'tab',
      timestamp: new Date().toISOString(),
    });
  },
}}
```

### Testing

```bash
# Run tests
npm test -- Shorts.test.tsx

# Run with coverage
npm test -- Shorts.test.tsx --coverage

# Watch mode
npm test -- Shorts.test.tsx --watch
```

### Debugging

Enable debug logging:

```tsx
// In app/(tabs)/shorts.tsx
const DEBUG = __DEV__;

if (DEBUG) {
  Logger.debug("[Shorts]", { shorts, currentIndex, isLoading });
}
```

Check logs:
```
[Tabs] Mounted with theme background
[Shorts] Loading shorts...
[Shorts] Loaded 10 shorts
[Analytics] shorts_tab_open
[ShortVideo] Playing: video-id-123
```

### Performance Tips

1. **Limit videos in memory**
   - Default: 3 videos (windowSize: 3)
   - Adjust in FlatList config if needed

2. **Enable clipped subview removal (Android)**
   ```tsx
   removeClippedSubviews={Platform.OS === "android"}
   ```

3. **Lazy load heavy components**
   ```tsx
   const ShortVideoPlayer = lazy(() => import("..."));
   ```

4. **Monitor memory**
   - Use React DevTools Profiler
   - Check for memory leaks in video cleanup

### Common Issues

#### Videos not playing?
- Check video URL validity
- Verify expo-video installation: `npx expo install expo-video`
- Check network connectivity

#### Icon not showing?
- Ensure react-native-svg installed: `npx expo install react-native-svg`
- Clear Metro cache: `npx expo start -c`

#### Performance issues?
- Reduce windowSize in FlatList
- Enable removeClippedSubviews
- Check video file sizes

---

## Architecture Overview

```
User taps Shorts tab
         ↓
Analytics logged (shorts_tab_open)
         ↓
Navigate to /shorts
         ↓
ShortsScreen mounts
         ↓
Load videos from service
         ↓
Render FlatList with ShortVideoPlayer
         ↓
Auto-play focused video
         ↓
User swipes up/down
         ↓
Update currentIndex, auto-play new video
```

## Key Components

### ShortsIcon
- Custom SVG icon matching YouTube Shorts
- Active/inactive states
- Theme-aware colors

### ShortsScreen
- Main feed container
- Vertical FlatList with paging
- Lazy loading and pagination
- Error handling

### ShortVideoPlayer
- Individual video player
- Auto-play on focus
- Interactive controls
- Info overlay

## Dependencies

Uses existing dependencies:
- `expo-video` - Video playback
- `react-native-svg` - Icon rendering
- `@expo/vector-icons` - UI icons
- `expo-router` - Navigation

No new dependencies required!

## Next Steps

1. ✅ Feature is complete and ready to use
2. 🔜 Add video recommendations
3. 🔜 Implement comments
4. 🔜 Add share functionality
5. 🔜 Personalization algorithm

---

## Resources

- 📖 **Full Documentation**: [SHORTS_FEATURE_DOCUMENTATION.md](./SHORTS_FEATURE_DOCUMENTATION.md)
- 📝 **PR Description**: [SHORTS_PR_DESCRIPTION.md](./SHORTS_PR_DESCRIPTION.md)
- 🧪 **Tests**: [__tests__/Shorts.test.tsx](./__tests__/Shorts.test.tsx)

## Support

Questions? Issues? Check the troubleshooting section in the full documentation or file a GitHub issue.

---

**Happy Shorts Coding! 🎬**

