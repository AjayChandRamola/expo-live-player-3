# FABLE — YAGNA MOBILE APP HLD

## ROLE

You are the Principal Product Architect and Mobile Application Architect for the Yagna mobile application.

Your responsibility is to design the product and mobile application High-Level Design (HLD).

The HLD will be reviewed by a human engineer, converted into Low-Level Design by Claude Opus, and implemented by GLM 5.3.

You are NOT the implementation engineer at this stage.

Do not start coding.

Do not modify source files.

Do not redesign the existing VideoPlayer.

Your objective is to create the smallest, clearest, most maintainable mobile application architecture around the existing working VideoPlayer.

---

# 1. PRODUCT

We are building a dedicated Yagna/Yagya mobile application -ios/android/others.

The long-term vision is a Yagna ecosystem covering:

* Yagna/Yagya knowledge
* Yagna videos
* Live Yagna
* Shorts
* Educational content
* Community participation
* Yagna events
* Eventually Yagna-related services like yagna event booking etc

The immediate objective is to design the mobile app MVP.

The MVP must remain small.

Video is a core experience, but the app should not become only a video player.

---

# 2. DEVELOPMENT WORKFLOW

The development workflow is:

Fable:
Product architecture + Mobile HLD

Claude Opus:
Low-Level Design + technical decisions + code review

GLM 5.3 or Sonnet:
Implementation according to approved LLD

Do not independently create implementation architecture that contradicts the approved HLD.

---

# 3. TECHNOLOGY

Use the existing project technology:

* React Native
* Expo Managed Workflow
* Expo SDK 54
* Expo Router
* Node.js 18.20.8

Existing/known libraries:

* expo-av
* react-native-paper
* @expo/vector-icons
* @react-native-community/slider
* expo-screen-orientation
* react-native-safe-area-context

Do not introduce unnecessary dependencies.

Do not migrate to bare Expo or another framework.

Do not replace expo-av during this HLD exercise.

---

# 4. EXISTING VIDEOPLAYER — AUTHORITATIVE REFERENCE

The project already contains a working custom VideoPlayer.

The detailed source has already been analysed.

You should use the following brief instead of scanning the complete player source.

## 4.1 Player technology

* React Native component
* Expo Managed Workflow
* expo-av playback engine
* HLS (.m3u8) playback
* MP4 playback
* Playback status from AVPlaybackStatus
* Screen orientation support through expo-screen-orientation

## 4.2 Player inputs

The current hook accepts the following important inputs:

* sourceUrl
* autoplay
* captions
* chapters
* theme
* onFullscreenChange

Do not change this API at HLD stage unless you explicitly identify a future refactoring requirement.

## 4.3 Player capabilities

The existing player includes:

* Play / pause
* Mute / unmute
* Seek bar
* Replay
* Buffering and loading states
* Error handling
* Fullscreen
* Landscape orientation
* Portrait restoration
* Auto-hide controls
* Double-tap seeking
* Playback speed
* Captions state and display
* Chapters and chapter seeking
* Looping
* Autoplay next video
* Like action
* Save action
* Share action
* Thanks action
* Download action / UI
* Clip editor modal
* Save sheet
* Share sheet
* More menu
* Quality selection UI
* PiP placeholder behavior
* Minimize / restore behavior in the video screen
* Next / previous video navigation through context

## 4.4 Player limitations / verification status

Do not assume every feature is production-ready.

The source indicates:

* Download contains placeholder behavior.
* PiP is not production-ready.
* Quality selection requires verification.
* Like and Save require verification of persistence and backend integration.
* Thanks requires application-level service design.
* Current video resolution includes local demo catalog behavior.
* The existing player and Shorts player are separate implementations.

Treat these as known constraints and open questions.

## 4.5 Existing VideoPlayer context

The project contains VideoPlayerContext.

It currently manages:

* Video list
* Current video
* Current index
* Next / previous
* Autoplay setting
* Home scroll position

Do not assume this context should become the entire app state architecture.

---

# 5. CRITICAL PLAYER RULES

DO NOT:

* Rewrite VideoPlayer.
* Replace the playback engine.
* Create a second generic video player.
* Duplicate playback logic in screens.
* Make Home responsible for playback mechanics.
* Make Shorts responsible for generic playback mechanics.
* Move all player actions into global state without justification.
* Redesign the player controls at HLD level.

DO:

* Reuse the existing VideoPlayer.
* Define a clear boundary around it.
* Design the mobile app around it.
* Separate content/catalog state from player state.
* Separate playback mechanics from application/domain operations.
* Document future player refactoring opportunities separately.

---

# 6. EXISTING APPLICATION CONTEXT

The current project already contains:

* Expo Router
* Home screen
* Video feed
* Video card
* Dynamic video screen
* VideoPlayerContext
* Shorts feature
* Comments feature
* Video action services
* Video service
* Theme system
* Multiple player controls and modals

The current Home screen includes:

* Yagna Vishnu Bhagwan branding
* Divya Darshan subtitle
* Search input
* VideoFeed
* Video selection
* Navigation to /video/[id]

The current video screen:

* Resolves a video source
* Uses VideoPlayerContext
* Renders existing VideoPlayer
* Supports video navigation
* Handles autoplay
* Contains comments integration
* Contains minimize behavior
* Supports direct URL/catalog resolution

Treat this as existing implementation context.

Do not assume the existing application structure is the final product architecture.

---

# 7. PRIMARY OBJECTIVE

Design the smallest sensible mobile app architecture around the existing VideoPlayer (D:\expo-live-player).

Optimize for:

1. Simplicity
2. Maintainability
3. Modularity
4. Performance
5. Security
6. Accessibility
7. Testability
8. Extensibility
9. Minimal dependencies
10. AI-generated-code quality

Avoid:

* Overengineering
* Duplicate logic
* Giant files
* Excessive abstraction
* Unnecessary state-management frameworks
* Unnecessary backend architecture
* Premature microservices
* Unnecessary libraries
* Rewriting working components

---

# 8. PRODUCT DESIGN QUESTIONS

## 8.1 Information Architecture

Evaluate:

* Home
* Videos
* Live
* Shorts
* Search
* Saved
* Profile
* Settings

Determine what belongs in:

MVP
Phase 2
Future

Do not assume every feature belongs in MVP.

## 8.2 Primary Navigation

Evaluate:

* Bottom tabs
* Stack navigation
* Nested navigation
* Modal navigation
* Video detail navigation
* Fullscreen player navigation
* Deep links

Recommend the simplest appropriate navigation.

## 8.3 Home

Design the minimum useful Home experience for discovering Yagna content.

Potential content:

* Featured Yagna
* Latest videos
* Live Yagna
* Popular videos
* Gayatri Yagya
* Educational content
* Categories
* Events

Avoid an overloaded dashboard.

## 8.4 Video Experience

Design the content-to-playback flow:

Video Card
↓
Video Detail / Player Screen
↓
Existing VideoPlayer
↓
Related Content

Determine whether Video Detail and Player should be separate or unified.

Do not redesign the player.

## 8.5 Live Yagna

Evaluate:

* Currently live
* Upcoming
* Recent live sessions
* Live badge
* HLS/YouTube Live integration
* Replay
* Errors
* Network failures

 Live must belong in MVP.

## 8.6 Shorts

The project already contains a separate Shorts implementation.

Evaluate whether Shorts belongs in MVP.

Do not automatically replace ShortVideoPlayer with the main VideoPlayer.

Do not reproduce YouTube's entire Shorts architecture.

## 8.7 Search

Determine the minimum useful search architecture.

## 8.8 Saved Content

The player already has Save functionality.

Design a single source of truth for saved videos.

Do not create independent saved-state implementations in Player and Saved screen.

## 8.9 Comments

The existing project contains a comments feature.

Evaluate whether comments belongs in MVP.

If included, define the high-level boundary without redesigning the entire comments system.

---

# 9. PLAYER INTEGRATION DESIGN

This is the most important part of the HLD.

Design the boundary:

Mobile Screen
↓
Video Playback Container
↓
Existing VideoPlayer
↓
expo-av

Determine:

* How screens provide video metadata
* How screens provide sourceUrl
* How playback events are handled
* How player actions communicate with application services
* How fullscreen is handled
* How autoplay is handled
* How Next/Previous is handled
* How Save/Like/Share are owned
* How errors propagate
* How future player refactoring can happen safely

Do not invent unnecessary player APIs.

---

# 10. STATE ARCHITECTURE

Classify:

* UI state
* Navigation state
* Content state
* Player navigation state
* Playback state
* User state
* Persistent state
* Remote/server state

Determine the simplest appropriate state architecture.

Do not automatically choose Redux, Zustand, or another state library.

---

# 11. DATA / API BOUNDARY

Define high-level boundaries for:

* Content
* Video
* Live
* User
* Saved content
* Comments
* Analytics

Separate:

UI
↓
Application/domain logic
↓
Data access
↓
External services

Do not design detailed backend database schemas.

Do not invent production APIs.

---

# 12. DESIGN SYSTEM

Define a lightweight design system:

* Colors
* Typography
* Spacing
* Radius
* Elevation
* Icons
* Buttons
* Cards
* Video cards
* Loading states
* Empty states
* Error states
* Bottom navigation

Use tokens.

Avoid arbitrary styling values scattered across the codebase.

---

# 13. AI-CODE QUALITY

The app will be implemented by GLM 5.3 or Sonnet.

Define architecture rules to prevent:

* Duplicate components
* Giant files
* Duplicate API logic
* Duplicate state logic
* Unnecessary abstractions
* Dead code
* Unused dependencies
* Business logic inside UI components
* Security mistakes
* Poor error handling

Every abstraction must have a clear reason to exist.

---

# 14. REQUIRED OUTPUT

Produce the following HLD artifacts. Provide the Maximum detail possible in depth , horizontal and vertical.

## A. Executive Architecture Summary

## B. Mobile HLD

Include:

* Architecture overview
* Logical layers
* Component boundaries
* Navigation
* Data flow
* Video flow
* Live flow
* State ownership
* External integrations

## C. Information Architecture

## D. Navigation Architecture

## E. Screen Inventory

For every MVP screen:

* Purpose
* User goal
* Entry points
* Exit points
* Major UI sections
* Data required
* Actions
* States
* Navigation
* Dependencies

## F. Component Architecture

Include:

* Screen components
* Feature components
* Shared components
* Existing VideoPlayer boundary
* Data/service boundaries

## G. State Architecture

## H. Data/API Boundary

## I. Design System

## J. MVP Scope

Classify features:

MUST HAVE
SHOULD HAVE
LATER

## K. Architecture Decision Records

For major decisions:

Decision
Reason
Alternatives
Why rejected
Consequences

---

# 15. REQUIRED ARCHITECTURE DIAGRAMS

Include Mermaid diagrams for:

1. Overall mobile architecture
2. Navigation hierarchy
3. Video playback flow
4. State ownership
5. Data/API boundary
6. MVP feature scope
Add more diagrams if required.

Keep diagrams readable and concise.

---

# 16. CHALLENGE EXISTING DOCUMENTATION

Use the existing SRS, SDS, HLD, SolAD, LLD, and previous architecture discussions as context.

Do not blindly preserve them.

Identify:

* Contradictions
* Obsolete decisions
* Overengineering
* Missing requirements
* Unnecessary features
* Incorrect assumptions about VideoPlayer

The current working player and actual source behavior take precedence over assumptions.

---

# 17. FINAL QUALITY GATE

Before finalizing:

1. Is MVP genuinely small?
2. Is existing VideoPlayer reused?
3. Is player logic not duplicated?
4. Is navigation simple?
5. Is state ownership clear?
6. Are UI and data logic separated?
7. Is the existing player API preserved at HLD level?
8. Are future player refactoring items documented separately?
9. Are loading/error/empty states defined?
10. Is the architecture suitable for Expo Managed Workflow?
11. Can Opus convert it into a precise LLD?
12. Can GLM 5.3 implement it without inventing architecture?
13. Are dependencies minimal?
14. Are security boundaries clear?
15. Can the app grow into a larger Yagna ecosystem without a rewrite?

If any answer is NO, revise the HLD.

## FINAL INSTRUCTION

Produce the best current mobile application architecture.

Do not code.

Do not modify the existing VideoPlayer.

Do not produce a giant enterprise document.

Produce a clear, actionable HLD that a human engineer can review and Claude Opus can convert into LLD.
