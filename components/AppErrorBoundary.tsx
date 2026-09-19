import { ErrorBoundary as DefaultErrorBoundary } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import Logger from "@/utils/Logger";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Logger.error("RenderError", error?.message ?? error, error?.stack ?? "");
  }, [error]);

  return <DefaultErrorBoundary error={error} retry={retry} />;
}
