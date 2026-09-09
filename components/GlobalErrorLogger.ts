import { logToServer } from "../utils/Logger";

// Handle uncaught JS errors
export const setupGlobalErrorHandler = () => {
  const defaultHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error("Global JS Error:", error);
    logToServer("fatal", error, { isFatal });

    // Call default handler to preserve Expo red screen behavior
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });

  // Handle unhandled promise rejections
  if (typeof globalThis.addEventListener === "function") {
    globalThis.addEventListener("unhandledrejection", (event: any) => {
      console.error("Unhandled Promise Rejection:", event.reason);
      logToServer("error", event.reason, { context: "UnhandledPromiseRejection" });
    });
  }
};
