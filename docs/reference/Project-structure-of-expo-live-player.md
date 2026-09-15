1. Project structure of expo-live-player/

components/VideoPlayer/

index.tsx — Player component

hooks/useVideoPlayer.ts — Playback hook

VideoView.tsx — Video rendering

Controls.tsx — Controls

VideoActionBar.tsx — Action bar

VideoProgressBar.tsx — Progress

modals/ — Save, Share, Download, Clip, More

types.ts, tokens.ts, styles.ts, utils.ts

contexts/VideoPlayerContext.tsx

app/video/[id].tsx

components/VideoFeed/

components/Shorts/

services/ and hooks/

2. Actual VideoPlayer capabilities
Playback engine

Capability

	

Source finding




Framework

	

React Native + Expo




Playback library

	

expo-av




Media input

	

sourceUrl




MP4

	

Supported




HLS .m3u8

	

Supported




Playback status

	

AVPlaybackStatus




Buffering state

	

Tracked




Loading state

	

Tracked




Error state

	

Tracked




Duration / position

	

Tracked




Live detection

	

Derived from missing/zero duration

Playback controls
Playback controls

Implemented in the player hook and control components.

Play / pause

Mute / unmute

Seek bar

Double-tap seek

Replay

Auto-hide controls

Fullscreen and orientation

The implementation includes:

Fullscreen toggle.

Native fullscreen handling.

Landscape orientation lock.

Portrait orientation restoration.

Fullscreen update callbacks.

Fullscreen modal behavior on mobile.

Minimize/restore state in the video screen.

Architecture implication: The application must allow the player to control fullscreen/orientation without forcing every screen to implement its own fullscreen logic.

3. Advanced features discovered

Feature

	

Status based on source




Playback speed

	

Implemented in hook




Captions

	

Caption state and active-caption calculation




Chapters

	

Chapter seeking and current chapter calculation




Looping

	

Implemented




Autoplay next video

	

Implemented through context + video screen




Like

	

Player action exists




Save

	

Save sheet and action exist




Share

	

Share action and sheet exist




Download

	

UI/action exists, but needs production verification




Clip editor

	

Modal exists




Quality selection

	

UI/action exists, needs production verification




PiP

	

Not production-ready; placeholder behavior exists




Comments

	

Separate comments system exists




Minimize

	

Implemented in video screen




Next / Previous

	

Context-based video navigation

Important distinction

The source shows a number of advanced features, but the existence of a component or handler is not proof that the end-to-end feature is production-ready.

For example:

Download action is marked as a placeholder in the hook.

PiP reports unsupported behavior.

Like and Save need verification of persistence and backend integration.

Quality selection needs verification of actual stream quality switching.

Comments have their own services and hooks, but are not necessarily production-ready backend functionality.

Fable must use these distinctions when defining the HLD.

4. Current video screen flow

The existing app/video/[id].tsx is already an application-level video screen.

The source shows this flow:

Current source-resolution behavior

The video screen can resolve a video from:

Existing VideoPlayerContext selection.

A validated direct ?url= parameter.

A local catalog by ID.

A fallback catalog entry.

This is a demo-oriented source resolution architecture, not yet a production content platform.

For the new mobile app HLD, we should keep the player interface but redesign the surrounding content/data flow so that video metadata and playback sources come from a clean data layer.

5. Current VideoPlayer API boundary

This is the most useful information for Opus later.

The current player hook accepts a VideoPlayerProps object. The source explicitly shows these inputs:

sourceUrl: string
autoplay?: boolean
captions?: CaptionItem[]
chapters?: ChapterItem[]
theme?: "system" | "light" | "dark"
onFullscreenChange?: (isFullscreen: boolean) => void

The player internally manages playback state such as:

isLoaded
isBuffering
isPlaying
isMuted
positionMillis
durationMillis
playbackRate
captionsEnabled
looping
autoplayEnabled
isFullscreen
isNativeFullscreen
controlsVisible

The implementation also exposes player actions through its hook, including:

togglePlay
toggleMute
toggleFullscreen
onSeekComplete
quickSeek
toggleLoop
toggleCaptions
toggleAutoplay
jumpToChapter
onShare
onThanks
onDownload
onTogglePip
onSelectQuality
Recommended HLD boundary
Mobile App Screen
       │
       ▼
Video Playback Container
       │
       ▼
Existing VideoPlayer
       │
       ▼
expo-av / native playback

The screen should provide the player with a resolved media source and relevant metadata. The player should own playback mechanics.

Do not let Fable redesign this interface at HLD level. It can recommend a future adapter or refactoring, but Opus should inspect the exact source before changing the API.