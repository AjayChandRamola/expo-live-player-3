// services/analytics.ts
/**
 * No-op analytics sink for MVP. Logs in development, does nothing in
 * production. Never pass a URL or anything identifying a person as a prop
 * value here.
 */
import Logger from "../utils/Logger";

export type AnalyticsEvent = "video_start" | "video_finish" | "live_join";

export function track(
  event: AnalyticsEvent,
  props: Record<string, string | number | boolean>,
): void {
  if (__DEV__) {
    Logger.info("[Analytics]", event, props);
  }
}
