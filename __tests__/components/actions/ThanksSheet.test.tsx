import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { VideoActionsProvider } from "../../../components/Video/actions/VideoActionsProvider";
import { ThanksSheet } from "../../../components/Video/actions/sheets/ThanksSheet";
import type { PaymentProvider } from "../../../services/videoActions/PaymentProvider";
import { THANKS_PRESETS } from "../../../constants/config";
import { makeError } from "../../../services/appError";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

function renderSheet(payments: PaymentProvider) {
  return render(
    <VideoActionsProvider deps={{ payments }}>
      <ThanksSheet visible onClose={jest.fn()} videoId="v1" testID="thanks" />
    </VideoActionsProvider>,
  );
}

describe("ThanksSheet", () => {
  it("with the default (unavailable) provider, shows the banner and disables Confirm even after selecting", async () => {
    const { unavailablePaymentProvider } = require("../../../services/videoActions/unavailablePaymentProvider");
    renderSheet(unavailablePaymentProvider);
    expect(screen.getByText("Thanks is coming soon.")).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText(THANKS_PRESETS[0].label)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(THANKS_PRESETS[0].label));
    expect(screen.getByLabelText("Confirm thanks").props.accessibilityState.disabled).toBe(true);
  });

  it("with an available provider, selecting and confirming shows Thank you!", async () => {
    const payments: PaymentProvider = {
      isAvailable: true,
      getPresets: async () => [...THANKS_PRESETS],
      createIntent: async () => ({ id: "i1", amountMinor: 5_100, currency: "INR" }),
      confirm: async () => ({ status: "succeeded", receiptId: "r1" }),
    };
    renderSheet(payments);
    await waitFor(() => expect(screen.getByLabelText(THANKS_PRESETS[0].label)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(THANKS_PRESETS[0].label));
    await act(async () => fireEvent.press(screen.getByLabelText("Confirm thanks")));
    expect(screen.getByText("Thank you!")).toBeTruthy();
  });

  it("a failed payment result shows Payment failed.", async () => {
    const payments: PaymentProvider = {
      isAvailable: true,
      getPresets: async () => [...THANKS_PRESETS],
      createIntent: async () => ({ id: "i1", amountMinor: 5_100, currency: "INR" }),
      confirm: async () => ({ status: "failed", code: "x" }),
    };
    renderSheet(payments);
    await waitFor(() => expect(screen.getByLabelText(THANKS_PRESETS[0].label)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(THANKS_PRESETS[0].label));
    await act(async () => fireEvent.press(screen.getByLabelText("Confirm thanks")));
    expect(screen.getByText("Payment failed.")).toBeTruthy();
  });

  it("createIntent rejecting with a network error shows the safe message", async () => {
    const payments: PaymentProvider = {
      isAvailable: true,
      getPresets: async () => [...THANKS_PRESETS],
      createIntent: async () => {
        throw makeError("network");
      },
      confirm: async () => ({ status: "succeeded", receiptId: "r1" }),
    };
    renderSheet(payments);
    await waitFor(() => expect(screen.getByLabelText(THANKS_PRESETS[0].label)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(THANKS_PRESETS[0].label));
    await act(async () => fireEvent.press(screen.getByLabelText("Confirm thanks")));
    expect(screen.getByText(makeError("network").message)).toBeTruthy();
  });
});
