import React, { createContext, useContext, useMemo } from "react";
import { downloadService, type DownloadService } from "../../../services/videoActions/downloadService";
import { localVideoActionsRepository } from "../../../services/videoActions/localVideoActionsRepository";
import type { PaymentProvider } from "../../../services/videoActions/PaymentProvider";
import { unavailablePaymentProvider } from "../../../services/videoActions/unavailablePaymentProvider";
import type { VideoActionsRepository } from "../../../services/videoActions/VideoActionsRepository";

export interface VideoActionsDeps {
  readonly repository: VideoActionsRepository;
  readonly downloads: DownloadService;
  readonly payments: PaymentProvider;
}

const DEFAULTS: VideoActionsDeps = { repository: localVideoActionsRepository, downloads: downloadService, payments: unavailablePaymentProvider };

const Context = createContext<VideoActionsDeps>(DEFAULTS);

export function VideoActionsProvider({ children, deps }: { readonly children: React.ReactNode; readonly deps?: Partial<VideoActionsDeps> }) {
  const value = useMemo(() => ({ ...DEFAULTS, ...deps }), [deps]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useVideoActionsDeps(): VideoActionsDeps {
  return useContext(Context);
}
