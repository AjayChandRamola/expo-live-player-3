# Voice Search Setup Guide 🎤

**Issue**: Voice search returns mock data instead of actual speech  
**Solution**: Use Web version OR install native voice recognition package  
**Date**: November 14, 2025

---

## 🎯 Current Status

### ✅ **Web Browser** (Fully Working)
Voice search works **perfectly on web** using the native Speech Recognition API:
- ✅ Real speech-to-text
- ✅ Multiple languages supported
- ✅ Instant transcription
- ✅ No additional setup needed

### ⚠️ **iOS/Android Native** (Requires Additional Package)
Voice search on native platforms requires installing a speech recognition package:
- Current: Shows helpful error message
- Solution: Install `expo-speech-recognition` or `react-native-voice`

---

## 🌐 How to Use Voice Search NOW (Web)

### **Test on Web Browser**

```bash
# 1. Start the app for web
npx expo start --web

# Or press 'w' when Expo starts

# 2. Open in Chrome/Edge/Safari
# (Speech Recognition works in modern browsers)

# 3. Use voice search:
#    - Tap Shorts tab
#    - Tap search icon (🔍)
#    - Tap mic button (🎤)
#    - Grant microphone permission when prompted
#    - Speak your query: "om", "yoga", "meditation"
#    - See YOUR actual words appear in search!
#    - Results filter automatically

# ✅ Works perfectly on web!
```

---

## 📱 How to Enable Voice Search on Native (iOS/Android)

### **Option 1: Install expo-speech-recognition (Recommended)**

**Coming in future Expo SDK** - Not yet available

Wait for official Expo package or use Option 2.

### **Option 2: Install react-native-voice (Production-Ready)**

```bash
# 1. Install the package
npm install @react-native-voice/voice

# 2. Update hooks/useVoiceSearch.ts
```

#### Updated Implementation for Native:

```typescript
// hooks/useVoiceSearch.ts
import Voice from '@react-native-voice/voice';

// In startListening function:
} else {
  // Native: Use react-native-voice
  
  // Set up event listeners
  Voice.onSpeechResults = (e) => {
    const transcript = e.value[0];
    setTranscript(transcript);
    onResult?.(transcript);
    Logger.info(`[VoiceSearch] Transcript: "${transcript}"`);
  };

  Voice.onSpeechError = (e) => {
    Logger.error("[VoiceSearch] Error:", e.error);
    setError(e.error.message);
    onError?.(new Error(e.error.message));
  };

  Voice.onSpeechEnd = () => {
    setIsListening(false);
    Logger.info("[VoiceSearch] Recognition ended");
  };

  // Start recognition
  await Voice.start(language);
}
```

### **Option 3: Keep Mock for Development**

If you want to test the UI without actual voice recognition:

```typescript
// In hooks/useVoiceSearch.ts, line 142-151
// Replace the error message with actual mock behavior:

} else {
  // Native: Mock for development
  Logger.info("[VoiceSearch] Using mock voice input (for testing)");
  
  // Simulate listening
  timeoutRef.current = setTimeout(() => {
    // For testing: Use a random search term
    const mockQueries = ["om", "yoga", "meditation", "breathing", "mantra"];
    const mockTranscript = mockQueries[Math.floor(Math.random() * mockQueries.length)];
    
    setTranscript(mockTranscript);
    onResult?.(mockTranscript);
    setIsListening(false);
    
    Logger.info(`[VoiceSearch] Mock transcript: "${mockTranscript}" (random for testing)`);
  }, 2000);
}
```

---

## 🔧 Quick Fix for Your Use Case

Since you want to test voice search **right now**, here are your options:

### **Option A: Use Web (Recommended for Testing)**

```bash
npx expo start --web
# Voice search works perfectly with real speech recognition!
```

### **Option B: Install Real Voice Package (Production)**

```bash
npm install @react-native-voice/voice
```

Then update `hooks/useVoiceSearch.ts` with the code above.

### **Option C: Disable Voice Search (Simplest)**

If you don't need voice search:

```typescript
// In components/Shorts/ShortsSearchBar.tsx
// Hide the mic button:

{/* Mic Button - Hide if not on web */}
{Platform.OS === 'web' && (
  <Pressable style={styles.micButton} onPress={handleMicPress}>
    <MaterialCommunityIcons name="microphone" size={24} color="#FFFFFF" />
  </Pressable>
)}
```

---

## 🌐 Web Speech API (Works NOW)

### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| **Chrome** | ✅ Full | Best support |
| **Edge** | ✅ Full | Chromium-based |
| **Safari** | ✅ Full | iOS 14.5+ |
| **Firefox** | ⚠️ Limited | Behind flag |

### How It Works

```typescript
// On web, uses native browser API
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Your actual spoken words appear here!
  onResult(transcript);
};

recognition.start();
// User speaks: "om"
// Result: "om" ✅ (exactly what you said!)
```

---

## 📝 Current Behavior

### **On Web** ✅
```
User taps mic
   ↓
Browser requests mic permission
   ↓
User grants permission
   ↓
Mic activates (red icon)
   ↓
User speaks: "om"
   ↓
Speech recognized: "om"
   ↓
Search input shows: "om" ✅
   ↓
Search executes for "om" ✅
```

### **On Native (iOS/Android)** ⚠️
```
User taps mic
   ↓
Shows error message:
"Voice search requires additional setup on mobile.
Please type your search or use web version."
   ↓
User can type search instead
```

---

## 🚀 Production Voice Search Setup

### For Production Apps

**Install Package**:
```bash
npm install @react-native-voice/voice
```

**Update iOS (if needed)**:
```bash
cd ios && pod install && cd ..
```

**Add Permissions**:

**iOS** (`ios/[YourApp]/Info.plist`):
```xml
<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for voice search</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>We need speech recognition for voice search</string>
```

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

**Update Hook** (`hooks/useVoiceSearch.ts`):
```typescript
import Voice from '@react-native-voice/voice';

// Replace native section with actual Voice implementation
// See Option 2 above for code
```

---

## 🧪 Testing Voice Search

### Test on Web (Works Now!)

```bash
# 1. Start web version
npx expo start --web

# 2. Open in Chrome/Edge
http://localhost:8081

# 3. Navigate to Shorts
# 4. Tap search icon (🔍)
# 5. Tap mic (🎤)
# 6. Grant permission when browser asks
# 7. Speak: "om"
# 8. See "om" in search box ✅
# 9. See filtered results ✅
```

### Test on Native (After Installing Package)

```bash
# 1. Install react-native-voice
npm install @react-native-voice/voice

# 2. Rebuild app
npx expo prebuild
npx expo run:ios  # or run:android

# 3. Test voice search
# Same as web, but on device
```

---

## 💡 Recommendation

### **For Now (Testing)**
**Use Web version** - Voice search works perfectly:
```bash
npx expo start --web
```

### **For Production (Real Apps)**
**Install react-native-voice**:
```bash
npm install @react-native-voice/voice
# Then update hooks/useVoiceSearch.ts
```

---

## ✅ Fixed Issues

1. ✅ **Removed mock "meditation music"**
   - Now shows helpful error on native
   - Works perfectly on web with real speech

2. ✅ **Removed deprecated `allowsFullscreen` prop**
   - No more warnings
   - VideoView uses default fullscreen behavior

---

## 🎯 Summary

### Current State

| Platform | Voice Search Status | Solution |
|----------|-------------------|----------|
| **Web** | ✅ Fully Working | Use now! |
| **iOS** | ⚠️ Needs Package | Install react-native-voice |
| **Android** | ⚠️ Needs Package | Install react-native-voice |

### For Immediate Testing

```bash
# Use web version - voice search works perfectly!
npx expo start --web

# Speak your actual words, they'll appear correctly! ✅
```

### For Production

```bash
# Install voice package
npm install @react-native-voice/voice

# Update hook with real implementation
# (See code example above)
```

---

**Fixed**: November 14, 2025  
**Web**: ✅ Voice search works perfectly  
**Native**: ⚠️ Requires additional package  
**Recommendation**: Test on web, install package for production  

**Try it on web now - it works! 🎤**

