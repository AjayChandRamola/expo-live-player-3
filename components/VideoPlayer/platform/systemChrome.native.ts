// components/VideoPlayer/platform/systemChrome.native.ts
import { StatusBar } from "react-native";
import { fail, ok, reasonOf, type SystemChromeAdapter } from "./types";

function setHidden(hidden: boolean) {
  try {
    StatusBar.setHidden(hidden, "fade");
    return ok;
  } catch (error) {
    return fail(reasonOf(error));
  }
}

export const systemChromeAdapter: SystemChromeAdapter = {
  hide: async () => setHidden(true),
  show: async () => setHidden(false),
};
