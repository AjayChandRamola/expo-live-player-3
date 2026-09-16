# ADR 0009 — Thanks is built against a PaymentProvider interface with no live provider

| Field | Value |
|---|---|
| Status | Accepted 2026-09-16 |
| Spec | F36 |

## Context

The human wants the Thanks (donation) flow built now, with the payment backend coming later on an unknown platform. The functional rules forbid placeholders that claim success.

## Decision

Define `PaymentProvider` in `services/videoActions/PaymentProvider.ts`:

```ts
interface PaymentProvider {
  readonly isAvailable: boolean;
  getPresets(): Promise<readonly ThanksPreset[]>;       // amount in minor units, currency, label
  createIntent(videoId: string, amountMinor: number, currency: string): Promise<PaymentIntent>;
  confirm(intentId: string): Promise<PaymentResult>;    // "succeeded" | "cancelled" | "failed"
}
```

Ship exactly one implementation, `unavailablePaymentProvider` (`isAvailable: false`, presets from constants, `createIntent` and `confirm` reject with `AppError("payments_unavailable")`). `ThanksSheet` renders the full amount-select UI, and when `isAvailable` is false shows the "Thanks is coming soon" state with Confirm disabled. There is no code path that reports a successful payment.

## Alternatives considered

1. **Integrate a provider SDK now (Stripe, Razorpay).** Rejected: platform undecided; native SDKs need config plugins and an account.
2. **Hide Thanks entirely.** Rejected by the human's Tier 3 choice.

## Consequences

- Positive: UI, analytics and states are done; a provider is a drop-in.
- Negative: a visible button that leads to "coming soon". `PLAYER_FEATURE_FLAGS.thanks` controls whether the button shows at all; the default after this work is `false` until the human decides to show the teaser.

## Verification

- `__tests__/components/actions/ThanksSheet.test.tsx`: renders presets, disabled confirm, "coming soon" copy with the unavailable provider; success path tested with a fake available provider to prove the sheet is complete.
