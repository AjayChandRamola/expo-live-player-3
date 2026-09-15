# Yagna Mobile MVP — Manual Device Verification Report

Date: 2026-09-16

**This task requires a human on a physical Android device and a physical
iOS device.** It was not run: this session has no access to physical
devices, and Task 6 of the hardening plan is explicitly marked "A human
runs this." Recording every row as not run is the honest result — reporting
any of these as passed without actually running them on hardware would
violate this plan's own rule that an unverified item reported as done is
worse than an open one.

## Matrix from LLD index section 8 (16 checks)

| # | Check | Pass criterion | Android | iOS |
|---|---|---|---|---|
| 1 | Play an MP4 from Home | Video starts, controls respond, seek works | Not run | Not run |
| 2 | Play an HLS `.m3u8` from Home | Same | Not run | Not run |
| 3 | Rotate to landscape mid-playback | Fullscreen engages, position preserved | Not run | Not run |
| 4 | Return to portrait | Chrome restored, no black bars | Not run | Not run |
| 5 | Background the app during playback | Audio and video stop, no crash on resume | Not run | Not run |
| 6 | Navigate away mid-playback | Playback stops, no orphaned audio | Not run | Not run |
| 7 | Autoplay to next video | Next video loads, queue index advances | Not run | Not run |
| 8 | Save a video, force-quit, relaunch | Video still in Saved tab | Not run | Not run |
| 9 | Airplane mode on Home | Offline state with retry, no crash | Not run | Not run |
| 10 | Airplane mode off, tap retry | Content loads | Not run | Not run |
| 11 | Live tab with an HLS stream | Stream plays, live badge shown | Not run | Not run |
| 12 | Live tab with a YouTube source | Embed plays, no navigation outside the allowlist | Not run | Not run |
| 13 | Live stream ends while watching | Ended overlay appears, replay button works if a replay exists | Not run | Not run |
| 14 | Deep link `expoliveplayer://video/<id>` | Opens that video | Not run | Not run |
| 15 | Deep link with an unknown id | Lands on Home, no crash, no dialog | Not run | Not run |
| 16 | Shorts tab | Unchanged behavior from before the MVP work | Not run | Not run |

## Playback-specific rows (Task 6 Step 2)

| # | Check | Pass criterion | Android | iOS |
|---|---|---|---|---|
| 17 | Play a video with the screen locked, then unlock | No crash, playback state sensible | Not run | Not run |
| 18 | Receive a call during playback | Audio pauses and resumes cleanly | Not run | Not run |
| 19 | Switch from wifi to mobile data mid-stream | Playback recovers or shows an error with retry | Not run | Not run |
| 20 | Open the Live tab, leave it for five minutes, return | No battery warning, polling resumed | Not run | Not run |
| 21 | Save twenty videos, open Saved | List renders without visible delay | Not run | Not run |
| 22 | Rotate during a live stream | No crash, orientation behaves as on VOD | Not run | Not run |

## What was verified instead

Everything the automated report (`verification-report-2026-09-16.md`)
covers was run: 375 Jest tests across every increment, exercising each
screen's loading/success/empty/error/offline states, the resolver's
security boundaries, the WebView's origin allowlist, the deep-link
validator's rejection cases, and the pull-to-refresh wiring — all against
mocked `expo-video` and network layers. That proves the wiring is correct.
It does not and cannot prove real playback, real device rotation, real
backgrounding, real cellular handoff, or real battery behavior, which is
exactly why this matrix exists as a separate, human-run gate.

## Known Limitations (carried forward from the hardening plan)

1. The existing player still has the design, functional, and performance
   issues the team flagged before this work began. Increment 0B fixed only
   type errors and one crash (a use-before-declaration bug); it did not
   redesign or re-architect the player.
2. Download, picture-in-picture, quality selection, the clip editor,
   Thanks, Report, and Dislike are hidden behind feature flags, not
   implemented.
3. Likes are local to the device with no server and no displayed count.
4. Comments exist in the codebase but are not wired into any MVP screen.
5. There are no user accounts, so nothing syncs across devices.
6. Shorts was reused unchanged and has no Save integration.
7. Dependency versions were not audited against Expo SDK 54's expected
   set as part of this plan; any drift there was pre-existing and out of
   scope.
8. Content services run against demo data until a production API exists.
   `allowedMediaHosts` is enforced in code (Increment 7 Task 3) but the
   list itself is empty until production hosts are known.
9. `hooks/useVoiceSearch.ts` still imports the uninstalled `expo-speech`
   package and has a real consumer (`ShortsSearchBar.tsx`); it was not
   moved or fixed, per the Increment 7 Task 3 decision to stop and report
   rather than break Shorts.

**Status: this task is not complete.** It requires a human with physical
Android and iOS devices to work through the 22 rows above and record real
results. Nothing in this report should be read as those checks having
passed.
