import { unavailablePaymentProvider } from "../../../services/videoActions/unavailablePaymentProvider";
import { THANKS_PRESETS } from "../../../constants/config";

describe("unavailablePaymentProvider", () => {
  it("is not available, returns presets, and rejects intents", async () => {
    expect(unavailablePaymentProvider.isAvailable).toBe(false);
    await expect(unavailablePaymentProvider.getPresets()).resolves.toEqual([...THANKS_PRESETS]);
    await expect(unavailablePaymentProvider.createIntent("v1", 5_100, "INR")).rejects.toMatchObject({ code: "payments_unavailable" });
    await expect(unavailablePaymentProvider.confirm("x")).rejects.toMatchObject({ code: "payments_unavailable" });
  });
});
