# Autoplay Toggle - Visual Design Guide

## 🎨 Component Preview

```
┌─────────────────────────────────────────────────────────┐
│                    VIDEO PLAYER                         │
│                                                          │
│                     [Video Area]                        │
│                                                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │  Controls Bar (YouTube 2025 Dark Mode)             │ │
│ │                                                     │ │
│ │  Left Side            │           Right Side       │ │
│ │  ▶ 🔊 ⊡ CC            │           ⟳ [✓] ⛶ ⋮      │ │
│ │                       │               ↑             │ │
│ │                       │          Autoplay Toggle    │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 📐 Detailed Layout

### Control Bar Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP ROW (Horizontal Layout)                                     │
├──────────────────────┬──────────────────────────────────────────┤
│ Left Controls        │ Right Controls                           │
│                      │                                          │
│ • Play/Pause         │ • Loop Button                           │
│ • Volume/Mute        │ • Autoplay Toggle  ← YOU ARE HERE       │
│ • Display Mode       │ • Fullscreen                            │
│ • Captions (CC)      │ • Menu (⋮)                              │
└──────────────────────┴──────────────────────────────────────────┘
```

### Autoplay Toggle Position

```
Right Control Section:
┌─────────┬─────────┬─────────┬─────────┐
│  Loop   │ Autoplay│ Full    │  Menu   │
│   ⟳     │   [✓]   │  ⛶      │   ⋮     │
└─────────┴─────────┴─────────┴─────────┘
           ↑
      12px spacing from neighbors
```

## 🎨 Button States - Visual Comparison

### State 1: Autoplay ON (Active)

```
     Pulse Ring (animated)
    ┌─────────────┐
   ╱               ╲
  │  ┌─────────┐   │  ← Blue glow (#3EA6FF)
  │  │    ▶    │   │     Animated pulse (1s loop)
  │  └─────────┘   │  ← White icon (#FFFFFF)
   ╲               ╱
    └─────────────┘
     #0F0F0F bg
```

**Visual Characteristics:**
- Circle diameter: 28-32px
- Background: #0F0F0F (YouTube dark)
- Icon: White play arrow (▶️)
- Glow: Blue ring (#3EA6FF)
- Animation: Continuous pulse
- Shadow: Soft Material shadow

### State 2: Autoplay OFF (Inactive)

```
    No pulse ring
    ┌─────────┐
    │    ⏸    │  ← Gray icon (#7A7A7A)
    └─────────┘     No glow
     #0F0F0F bg
```

**Visual Characteristics:**
- Same size as ON state
- Background: #0F0F0F
- Icon: Gray pause (⏸️)
- Glow: None
- Animation: None (static)
- Shadow: Same as ON state

### State 3: Disabled (No Next Video)

```
    ┌─────────┐
    │    ⏸    │  ← Dimmed (50% opacity)
    └─────────┘     Cannot interact
     #0F0F0F bg
       (faded)
```

**Visual Characteristics:**
- Entire button at 50% opacity
- Cursor: not-allowed
- No hover effects
- No animations

## 🎭 Animation Timeline

### Auto-Hide Animation (Synced with Controls)

```
User Activity:
Tap Screen ──> Show Controls (opacity: 0 → 1, 220ms)
               │
               ├─ 3.5s idle ──> Auto-hide (opacity: 1 → 0, 220ms)
               │
               └─ User taps again ──> Show (repeat)

All buttons fade together: Play, Previous, Next, Minimize, Autoplay!
```

### Pulse Animation (ON State Only)

```
Time:  0ms        500ms       1000ms      (repeat)
       │           │           │
Scale: 1.0 ─────> 1.15 ─────> 1.0 ─────> ...
       │           │           │
Opacity: 0.3 ───> 0.6 ─────> 0.3 ─────> ...
```

### Press Animation (All States)

```
Time:  0ms   100ms  250ms  400ms
       │      │      │      │
       ▼      ▼      ▼      ▼
Scale: 1.0 -> 0.98 -> 1.02 -> 1.0
       │      │      │      │
       Rest   Down   Bounce Back
```

### State Transition Animation

```
OFF → ON (250-300ms)
┌─────────┐              ┌─────────┐
│    ⏸    │  ─────────>  │    ▶    │
│  #7A7A7A│   fade/glow  │ #FFFFFF │
└─────────┘              └─────────┘
                          + Blue glow
                          + Pulse starts

Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

## 📏 Sizing Guide

### Size Variations

```
Small (20px)    Medium (24px)   Default (28px)  Large (32px)
┌────┐          ┌─────┐          ┌──────┐         ┌───────┐
│ ▶  │          │  ▶  │          │   ▶  │         │   ▶   │
└────┘          └─────┘          └──────┘         └───────┘
  20px            24px             28px             32px

Usage:          Usage:           Usage:           Usage:
Mobile          Compact UI       Standard         Emphasis
Compact         List items       Control bar      Hero
```

### Spacing Measurements

```
┌─────────┐  ←─ 12px ─→  ┌─────────┐  ←─ 12px ─→  ┌─────────┐
│  Loop   │              │ Autoplay│              │ Full    │
│   ⟳     │              │   [✓]   │              │  ⛶      │
└─────────┘              └─────────┘              └─────────┘
    ↑                         ↑                        ↑
    │                    Padding: 8-10px               │
    └──────────── Alignment: Center ────────────────┘
```

## 🎨 Color Palette

### Light vs Dark Mode

**Dark Mode (Default - YouTube 2025)**
```
Background:    #0F0F0F  ■
Icon (ON):     #FFFFFF  □
Icon (OFF):    #7A7A7A  ▒
Active Glow:   #3EA6FF  ▓
Disabled:      50% opacity
```

**Light Mode (Optional)**
```
Background:    #F8F9FA  □
Icon (ON):     #0F0F0F  ■
Icon (OFF):    #5F6368  ▒
Active Glow:   #1A73E8  ▓
Disabled:      50% opacity
```

## 🎬 Hover Effects

### Desktop/Web Hover States

**OFF State Hover:**
```
Before Hover:           On Hover:
┌─────────┐            ┌─────────┐
│    ⏸    │    ───>    │    ⏸    │
│  #7A7A7A│            │ #7A7A7A │
└─────────┘            └─────────┘
No glow                + Faint white glow (10%)
                       + Cursor: pointer
```

**ON State Hover:**
```
Before Hover:           On Hover:
┌─────────┐            ┌─────────┐
│    ▶    │    ───>    │    ▶    │
│ #FFFFFF │            │ #FFFFFF │
└─────────┘            └─────────┘
+ Blue glow            + Stronger blue glow (40%)
+ Pulse                + Scale: 1.02
```

## 🌐 Platform Differences

### iOS
```
┌─────────┐
│    ▶    │  • Native shadow (shadowOffset, shadowOpacity)
└─────────┘  • CoreHaptics feedback (optional)
  Smooth      • 60 FPS animations
```

### Android
```
┌─────────┐
│    ▶    │  • Elevation-based shadow
└─────────┘  • Material ripple effect
  Material    • 60 FPS animations
```

### Web
```
┌─────────┐
│    ▶    │  • CSS box-shadow
└─────────┘  • Hover tooltip
  + Tooltip   • Mouse cursor: pointer
              • Smooth transitions
```

## 📱 Responsive Behavior

### Full Player Mode
```
┌──────────────────────────────────────┐
│           FULL VIDEO PLAYER          │
│                                      │
│  Controls: All buttons visible       │
│  Autoplay: 28-32px size             │
└──────────────────────────────────────┘
```

### Mini Player Mode
```
┌────────────────┐
│   MINI PLAYER  │  • Controls simplified
│                │  • Autoplay: 24px size
│  [⟳] [✓] [⋮]  │  • Essential buttons only
└────────────────┘
```

## ✅ Accessibility Visual Indicators

### Focus State (Keyboard Navigation)
```
┌─────────┐
│  ┌───┐  │
│  │ ▶ │  │  ← Focus ring (2px, #3EA6FF)
│  └───┘  │     Visible on Tab
└─────────┘
```

### Screen Reader Announcement
```
Autoplay Toggle Button
├─ State: ON/OFF
├─ Role: Button
└─ Action: "Autoplay is [on/off]. Double-tap to toggle."
```

## 🎯 Design Decision Rationale

### Why This Placement?
```
Before Fullscreen:
✓ Logical grouping with playback controls
✓ Easy thumb reach on mobile
✓ Consistent with YouTube

After Loop:
✓ Related functionality (both affect playback flow)
✓ Maintains right-to-left importance hierarchy
```

### Why These Colors?
```
#3EA6FF (YouTube Blue):
✓ Brand consistency
✓ High visibility
✓ Conveys "active" state

#7A7A7A (Gray):
✓ Clearly indicates "off"
✓ Doesn't compete with active elements
✓ Maintains UI hierarchy
```

### Why Pulse Animation?
```
✓ Draws attention to active state
✓ Indicates ongoing automated behavior
✓ YouTube-standard interaction pattern
✓ Subtle enough not to distract
```

## 📐 Measurement Reference

### Exact Specifications

```
Component Dimensions:
├─ Outer diameter: 36px (28px + 8px padding)
├─ Inner diameter: 28px (button)
├─ Icon size: 16.8px (28px × 0.6)
└─ Touch target: 48px × 48px (accessibility)

Spacing:
├─ Margin left: 12px
├─ Margin right: 12px
├─ Vertical centering: align-items: center
└─ Padding: 8-10px

Animations:
├─ Pulse duration: 1000ms
├─ Press duration: 400ms
├─ Hover duration: 200ms
└─ State change: 250-300ms

Shadows:
├─ iOS: shadowOpacity: 0.3, shadowRadius: 4px
├─ Android: elevation: 4
└─ Web: box-shadow: 0 2px 4px rgba(0,0,0,0.3)
```

## 🎨 Pixel-Perfect Implementation

### CSS/Style Equivalent

```css
.autoplay-toggle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #0F0F0F;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.autoplay-toggle.active {
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 0 0 2px rgba(62, 166, 255, 0.4);
}

.autoplay-toggle:hover {
  transform: scale(1.02);
}

.autoplay-toggle:active {
  transform: scale(0.98);
}
```

## 🎓 Usage Examples

### Example 1: Basic Integration with Auto-Hide
```tsx
<AutoplayToggle
  opacity={controller.opacity}  // Auto-hide support
  autoplayEnabled={true}
  onToggle={() => console.log('Toggled!')}
  size={28}
/>
```

### Example 2: With Disabled State
```tsx
<AutoplayToggle
  autoplayEnabled={false}
  onToggle={handleToggle}
  size={28}
  disabled={!hasNextVideo}
/>
```

### Example 3: Custom Size
```tsx
<AutoplayToggle
  autoplayEnabled={autoplay}
  onToggle={toggleAutoplay}
  size={32}  // Larger for emphasis
/>
```

## 🔍 Quality Checklist

Use this checklist to verify your implementation:

- [ ] Button is circular (border-radius: 50%)
- [ ] Size matches specification (28-32px)
- [ ] ON state shows play icon (▶️)
- [ ] OFF state shows pause icon (⏸️)
- [ ] Blue glow appears when ON
- [ ] Pulse animation plays when ON
- [ ] Press animation provides feedback
- [ ] Hover effects work on web
- [ ] Tooltip appears on hover (web)
- [ ] Spacing is correct (12px from neighbors)
- [ ] Accessible with screen readers
- [ ] Shadow is properly rendered
- [ ] State transitions are smooth

---

## 📚 References

- **Design Inspiration**: YouTube 2025 Dark Mode
- **Design System**: Material 3
- **Animation Easing**: cubic-bezier(0.4, 0, 0.2, 1)
- **Icon Library**: react-native-paper
- **Accessibility**: WCAG 2.1 AA compliant

---

**Last Updated**: 2024  
**Component Version**: 1.0.0  
**Status**: ✅ Production Ready

