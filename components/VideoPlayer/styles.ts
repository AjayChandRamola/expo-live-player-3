// components/VideoPlayer/styles.ts
/* Styles exported as `styles` using StyleSheet.create */
import * as RN from "react-native";

export const styles = RN.StyleSheet.create({
  wrapper: {
    flex: 1,
    width: "100%",
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  containerBase: {
    overflow: "hidden",
  },
  devOverlayCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  videoTouchable: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  loadingText: { marginTop: 10, fontSize: 14, color: "#fff" },
  liveBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    zIndex: 30,
    height: 22,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  liveText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  controlsWrap: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 40,
    borderRadius: 10,
    padding: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  leftGroup: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  rightGroup: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  controlTouchArea: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginHorizontal: 2,
  },
  smallAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  iconButton: { margin: 0, padding: 0 },
  sliderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 6 },
  timeLabel: { width: 48, textAlign: "center", fontSize: 12 },
  liveInfo: { flex: 1, alignItems: "center", paddingVertical: 4 },
  liveInfoText: { fontSize: 14, fontWeight: "600" },
  rowBottom: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quickGroup: { flexDirection: "row", alignItems: "center" },
  quickBtn: { minWidth: 84, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 8 },
  quickText: { fontSize: 13, fontWeight: "600" },
  replayBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  replayText: { fontWeight: "700" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorCard: { margin: 20, padding: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", elevation: 2 },
  errorTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  errorMessage: { fontSize: 13, marginBottom: 12, textAlign: "center" },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  retryText: { fontWeight: "700" },

  // captions
  captionsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 56,
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 60,
  },
  captionsText: {
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 14,
    textAlign: "center",
  },

  // menu
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.36)", justifyContent: "flex-end" },
  menuCard: { padding: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12, margin: 8 },
  menuItem: { paddingVertical: 12 },
  menuText: { fontSize: 16 },

  // badges
  smallBadge: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 13, fontWeight: "600" },

  // chapter marker
  chapterMarker: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 6,
    top: -2,
    marginLeft: -3,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  // fast-access controls
  smallIconRow: {
    position: "absolute",
    right: 12,
    top: 12,
    flexDirection: "row",
    zIndex: 80,
  },

  /* Portrait title area (NEW) */
  portraitTitleContainer: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 31,
  },
  portraitTitleInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    ...RN.Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 1 },
      default: {},
    }),
  },

  /* Portrait action bar styles (NEW) */
  portraitActionBar: {
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 30,
  },
  portraitActionInner: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  portraitActionBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  portraitActionLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
