// __tests__/player/fakes/fakeVideoPlayer.ts
// Scripted stand-in for expo-video's VideoPlayer, shaped to the subset the
// engine uses (EngineVideoPlayer). Tests drive events with emit().
import type { EngineVideoPlayer } from "../../../components/VideoPlayer/engine/PlaybackEngine";

type Handler = (payload: unknown) => void;

export interface FakeSubtitleTrack {
  id: string;
  language: string;
  label: string;
}
export interface FakeVideoTrack {
  id: string;
  size: { width: number; height: number };
  mimeType: string | null;
  isSupported: boolean;
  bitrate: number | null;
  frameRate: number | null;
}

export interface FakeVideoPlayer {
  // mutable state
  playing: boolean;
  loop: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  timeUpdateEventInterval: number;
  keepScreenOnWhilePlaying: boolean;
  staysActiveInBackground: boolean;
  showNowPlayingNotification: boolean;
  preservesPitch: boolean;
  isLive: boolean;
  status: "idle" | "loading" | "readyToPlay" | "error";
  bufferedPosition: number;
  currentLiveTimestamp: number | null;
  currentOffsetFromLive: number | null;
  targetOffsetFromLive: number;
  subtitleTrack: FakeSubtitleTrack | null;
  availableSubtitleTracks: FakeSubtitleTrack[];
  videoTrack: FakeVideoTrack | null;
  availableVideoTracks: FakeVideoTrack[];
  // methods
  play: jest.Mock<void, []>;
  pause: jest.Mock<void, []>;
  replace: jest.Mock<void, [unknown]>;
  replay: jest.Mock<void, []>;
  seekBy: jest.Mock<void, [number]>;
  addListener: (event: string, handler: Handler) => { remove: () => void };
  // test helpers
  emit(event: string, payload: unknown): void;
  listenerCount(event: string): number;
  replaceCalls: unknown[];
  asPlayer(): EngineVideoPlayer;
}

export function createFakeVideoPlayer(overrides: Partial<FakeVideoPlayer> = {}): FakeVideoPlayer {
  const listeners = new Map<string, Set<Handler>>();

  const fake: FakeVideoPlayer = {
    playing: false,
    loop: false,
    muted: false,
    currentTime: 0,
    duration: 100,
    volume: 1,
    playbackRate: 1,
    timeUpdateEventInterval: 0,
    keepScreenOnWhilePlaying: false,
    staysActiveInBackground: true,
    showNowPlayingNotification: true,
    preservesPitch: false,
    isLive: false,
    status: "idle",
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    targetOffsetFromLive: 0,
    subtitleTrack: null,
    availableSubtitleTracks: [],
    videoTrack: null,
    availableVideoTracks: [],
    replaceCalls: [],
    play: jest.fn(() => {
      const old = fake.playing;
      fake.playing = true;
      fake.emit("playingChange", { isPlaying: true, oldIsPlaying: old });
    }),
    pause: jest.fn(() => {
      const old = fake.playing;
      fake.playing = false;
      fake.emit("playingChange", { isPlaying: false, oldIsPlaying: old });
    }),
    replace: jest.fn((source: unknown) => {
      fake.replaceCalls.push(source);
      const old = fake.status;
      fake.status = "loading";
      fake.playing = false;
      fake.emit("statusChange", { status: "loading", oldStatus: old });
    }),
    replay: jest.fn(() => {
      fake.currentTime = 0;
      fake.play();
    }),
    seekBy: jest.fn((seconds: number) => {
      const target = fake.currentTime + seconds;
      fake.currentTime = Number.isFinite(fake.duration) && fake.duration > 0 ? Math.min(fake.duration, Math.max(0, target)) : Math.max(0, target);
    }),
    addListener: (event, handler) => {
      const set = listeners.get(event) ?? new Set<Handler>();
      set.add(handler);
      listeners.set(event, set);
      return {
        remove: () => {
          set.delete(handler);
        },
      };
    },
    emit: (event, payload) => {
      for (const handler of listeners.get(event) ?? []) handler(payload);
    },
    listenerCount: (event) => listeners.get(event)?.size ?? 0,
    asPlayer: () => fake as unknown as EngineVideoPlayer,
    ...overrides,
  };
  return fake;
}
