// __tests__/player/engine/devLog.test.ts
import { devLog, resetDevLogDedupe } from "../../../components/VideoPlayer/engine/devLog";

describe("devLog", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    warn.mockClear();
    resetDevLogDedupe();
  });

  it("logs a label once and de-duplicates repeats", () => {
    devLog("reducer.ignored.idle.timeUpdate");
    devLog("reducer.ignored.idle.timeUpdate");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("reducer.ignored.idle.timeUpdate");
  });

  it("logs different labels separately and includes detail", () => {
    devLog("a", { x: 1 });
    devLog("b");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][1]).toEqual({ x: 1 });
  });
});
