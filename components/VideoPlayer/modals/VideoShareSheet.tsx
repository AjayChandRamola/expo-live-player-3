/**
 * components/VideoPlayer/modals/VideoShareSheet.tsx
 * 
 * Native share sheet for sharing videos
 * - Uses platform native share dialog
 * - Includes video title, URL, and app name
 * - Logging for analytics
 * 
 * Production-ready, accessible
 */

import React, { useEffect } from "react";
import { Share, Platform, Alert } from "react-native";
import * as Linking from "expo-linking";
import Logger from "../../../utils/Logger";

interface VideoShareSheetProps {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Video title
   */
  title?: string;

  /**
   * Video URL
   */
  url?: string;

  /**
   * Whether to show share sheet (if true, opens immediately)
   */
  visible: boolean;

  /**
   * Callback when share completes or is cancelled
   */
  onClose: () => void;
}

/**
 * VideoShareSheet Component
 * Opens native share sheet when visible becomes true
 */
export function VideoShareSheet({
  videoId,
  title = "Check out this video",
  url,
  visible,
  onClose,
}: VideoShareSheetProps) {
  useEffect(() => {
    if (!visible) return;

    const shareVideo = async () => {
      try {
        const shareUrl = url || `https://example.com/video/${videoId}`;
        const shareMessage = `${title}\n\n${shareUrl}`;

        Logger.info("[VideoShareSheet] Opening native share sheet", {
          videoId,
          title,
          url: shareUrl,
        });

        const result = await Share.share(
          {
            message: Platform.OS === "android" ? shareMessage : title,
            url: Platform.OS === "ios" ? shareUrl : undefined,
            title: title,
          },
          {
            dialogTitle: "Share video",
            subject: title, // iOS only
          }
        );

        if (result.action === Share.sharedAction) {
          Logger.info("[VideoShareSheet] Video shared successfully", {
            videoId,
            activityType: result.activityType,
          });
        } else if (result.action === Share.dismissedAction) {
          Logger.info("[VideoShareSheet] Share cancelled", { videoId });
        }

        onClose();
      } catch (error) {
        Logger.error("[VideoShareSheet] Failed to share video:", error);
        Alert.alert("Error", "Failed to share video. Please try again.");
        onClose();
      }
    };

    shareVideo();
  }, [visible, videoId, title, url, onClose]);

  // This component doesn't render anything, it just triggers the share sheet
  return null;
}

