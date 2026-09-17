export interface ThanksPreset {
  readonly amountMinor: number;
  readonly currency: "INR";
  readonly label: string;
}
export interface PaymentIntent {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: string;
}
export type PaymentResult =
  | { readonly status: "succeeded"; readonly receiptId: string }
  | { readonly status: "cancelled" }
  | { readonly status: "failed"; readonly code: string };

export interface PaymentProvider {
  readonly isAvailable: boolean;
  getPresets(): Promise<readonly ThanksPreset[]>;
  createIntent(videoId: string, amountMinor: number, currency: string): Promise<PaymentIntent>;
  confirm(intentId: string): Promise<PaymentResult>;
}
