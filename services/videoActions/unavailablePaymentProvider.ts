// services/videoActions/unavailablePaymentProvider.ts
// The only shipped provider (ADR 0009). Never reports a successful payment.
import { THANKS_PRESETS } from "../../constants/config";
import { makeError } from "../appError";
import type { PaymentProvider } from "./PaymentProvider";

export const unavailablePaymentProvider: PaymentProvider = {
  isAvailable: false,
  getPresets: async () => [...THANKS_PRESETS],
  createIntent: async () => {
    throw makeError("payments_unavailable");
  },
  confirm: async () => {
    throw makeError("payments_unavailable");
  },
};
