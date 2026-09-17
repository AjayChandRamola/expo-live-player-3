// types/result.ts
/** Stable error codes. UI maps these to states; never show raw exceptions. */
export type AppErrorCode =
  | "network"
  | "timeout"
  | "not_found"
  | "invalid_source"
  | "unsupported_source"
  | "storage"
  | "storage_full"
  | "payments_unavailable"
  | "unauthorized"
  | "validation"
  | "unknown";

/** The only error shape that crosses a service boundary. */
export interface AppError {
  readonly code: AppErrorCode;
  /** Safe to render to a user. Never contains a URL, stack, or personal data. */
  readonly message: string;
  /** Logged only, never rendered. */
  readonly cause?: unknown;
}

export type LoadStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "offline";

/** Uniform return shape for every feature hook. */
export interface Loadable<T> {
  readonly status: LoadStatus;
  readonly data: T | null;
  readonly error: AppError | null;
  readonly retry: () => void;
}

/** Loadable plus pagination, for list hooks. */
export interface PagedLoadable<T> extends Loadable<T[]> {
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMore: () => void;
}
