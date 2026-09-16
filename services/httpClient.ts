// services/httpClient.ts
/**
 * The only module in the app that calls fetch.
 *
 * Every response is shape-checked before it is returned, so a malformed or
 * hostile payload cannot reach a component. Every failure becomes an AppError.
 */
import { TIMING } from "../constants/config";
import Logger from "../utils/Logger";
import { makeError } from "./appError";
import { getContentSourceConfig } from "./contentSourceConfig";

export interface HttpGetOptions<T> {
  readonly path: string;
  readonly guard: (value: unknown) => value is T;
  readonly signal?: AbortSignal;
}

function statusToCode(status: number): "not_found" | "unknown" {
  return status === 404 ? "not_found" : "unknown";
}

export async function httpGet<T>({ path, guard, signal }: HttpGetOptions<T>): Promise<T> {
  const { apiBaseUrl } = getContentSourceConfig();
  const url = `${apiBaseUrl}${path}`;

  if (!url.startsWith("https://")) {
    // Never fall back to cleartext, even if the config is wrong.
    throw makeError("invalid_source");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMING.httpTimeoutMs);

  // Honour a caller's cancellation as well as our own timeout.
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      Logger.warn("[Http]", `GET ${path} returned ${response.status}`);
      throw makeError(statusToCode(response.status));
    }

    const body: unknown = await response.json();
    if (!guard(body)) {
      Logger.warn("[Http]", `GET ${path} returned an unexpected shape`);
      throw makeError("validation");
    }
    return body;
  } catch (caught) {
    // Re-throw an AppError we produced above unchanged.
    if (typeof caught === "object" && caught !== null && "code" in caught) {
      throw caught;
    }
    if (caught instanceof Error && caught.name === "AbortError") {
      throw makeError("timeout", caught);
    }
    throw makeError("network", caught);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
