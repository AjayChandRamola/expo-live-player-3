// components/Video/actions/useVideoActions.ts
// Optimistic app actions with rollback, in-flight guard and stale-response protection.
// Spec: docs/player/07-app-actions-and-repositories.md §3
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "../../../services/analytics";
import { toAppError } from "../../../services/appError";
import type { ClipRecord, ReportReason, VideoActionState } from "../../../services/videoActions/VideoActionsRepository";
import type { AppError } from "../../../types/result";
import { useVideoActionsDeps } from "./VideoActionsProvider";

export type PendingAction = "like" | "dislike" | "report" | "notInterested" | "hideChannel" | "clip";

export interface UseVideoActionsResult {
  readonly state: VideoActionState | null;
  readonly status: "loading" | "ready" | "error";
  readonly error: AppError | null;
  readonly pending: ReadonlySet<PendingAction>;
  like(): void;
  dislike(): void;
  report(reason: ReportReason, details?: string): void;
  notInterested(): void;
  hideChannel(channelId: string): void;
  createClip(startMs: number, endMs: number): Promise<ClipRecord | null>;
  retry(): void;
}

export function useVideoActions(videoId: string): UseVideoActionsResult {
  const { repository } = useVideoActionsDeps();
  const [state, setState] = useState<VideoActionState | null>(null);
  const [status, setStatus] = useState<UseVideoActionsResult["status"]>("loading");
  const [error, setError] = useState<AppError | null>(null);
  const [pending, setPending] = useState<ReadonlySet<PendingAction>>(new Set());
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const stateRef = useRef<VideoActionState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const seq = ++seqRef.current;
    setStatus("loading");
    setError(null);
    repository.getState(videoId).then(
      (loaded) => {
        if (!mountedRef.current || seq !== seqRef.current) return;
        setState(loaded);
        setStatus("ready");
      },
      (cause) => {
        if (!mountedRef.current || seq !== seqRef.current) return;
        setError(toAppError(cause));
        setStatus("error");
      },
    );
  }, [repository, videoId]);

  useEffect(load, [load]);

  const mark = (action: PendingAction, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(action);
      else next.delete(action);
      return next;
    });

  const runOptimistic = useCallback(
    (action: PendingAction, optimistic: Partial<VideoActionState>, call: () => Promise<VideoActionState>, event: "action_like" | "action_dislike" | "action_not_interested" | "report_submit") => {
      const before = stateRef.current;
      if (!before || pending.has(action)) return;
      const seq = ++seqRef.current;
      setState({ ...before, ...optimistic });
      mark(action, true);
      call().then(
        (confirmed) => {
          if (!mountedRef.current) return;
          mark(action, false);
          if (seq === seqRef.current) setState(confirmed);
          track(event, { videoId });
        },
        (cause) => {
          if (!mountedRef.current) return;
          mark(action, false);
          setState(before);
          const appError = toAppError(cause);
          setError(appError);
          track("action_failed", { videoId, code: appError.code });
        },
      );
    },
    [pending, videoId],
  );

  const like = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    runOptimistic("like", { liked: !s.liked, disliked: false }, () => repository.setLike(videoId, !s.liked), "action_like");
  }, [repository, runOptimistic, videoId]);

  const dislike = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    runOptimistic("dislike", { disliked: !s.disliked, liked: false }, () => repository.setDislike(videoId, !s.disliked), "action_dislike");
  }, [repository, runOptimistic, videoId]);

  const report = useCallback(
    (reason: ReportReason, details?: string) => runOptimistic("report", { reported: true }, () => repository.report(videoId, reason, details), "report_submit"),
    [repository, runOptimistic, videoId],
  );

  const notInterested = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    runOptimistic("notInterested", { notInterested: !s.notInterested }, () => repository.setNotInterested(videoId, !s.notInterested), "action_not_interested");
  }, [repository, runOptimistic, videoId]);

  const hideChannel = useCallback(
    (channelId: string) => {
      mark("hideChannel", true);
      repository.setChannelHidden(channelId, true).then(
        () => mountedRef.current && mark("hideChannel", false),
        (cause) => {
          if (!mountedRef.current) return;
          mark("hideChannel", false);
          setError(toAppError(cause));
        },
      );
    },
    [repository],
  );

  const createClip = useCallback(
    async (startMs: number, endMs: number): Promise<ClipRecord | null> => {
      mark("clip", true);
      try {
        const clip = await repository.createClip(videoId, startMs, endMs);
        track("clip_create", { videoId });
        return clip;
      } catch (cause) {
        if (mountedRef.current) setError(toAppError(cause));
        return null;
      } finally {
        if (mountedRef.current) mark("clip", false);
      }
    },
    [repository, videoId],
  );

  return { state, status, error, pending, like, dislike, report, notInterested, hideChannel, createClip, retry: load };
}
