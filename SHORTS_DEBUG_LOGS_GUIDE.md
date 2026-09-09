# Shorts Debug Logs Guide 🔍

**Purpose**: Comprehensive logging to diagnose swipe issues  
**Added**: November 14, 2025

---

## 📋 What Logs Were Added

I've added detailed console logs at every critical step:

### 1. **Shorts Loading**
```
📋 [SHORTS LOADED] Total: X videos
   0: "Video Title" (id: short1)
   1: "Video Title" (id: short2)
   ... and X more
   Current index: 0
```

### 2. **Scroll Begin**
```
👆 [SCROLL BEGIN] User started scrolling from index 0
```

### 3. **During Scroll** (every 16ms)
```
[SCROLL] offsetY: 150, SCREEN_HEIGHT: 844, calculated index: 0, current: 0
[SCROLL] ⏸️ Index unchanged (still 0)

[SCROLL] offsetY: 650, SCREEN_HEIGHT: 844, calculated index: 1, current: 0
[SCROLL] ✅ Index will change from 0 to 1
```

### 4. **Index Change**
```
🎬 [INDEX CHANGE] 0 → 1
   Video ID: short2
   Title: Video Title Here
   Direction: ⬆️ UP
   Will re-render with new isActive
```

### 5. **Component Re-render**
```
[RENDER] Index 0: "Video Title..." - isActive: false
[RENDER] Index 1: "Video Title..." - isActive: true
[RENDER] Index 2: "Video Title..." - isActive: false
```

### 6. **Video Player Changes**
```
[PLAYER short1] isActive changed to: false, hasAutoPlayed: true, isPlaying: true
[PLAYER short1] ⏸️ Video scrolled away, pausing...

[PLAYER short2] isActive changed to: true, hasAutoPlayed: false, isPlaying: false
[PLAYER short2] 🎬 AUTO-PLAYING (first time visible)
```

### 7. **Scroll End**
```
🛑 [MOMENTUM END] offsetY: 844, finalIndex: 1
```

---

## 🎯 How to Read the Logs

### Step-by-Step: What to Look For

#### When You Swipe UP (should go to next video)

**Expected Log Sequence**:

```
1. User starts swiping:
   👆 [SCROLL BEGIN] User started scrolling from index 0

2. Scroll offset increases:
   [SCROLL] offsetY: 100, SCREEN_HEIGHT: 844, calculated index: 0, current: 0
   [SCROLL] offsetY: 300, SCREEN_HEIGHT: 844, calculated index: 0, current: 0
   [SCROLL] offsetY: 500, SCREEN_HEIGHT: 844, calculated index: 1, current: 0
   [SCROLL] ✅ Index will change from 0 to 1

3. Index changes:
   🎬 [INDEX CHANGE] 0 → 1
   Direction: ⬆️ UP

4. Re-render with new isActive:
   [RENDER] Index 0: "..." - isActive: false
   [RENDER] Index 1: "..." - isActive: true

5. Players respond:
   [PLAYER short1] ⏸️ Video scrolled away, pausing...
   [PLAYER short2] 🎬 AUTO-PLAYING (first time visible)

6. Scroll stops:
   🛑 [MOMENTUM END] offsetY: 844, finalIndex: 1
```

✅ **Result**: Video 0 pauses, Video 1 plays

---

## 🐛 Diagnostic Scenarios

### Scenario 1: Same Video Replays

**Symptoms**: After swipe, same video keeps playing

**What to Check in Logs**:

```
❌ BAD:
[SCROLL] offsetY: 600, calculated index: 1, current: 0
[SCROLL] ⏸️ Index unchanged (still 0)  ← WRONG! Should be 1!
```

**Problem**: Index calculation is wrong

**Solution**: Check SCREEN_HEIGHT value

---

### Scenario 2: Index Changes But Video Doesn't Switch

**Symptoms**: Logs show index change, but same video plays

**What to Check**:

```
✅ GOOD:
🎬 [INDEX CHANGE] 0 → 1
Direction: ⬆️ UP

❌ BUT THEN:
[RENDER] Index 0: "..." - isActive: true  ← Should be FALSE!
[RENDER] Index 1: "..." - isActive: false ← Should be TRUE!
```

**Problem**: `isActive` prop not updating correctly

**Solution**: Check currentIndex state in renderShort

---

### Scenario 3: Player Doesn't Respond to isActive

**Symptoms**: Index and isActive correct, but video doesn't play/pause

**What to Check**:

```
✅ GOOD:
[RENDER] Index 1: "..." - isActive: true

❌ BUT:
[PLAYER short2] isActive changed to: true
[PLAYER short2] Already auto-played, currently paused
← Should say "AUTO-PLAYING"!
```

**Problem**: hasAutoPlayedRef not resetting

**Solution**: Check player's useEffect dependencies

---

### Scenario 4: Scroll Events Not Firing

**Symptoms**: No scroll logs appear

**What to Check**:

```
Expected:
[SCROLL] offsetY: ..., calculated index: ...

If missing:
- Check onScroll prop on FlatList
- Check scrollEventThrottle={16}
- Check if gesture handler blocking
```

---

## 🔬 Debug Commands

### 1. Check Screen Height
```javascript
// Add temporary log in component
console.log('SCREEN_HEIGHT:', SCREEN_HEIGHT);
```

**Expected**: ~844 (iPhone), ~915 (larger phones)

### 2. Check Shorts Array
```javascript
console.log('Shorts count:', shorts.length);
console.log('First 3:', shorts.slice(0, 3).map(s => s.id));
```

### 3. Check Current Index
```javascript
console.log('State index:', currentIndex);
console.log('Ref index:', currentIndexRef.current);
```

**Both should match!**

---

## 📊 Log Patterns to Recognize

### ✅ HEALTHY Pattern (Swipe Up)

```
[SCROLL BEGIN] from index 0
[SCROLL] offsetY: 422 → index: 1
[INDEX CHANGE] 0 → 1, Direction: UP
[RENDER] 0: isActive=false
[RENDER] 1: isActive=true
[PLAYER short1] pausing...
[PLAYER short2] AUTO-PLAYING
[MOMENTUM END] finalIndex: 1
```

### ❌ UNHEALTHY Pattern 1: Index Not Changing

```
[SCROLL BEGIN] from index 0
[SCROLL] offsetY: 422 → index: 0  ← WRONG! Should be 1
[SCROLL] Index unchanged (still 0)
(No INDEX CHANGE)
(No new video)
```

**Problem**: Calculation error

### ❌ UNHEALTHY Pattern 2: Index Changes But Render Wrong

```
[INDEX CHANGE] 0 → 1
[RENDER] 0: isActive=true  ← WRONG!
[RENDER] 1: isActive=false ← WRONG!
```

**Problem**: State not propagating to render

### ❌ UNHEALTHY Pattern 3: Player Ignores isActive

```
[RENDER] 1: isActive=true
[PLAYER short2] isActive=true
[PLAYER short2] Already auto-played ← Shouldn't say this!
```

**Problem**: Player ref not resetting

---

## 🎯 Quick Diagnosis Chart

| Symptom | Log Pattern | Issue | Fix |
|---------|-------------|-------|-----|
| No scroll logs | Missing `[SCROLL]` | Scroll handler not firing | Check FlatList props |
| Wrong index | `index: 0` when should be 1 | Math.round calculation | Check offsetY/SCREEN_HEIGHT |
| Index doesn't change | Always `unchanged (still X)` | Ref not updating | Check updateCurrentIndex |
| Wrong isActive | `isActive=true` on wrong index | State not syncing | Check currentIndex in render |
| Player doesn't play | No `AUTO-PLAYING` log | Player effect issue | Check useEffect deps |

---

## 🧪 Test Procedure with Logs

### Test 1: Single Swipe Up

1. **Start at video 0**
2. **Swipe UP slowly**
3. **Watch console**

**Expected Logs**:
```
👆 [SCROLL BEGIN] from index 0
[SCROLL] offsetY: 0-843 (increasing)
🎬 [INDEX CHANGE] 0 → 1, Direction: ⬆️ UP
[PLAYER short1] pausing
[PLAYER short2] AUTO-PLAYING
🛑 [MOMENTUM END] finalIndex: 1
```

### Test 2: Multiple Swipes

1. **Start at video 0**
2. **Swipe UP twice**
3. **Watch console**

**Expected**:
```
[INDEX CHANGE] 0 → 1
[PLAYER short2] AUTO-PLAYING

[INDEX CHANGE] 1 → 2
[PLAYER short3] AUTO-PLAYING
```

### Test 3: Swipe Down

1. **Start at video 2**
2. **Swipe DOWN**
3. **Watch console**

**Expected**:
```
[INDEX CHANGE] 2 → 1, Direction: ⬇️ DOWN
[PLAYER short2] AUTO-PLAYING
```

---

## 📤 What to Share

If swipe is still not working, **copy and paste the console output** showing:

1. **Initial state**:
```
📋 [SHORTS LOADED] Total: X videos
```

2. **The swipe attempt**:
```
👆 [SCROLL BEGIN] ...
[SCROLL] ...
🎬 [INDEX CHANGE] ... (or missing!)
[RENDER] ...
[PLAYER] ...
🛑 [MOMENTUM END] ...
```

3. **Screen dimensions**:
```javascript
// Add this temporarily:
console.log('Window dimensions:', Dimensions.get('window'));
```

---

## 🔍 Common Issues & Their Signatures

### Issue: SCREEN_HEIGHT is 0
```
[SCROLL] offsetY: 500, SCREEN_HEIGHT: 0, calculated index: Infinity
```
**Fix**: Ensure Dimensions.get('window') called after mount

### Issue: offsetY always 0
```
[SCROLL] offsetY: 0, calculated index: 0
[SCROLL] offsetY: 0, calculated index: 0
```
**Fix**: Scroll events not firing - check gesture handler

### Issue: Multiple videos isActive=true
```
[RENDER] Index 0: isActive: true
[RENDER] Index 1: isActive: true  ← BAD! Only one should be true
```
**Fix**: currentIndex not updating properly

### Issue: No player logs
```
[INDEX CHANGE] 0 → 1
(No PLAYER logs)
```
**Fix**: Player components not mounted or useEffect not firing

---

## 🚀 Next Steps

1. **Run the app**: `npx expo start`
2. **Open console**: Check terminal or browser DevTools
3. **Tap Shorts tab**
4. **Look for**: `📋 [SHORTS LOADED]`
5. **Swipe UP**
6. **Watch logs**: Follow the patterns above
7. **Copy logs**: If still broken, share the output

The logs will tell us **exactly** where the tracking is breaking!

---

**Added Logging**: November 14, 2025  
**Debug Level**: Comprehensive  
**Next**: Share console output from a swipe attempt

