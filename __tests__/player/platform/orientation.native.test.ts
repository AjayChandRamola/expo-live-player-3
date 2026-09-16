// __tests__/player/platform/orientation.native.test.ts
import * as ScreenOrientation from "expo-screen-orientation";
import { orientationAdapter } from "../../../components/VideoPlayer/platform/orientation.native";

const lockAsync = ScreenOrientation.lockAsync as jest.Mock;
const unlockAsync = ScreenOrientation.unlockAsync as jest.Mock;
const addListener = ScreenOrientation.addOrientationChangeListener as jest.Mock;
const removeListener = ScreenOrientation.removeOrientationChangeListener as jest.Mock;

describe("orientation adapter (native)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("locks landscape and portrait with the right enum values", async () => {
    await expect(orientationAdapter.lock("landscape")).resolves.toEqual({ ok: true });
    expect(lockAsync).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.LANDSCAPE);
    await orientationAdapter.lock("portrait");
    expect(lockAsync).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  });

  it("unlocks", async () => {
    await expect(orientationAdapter.unlock()).resolves.toEqual({ ok: true });
    expect(unlockAsync).toHaveBeenCalledTimes(1);
  });

  it("maps a rejected lock to fail(name)", async () => {
    lockAsync.mockRejectedValueOnce(new RangeError("bad"));
    await expect(orientationAdapter.lock("landscape")).resolves.toEqual({ ok: false, reason: "RangeError" });
  });

  it("subscribe reports isPortrait and removes the native listener on unsubscribe", () => {
    const listener = jest.fn();
    const subscription = { remove: jest.fn() };
    addListener.mockReturnValueOnce(subscription);
    const unsubscribe = orientationAdapter.subscribe(listener);
    const nativeHandler = addListener.mock.calls[0][0] as (e: { orientationInfo: { orientation: number } }) => void;
    nativeHandler({ orientationInfo: { orientation: ScreenOrientation.Orientation.LANDSCAPE_LEFT } });
    expect(listener).toHaveBeenLastCalledWith(false);
    nativeHandler({ orientationInfo: { orientation: ScreenOrientation.Orientation.PORTRAIT_UP } });
    expect(listener).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(subscription);
  });
});
