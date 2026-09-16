# 04 — Playback Engine Specification

| Field | Value |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-16-video-player-redesign-design.md` section 4 |
| ADR | 0002 |
| Library facts verified on 2026-09-16 | `node_modules/expo-video/build/VideoPlayer.types.d.ts`: `VideoPlayerStatus = 'idle' \| 'loading' \| 'readyToPlay' \| 'error'`; `PlayerError = { message: string }`; `ContentType = 'auto' \| 'progressive' \| 'hls' \| 'dash' \| 'smoothStreaming'`; properties `playing`, `loop`, `muted`, `currentTime`, `duration`, `volume`, `playbackRate`, `timeUpdateEventInterval`, `keepScreenOnWhilePlaying`, `isLive`, `status`, `staysActiveInBackground`, `bufferedPosition`, `subtitleTrack` (writable), `availableSubtitleTracks`, `videoTrack` (read-only), `availableVideoTracks` (read-only), `currentLiveTimestamp`, `currentOffsetFromLive`, `targetOffsetFromLive`; methods `play()`, `pause()`, `replace(source)`, `replaceAsync(source)`, `seekBy(seconds)`, `replay()`. Events: `statusChange`, `playingChange`, `playbackRateChange`, `volumeChange`, `mutedChange`, `playToEnd`, `timeUpdate`, `sourceChange`, `availableSubtitleTracksChange`, `subtitleTrackChange`, `availableAudioTracksChange`, `audioTrackChange`, `videoTrackChange`, `sourceLoad`, `isExternalPlaybackActiveChange`. |

## 1. Files

| File | Kind | Lines (target) |
|---|---|---|
| `engine/types.ts` | types | ≤ 150 |
| `engine/initialSnapshot.ts` | pure | ≤ 40 |
| `engine/playbackReducer.ts` | pure | ≤ 300 |
| `engine/retryPolicy.ts` | pure | ≤ 30 |
| `engine/classifyError.ts` | pure | ≤ 60 |
| `engine/PlaybackEngine.ts` | class | ≤ 250 |
| `engine/usePlaybackEngine.ts` | hook | ≤ 120 |
| `engine/pure/selectCue.ts`, `currentChapter.ts`, `clamp.ts`, `formatTime.ts` | pure | ≤ 40 each |

## 2. Snapshot field semantics

| Field | Unit | Source of truth | Reset on new source? |
|---|---|---|---|
| `status` | enum | reducer | yes → `loading` |
| `positionMs` | ms, integer | `timeUpdate.currentTime * 1000`, rounded | yes → 0 |
| `durationMs` | ms, integer | `sourceLoad.duration * 1000` (payload `{ videoSource, duration, … }`, verified) and, as a fallback, `player.duration` read inside the `timeUpdate` handler and on `readyToPlay`. `TimeUpdateEventPayload` itself carries only `currentTime`, `currentLiveTimestamp`, `currentOffsetFromLive`, `bufferedPosition`. `NaN`/`Infinity`/negative → 0. The engine subscribes to `sourceLoad` in addition to the 11 events in E1 (12 subscriptions total). | yes → 0 |
| `bufferedMs` | ms | `timeUpdate.bufferedPosition * 1000`; `-1` → 0 | yes → 0 |
| `isLive` | bool | `source.isLive || player.isLive` read on `readyToPlay` | yes |
| `liveOffsetMs` | ms or null | `timeUpdate.currentOffsetFromLive * 1000` when live, else null | yes → null |
| `playbackRate` | number | `playbackRateChange.playbackRate` | yes → 1 (engine sets `player.playbackRate = 1` on setSource) |
| `muted` | bool | `mutedChange.muted` | no |
| `volume` | 0..1 | `volumeChange.volume` | no |
| `error` | object or null | reducer via `classifyError` | yes → null |
| `retryAttempt` | 0..3 | engine | yes → 0 |
| `qualities` | array | `videoTrackChange.availableVideoTracks` mapped to `QualityTrack` | yes → [] |
| `activeQuality` | object or null | `videoTrackChange.videoTrack` | yes → null |
| `subtitleTracks` | array | `availableSubtitleTracksChange.availableSubtitleTracks` | yes → [] |
| `activeSubtitle` | object or null | `subtitleTrackChange.subtitleTrack` | yes → null |
| `isPictureInPicture` | bool | `notifyPictureInPicture` | no |
| `isPlayingBeforeBackground` | bool | reducer on `appBackground` | yes → false |

`QualityTrack.label`: `${height}p` when `height > 0`, else `"Auto"`.

## 3. Transition table (normative)

Rows are the current `status`. Columns are events. Cell format: `next status; field changes`. `—` means ignored (return `prev` by reference, dev warning). Events not listed (`rateChange`, `mutedChange`, `volumeChange`, `qualitiesChange`, `subtitlesChange`, `pipChange`, `retryScheduled`) update their field(s) in every status except `idle`, where they are `—`.

| status ↓ / event → | sourceSet | statusChange:loading | statusChange:readyToPlay | statusChange:error | playingChange:true | playingChange:false | timeUpdate | playToEnd | stall | appBackground | appForeground | disposed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **idle** | loading; reset (§2 "yes" fields), isLive=event.isLive | loading | — | error; error=event.error | — | — | — | — | — | — | — | idle |
| **loading** | loading; reset | — | ready | error; error=event.error | playing | — | fields | — | — | loading; isPlayingBeforeBackground=false | — | idle |
| **ready** | loading; reset | — | — | error | playing | — | fields | ended | — | ready | — | idle |
| **playing** | loading; reset | buffering | — | error | — | paused | fields | ended | buffering | paused; isPlayingBeforeBackground=true | — | idle |
| **paused** | loading; reset | — | — | error | playing | — | fields | ended | — | paused; isPlayingBeforeBackground=false | paused | idle |
| **buffering** | loading; reset | — | buffering | error | playing | paused | fields; if `bufferedMs > positionMs + MIN_BUFFER_AHEAD_MS` → playing | ended | — | paused; isPlayingBeforeBackground=true | — | idle |
| **ended** | loading; reset | — | — | error | playing | — | positionMs only | — | — | ended | — | idle |
| **error** | loading; reset, error=null, retryAttempt=0 | loading; keep retryAttempt, error=null | — | error; error=event.error | — | — | — | — | — | error | — | idle |

Notes:
- "fields" = update `positionMs`, `bufferedMs`, `durationMs` (if now known), `liveOffsetMs`.
- `statusChange:readyToPlay` while `loading` goes to `ready` even when autoplay is on; the engine then calls `player.play()` and the subsequent `playingChange:true` moves to `playing`. This keeps the reducer free of options.
- `playToEnd` in `playing` while `loop` is true: native restarts; the reducer still goes to `ended`, then the next `playingChange:true` returns to `playing`. Shorts will rely on this.
- `playingChange:false` in `playing` could also be the start of a stall (ExoPlayer pauses `playing` when buffering). The engine disambiguates: if `player.status === "loading"` at that moment, it dispatches `statusChange:loading` instead of `playingChange:false`, producing `buffering`.

## 4. Engine behaviour rules (normative, one test each)

| Id | Rule |
|---|---|
| E1 | On construct: subscribe to the 11 events listed in spec 4.4 plus `sourceLoad` (12 total); store subscriptions in `disposables`. `dispose()`: `player.pause()` (guarded by `try`), remove all, clear the three timers, dispatch `disposed`. Never `release()`. |
| E2 | On construct: set `timeUpdateEventInterval = options.timeUpdateIntervalMs / 1000`, `loop`, `muted = mutedByDefault`, `keepScreenOnWhilePlaying = true`, `staysActiveInBackground = false`, `showNowPlayingNotification = false`, `preservesPitch = true`. |
| E3 | `setSource(source, startMs?)`: cancel retry and load timers; `currentSource = source`; `pendingStartMs = startMs ?? (firstSource ? options.initialPositionMs : undefined)`; dispatch `sourceSet`; `player.playbackRate = 1`; `player.replace({ uri: source.url, headers: source.headers, contentType: source.kind === "hls" ? "hls" : "auto" })`; start load timer (`LOAD_TIMEOUT_MS`). On first `readyToPlay` after this: clear load timer; if `pendingStartMs` and not live and `pendingStartMs < durationMs - RESUME_NEAR_END_GUARD_MS` → `player.currentTime = pendingStartMs / 1000`; then if `options.autoplay` (or `resumeAfterRetry`) → `player.play()`. |
| E4 | Stall: when the snapshot enters `playing`, start `stallTimer` (`STALL_TIMEOUT_MS`); every `timeUpdate` restarts it; leaving `playing` clears it; firing dispatches `stall`. |
| E5 | Buffering exit is a reducer rule (table). The engine adds: on `playingChange:true` while `buffering`, the table already returns `playing`. |
| E6 | On `statusChange:error`: `error = classifyError(payload.error?.message)`; dispatch; `delay = nextRetryDelayMs(retryAttempt, error)`; if `delay !== null`: dispatch `retryScheduled(retryAttempt + 1)`, set `retryTimer` to call `retrySource()` which replays E3 with `startMs = lastKnownPositionMs` and `resumeAfterRetry = wasPlayingBeforeError`. If `null`: wait for `commands.retry()` or `setSource`. `retry()` sets `retryAttempt = 0` then `retrySource()`. |
| E7 | Command validation as in spec 4.4 E7. `seekTo` also records `lastSeekMs` so the hook can fire `onPositionChange`. `goToLive`: if `player.currentLiveTimestamp` is a number, `player.targetOffsetFromLive = 0; player.seekBy(Number.MAX_SAFE_INTEGER / 1000)`; else `seekBy(Number.MAX_SAFE_INTEGER / 1000)` alone (native clamps). |
| E8 | `notifyAppState("background" \| "inactive")` when status is `playing` or `buffering`: `player.pause()`, dispatch `appBackground`. `"active"`: dispatch `appForeground`. No auto-resume (open item O2). |
| E9 | The engine publishes snapshots only; cadence for `onPositionChange` lives in the hook. |
| E10 | `onSnapshot` fires only when `next !== prev`. |
| E11 | Load timeout: `loadTimer` fires while status is `loading` → dispatch `statusChange:error` with `{ code: "network", message: ERROR_MESSAGES.network, retryable: true, cause: "load timeout" }` (then E6 applies). |
| E12 | `lastKnownPositionMs` is updated on every `timeUpdate` and used by E6 retry and by `dispose` (the hook reads it for the final `onPositionChange`). |
| E13 | All native calls are wrapped in `safeCall(fn, label)` which catches, dev-logs once per label, and returns `false`. No empty `catch {}`. |

## 5. Sequence diagrams

### 5.1 First load with autoplay and resume

```
Hook                  Engine                          expo-video player
 │ setSource(src, 42000)│                                   │
 │─────────────────────►│ dispatch sourceSet → loading      │
 │                      │ playbackRate = 1                  │
 │                      │ replace({uri,…})                  │
 │                      │──────────────────────────────────►│
 │                      │ start loadTimer(15s)              │
 │                      │◄── statusChange {loading} ────────│  (ignored: already loading)
 │                      │◄── statusChange {readyToPlay} ────│
 │                      │ clear loadTimer; → ready          │
 │                      │ currentTime = 42                  │
 │                      │──────────────────────────────────►│
 │                      │ play()                            │
 │                      │──────────────────────────────────►│
 │                      │◄── playingChange {true} ──────────│  → playing; start stallTimer
 │                      │◄── timeUpdate {42.1,…} ───────────│  fields; restart stallTimer
 │◄── snapshot ─────────│                                   │
```

### 5.2 Network error with automatic retry

```
player ── statusChange {error, {message:"Network timed out"}} ──► engine
engine: classify → {code:"network", retryable:true}; → error(attempt 0)
engine: delay = 1000; dispatch retryScheduled(1); retryTimer(1000)
… 1000 ms …
engine: retrySource(): dispatch statusChange:loading (error→loading, keep attempt=1); replace(same); loadTimer
player ── statusChange {readyToPlay} ──► engine: → ready; currentTime = lastKnown; play() (was playing)
player ── playingChange {true} ──► engine: → playing; retryAttempt stays 1 until next sourceSet resets it
   (or)
player ── statusChange {error} ──► engine: attempt 1 → delay 2000 … attempt 2 → 4000 … attempt 3 → null → stays error; UI shows Retry button
```

### 5.3 Background and foreground

```
AppState "background" ──► hook ──► engine.notifyAppState("background")
engine: status playing → player.pause(); dispatch appBackground → paused, isPlayingBeforeBackground=true
player ── playingChange {false} ──► engine: paused → paused (— ignored, same status; but reducer returns prev only if no field changes)
AppState "active" ──► engine.notifyAppState("active") → dispatch appForeground → paused (no play call)
UI: play button visible; user taps → commands.play()
```

### 5.4 Source change while playing

```
hook effect [url changed] ──► onPositionChange(lastKnown, duration)  (hook)
                         ──► engine.setSource(newSrc)  → loading; retry/load timers reset; replace(new)
player ── sourceChange ──► engine: (informational; no reducer event)
player ── statusChange readyToPlay ──► ready → play() (autoplay) → playing
```

### 5.5 Dispose

```
component unmount ──► hook cleanup:
   onPositionChange(engine.lastKnownPositionMs, snapshot.durationMs) if not live
   AppState subscription.remove()
   engine.dispose(): player.pause(); remove 11 subscriptions; clear stall/retry/load timers; dispatch disposed → idle
   (expo-video's useVideoPlayer cleanup releases the native player)
```

## 6. Fake player contract (for tests)

`__tests__/player/fakes/fakeVideoPlayer.ts` exports `createFakeVideoPlayer(overrides?)` returning an object that:
- Implements `EngineVideoPlayer` with writable properties and `jest.fn()` methods.
- `addListener(event, handler)` stores handlers per event and returns `{ remove: jest.fn(() => delete) }`; exposes `emit(event, payload)` and `listenerCount(event)`.
- `play()` sets `playing = true` and emits `playingChange {isPlaying:true}` synchronously; `pause()` the inverse. `replace()` sets `status = "loading"`, emits `statusChange {status:"loading"}` and records the source in `replaceCalls`. Tests drive `readyToPlay`, `timeUpdate`, `playToEnd`, `error` manually via `emit`.
- `seekBy(s)` adds to `currentTime`, clamped to `[0, duration]` when duration is finite.
- Default `duration = 100`, `bufferedPosition = 0`, `isLive = false`.

## 7. Constants used by the engine (defined in `components/VideoPlayer/constants.ts`)

| Name | Value | Used by |
|---|---|---|
| `TIME_UPDATE_INTERVAL_MS` | 250 | E2 |
| `STALL_TIMEOUT_MS` | 2_000 | E4 |
| `MIN_BUFFER_AHEAD_MS` | 500 | reducer buffering exit |
| `LOAD_TIMEOUT_MS` | 15_000 | E3, E11 |
| `RETRY_DELAYS_MS` | `[1_000, 2_000, 4_000]` | retryPolicy |
| `MAX_RETRIES` | `RETRY_DELAYS_MS.length` | reducer invariant |
| `RESUME_NEAR_END_GUARD_MS` | 1_000 | E3 |
| `PLAYBACK_RATES` | `[0.5, 0.75, 1, 1.25, 1.5, 2]` | E7 |
| `POSITION_REPORT_INTERVAL_MS` | 5_000 | hook |
| `ERROR_MESSAGES` | see `02-feature-catalog.md` F8 | classifyError |
| `ERROR_SUBSTRINGS` | ordered `[code, string[]][]` per spec 4.3 | classifyError |

## 8. Logging

One function in `engine/devLog.ts`: `export function devLog(label: string, detail?: Record<string, unknown>): void` that no-ops unless `__DEV__`, and de-duplicates by `label` for "ignored transition" warnings (a `Set<string>`). No `console.*` calls elsewhere in the engine. Never log `source.url` with its query string, and never log `headers`.
