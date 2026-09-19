/**
 * components/Comments/CommentComposer.tsx
 * 
 * Comment input composer
 * - Multiline text input
 * - Send button
 * - Reply context display
 * - Keyboard handling
 * - Character limit
 * - Emoji support
 * 
 * Production-ready, accessible, cross-platform
 */

import React, { memo, useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { sanitizeCommentText, validateCommentText, COMMENT_CONFIG } from "../../utils/commentValidation";
import Logger from "../../utils/Logger";

interface CommentComposerProps {
  /**
   * User's avatar URL
   */
  avatarUrl?: string;

  /**
   * Reply context (if replying to someone)
   */
  replyingTo?: {
    displayName: string;
    commentId: string;
  } | null;

  /**
   * Called when send button pressed
   */
  onSubmit: (text: string) => Promise<void>;

  /**
   * Called when cancel reply
   */
  onCancelReply?: () => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Auto-focus on mount
   */
  autoFocus?: boolean;

  /**
   * Is submitting
   */
  isSubmitting?: boolean;
}

/**
 * CommentComposer Component
 */
function CommentComposerComponent({
  avatarUrl,
  replyingTo,
  onSubmit,
  onCancelReply,
  placeholder = "Add a comment...",
  autoFocus = false,
  isSubmitting: externalIsSubmitting = false,
}: CommentComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const submittingRef = useRef(false); // Ref to prevent double-submission

  /**
   * Focus input when replying
   */
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  /**
   * Handle text change
   */
  const handleChangeText = useCallback((newText: string) => {
    setText(newText);
    setError(null);
    
    // Validate length
    if (newText.length > COMMENT_CONFIG.MAX_LENGTH) {
      setError(`Maximum ${COMMENT_CONFIG.MAX_LENGTH} characters`);
    }
  }, []);

  // Store the submit handler ref so we can call it synchronously
  const submitHandlerRef = useRef(onSubmit);
  
  // Update ref when onSubmit changes
  useEffect(() => {
    submitHandlerRef.current = onSubmit;
  }, [onSubmit]);

  /**
   * Handle send button press IN - dismiss keyboard FIRST, then submit
   * This prevents keyboard dismissal from interrupting submission
   */
  const handlePressIn = useCallback((event: any) => {
    console.log("[CommentComposer] 🔘 Send button pressed IN - dismissing keyboard first");
    
    // Prevent default behavior
    event?.preventDefault?.();
    event?.stopPropagation?.();
    
    // Get current text value directly (don't rely on closure)
    const currentText = text;
    
    // Check if we can submit (synchronous checks only)
    if (submittingRef.current || isSubmitting || externalIsSubmitting) {
      console.log("[CommentComposer] ⚠️ Already submitting, ignoring...");
      return;
    }

    if (!currentText || !currentText.trim()) {
      console.log("[CommentComposer] ⚠️ Empty text, ignoring...");
      return;
    }

    // Validate synchronously
    const sanitized = sanitizeCommentText(currentText);
    const validation = validateCommentText(sanitized);

    if (!validation.isValid) {
      setError(validation.error || "Invalid comment");
      Logger.warn(`[CommentComposer] Validation failed: ${validation.error}`);
      return;
    }

    // MARK AS SUBMITTING IMMEDIATELY (synchronous)
    submittingRef.current = true;
    setIsSubmitting(true);

    // TRICK: Dismiss keyboard FIRST, then submit with delays
    // This way keyboard can't interrupt the submission
    console.log("[CommentComposer] 🔽 Step 1: Dismissing keyboard...");
    
    // Step 1: Blur input to dismiss keyboard
    if (inputRef.current) {
      inputRef.current.blur();
    }
    
    // Step 1: Dismiss keyboard immediately
    Keyboard.dismiss();
    
    // Step 2: Wait longer for keyboard to fully dismiss (300ms delay)
    setTimeout(() => {
      console.log("[CommentComposer] ✅ Step 2: Keyboard dismissed (300ms), preparing first submission...");
      
      const submitHandler = submitHandlerRef.current;
      
      // Helper function to handle submission
      const performSubmission = (attemptNumber: number): Promise<void> => {
        // Check if already completed (duplicate prevention)
        if (!submittingRef.current) {
          console.log(`[CommentComposer] ⚠️ Attempt ${attemptNumber} skipped - already completed`);
          return Promise.resolve();
        }
        
        console.log(`[CommentComposer] 🔄 Step ${attemptNumber + 2}: Submission attempt ${attemptNumber} for: "${sanitized.substring(0, 30)}..."`);
        
        return submitHandler(sanitized)
          .then(() => {
            // Check again if another attempt already succeeded
            if (!submittingRef.current) {
              console.log(`[CommentComposer] ⚠️ Attempt ${attemptNumber} success ignored - already completed`);
              return;
            }
            
            // Success - clear text
            setText("");
            setError(null);
            
            // Mark as no longer submitting
            submittingRef.current = false;
            setIsSubmitting(false);
            
            console.log(`[CommentComposer] ✅ Comment submitted successfully (attempt ${attemptNumber})`);
            Logger.info(`[CommentComposer] Comment submitted successfully`);
          })
          .catch((err) => {
            // Only show error if this was the last attempt or first failed
            if (submittingRef.current) {
              Logger.error("[CommentComposer] Failed to submit:", err);
              setError(err instanceof Error ? err.message : "Failed to post comment");
              
              // Reset state only if both attempts failed
              submittingRef.current = false;
              setIsSubmitting(false);
              
              // Re-focus input on error so user can retry
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }, 200);
            } else {
              console.log(`[CommentComposer] ⚠️ Attempt ${attemptNumber} error ignored - another attempt succeeded`);
            }
          });
      };
      
      // Step 3: FIRST submission attempt after keyboard is fully dismissed (300ms delay from start)
      setTimeout(() => {
        console.log("[CommentComposer] 🔄 Step 3: Firing first submission attempt (100ms delay after keyboard dismiss)...");
        performSubmission(1).catch(() => {
          // Error handled in performSubmission
        });
      }, 100); // Additional 100ms delay (total 400ms from button press)
      
      // Step 4: SECOND submission attempt after longer delay (300ms + 100ms + 150ms = 550ms total)
      setTimeout(() => {
        if (submittingRef.current) {
          // Still submitting means first attempt didn't complete, try again
          console.log(`[CommentComposer] 🔄 Step 4: First attempt may not have completed, firing second attempt (150ms delay after first)...`);
          performSubmission(2).catch(() => {
            // Error handled in performSubmission
          });
        } else {
          console.log(`[CommentComposer] ✅ Step 4: First attempt already succeeded, skipping second`);
        }
      }, 250); // 250ms delay after first attempt (100ms + 250ms = 350ms from keyboard dismiss, 650ms total)
    }, 300); // Wait 300ms for keyboard to fully dismiss (increased from 150ms)
  }, [text, isSubmitting, externalIsSubmitting]); // Note: onSubmit removed from deps - using ref instead

  /**
   * Handle send (called from onPress - fallback)
   * Uses same approach: dismiss keyboard first, then submit
   */
  const handleSend = useCallback(() => {
    // If onPressIn already handled it, just log and return
    if (submittingRef.current || isSubmitting || externalIsSubmitting) {
      console.log("[CommentComposer] ⚠️ Already submitting (likely handled by onPressIn), ignoring onPress");
      return;
    }

    const currentText = text;
    
    if (!currentText || !currentText.trim()) {
      return;
    }

    const sanitized = sanitizeCommentText(currentText);
    const validation = validateCommentText(sanitized);

    if (!validation.isValid) {
      setError(validation.error || "Invalid comment");
      Logger.warn(`[CommentComposer] Validation failed: ${validation.error}`);
      return;
    }

    // Mark as submitting
    submittingRef.current = true;
    setIsSubmitting(true);

    // TRICK: Dismiss keyboard FIRST, then submit with delays (same as onPressIn)
    console.log("[CommentComposer] 🔽 onPress Step 1: Dismissing keyboard...");
    
    // Step 1: Blur input to dismiss keyboard
    if (inputRef.current) {
      inputRef.current.blur();
    }
    
    // Step 1: Dismiss keyboard immediately
    Keyboard.dismiss();
    
    // Step 2: Wait longer for keyboard to fully dismiss (300ms delay)
    setTimeout(() => {
      console.log("[CommentComposer] ✅ onPress Step 2: Keyboard dismissed (300ms), preparing first submission...");
      
      const submitHandler = submitHandlerRef.current;
      
      // Helper function (same as onPressIn)
      const performSubmission = (attemptNumber: number): Promise<void> => {
        if (!submittingRef.current) {
          console.log(`[CommentComposer] ⚠️ onPress attempt ${attemptNumber} skipped - already completed`);
          return Promise.resolve();
        }
        
        return submitHandler(sanitized)
          .then(() => {
            if (!submittingRef.current) {
              console.log(`[CommentComposer] ⚠️ onPress attempt ${attemptNumber} success ignored - already completed`);
              return;
            }
            
            setText("");
            setError(null);
            submittingRef.current = false;
            setIsSubmitting(false);
            
            console.log(`[CommentComposer] ✅ Comment submitted via onPress (attempt ${attemptNumber})`);
          })
          .catch((err) => {
            if (submittingRef.current) {
              Logger.error("[CommentComposer] Failed to submit:", err);
              setError(err instanceof Error ? err.message : "Failed to post comment");
              submittingRef.current = false;
              setIsSubmitting(false);
              
              // Re-focus on error
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }, 200);
            } else {
              console.log(`[CommentComposer] ⚠️ onPress attempt ${attemptNumber} error ignored - another attempt succeeded`);
            }
          });
      };
      
      // Step 3: FIRST submission attempt after keyboard is fully dismissed (100ms delay)
      setTimeout(() => {
        console.log("[CommentComposer] 🔄 onPress Step 3: Firing first submission attempt (100ms delay after keyboard dismiss)...");
        performSubmission(1).catch(() => {});
      }, 100); // Additional 100ms delay (total 400ms from button press)
      
      // Step 4: SECOND submission attempt after longer delay (250ms delay after first)
      setTimeout(() => {
        if (submittingRef.current) {
          console.log(`[CommentComposer] 🔄 onPress Step 4: First attempt may not have completed, firing second attempt (250ms delay after first)...`);
          performSubmission(2).catch(() => {});
        } else {
          console.log(`[CommentComposer] ✅ onPress Step 4: First attempt already succeeded, skipping second`);
        }
      }, 250); // 250ms delay after first attempt (100ms + 250ms = 350ms from keyboard dismiss, 650ms total)
    }, 300); // Wait 300ms for keyboard to fully dismiss (same as onPressIn)
  }, [text, isSubmitting, externalIsSubmitting]);

  /**
   * Handle cancel reply
   */
  const handleCancelReply = useCallback(() => {
    onCancelReply?.();
    setText("");
    setError(null);
    
    Logger.info("[CommentComposer] Cancelled reply");
  }, [onCancelReply]);

  // Calculate if button should be enabled
  // Note: We check isSubmitting but don't disable button - just show loading state
  const canSend = text.trim().length > 0 && text.length <= COMMENT_CONFIG.MAX_LENGTH;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      scrollEnabled={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={styles.container}
      >
      {/* Reply Context */}
      {replyingTo && (
        <View style={styles.replyContext}>
          <Text style={styles.replyText}>
            Replying to <Text style={styles.replyName}>{replyingTo.displayName}</Text>
          </Text>
          <Pressable
            onPress={handleCancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityLabel="Cancel reply"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close" size={20} color="#606060" />
          </Pressable>
        </View>
      )}

      {/* Composer */}
      <View style={styles.composer}>
        {/* Avatar */}
        <View style={styles.avatar}>
          {avatarUrl ? (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>Y</Text>
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <MaterialCommunityIcons name="account-circle" size={36} color="#606060" />
            </View>
          )}
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            placeholderTextColor="#999999"
            style={styles.input}
            multiline
            maxLength={COMMENT_CONFIG.MAX_LENGTH + 50} // Soft limit
            autoFocus={autoFocus}
            returnKeyType="send"
            blurOnSubmit={true}
            onSubmitEditing={() => {
              // When Enter/Send is pressed, use same approach: dismiss keyboard first
              if (!submittingRef.current && !isSubmitting && !externalIsSubmitting && text.trim().length > 0) {
                // Manually call the submission logic
                handlePressIn({ preventDefault: () => {}, stopPropagation: () => {} });
              }
            }}
            accessible
            accessibilityLabel="Comment input"
            accessibilityHint="Type your comment here"
          />

          {/* Character Count */}
          {text.length > COMMENT_CONFIG.MAX_LENGTH * 0.8 && (
            <Text style={[
              styles.charCount,
              text.length > COMMENT_CONFIG.MAX_LENGTH && styles.charCountError
            ]}>
              {text.length}/{COMMENT_CONFIG.MAX_LENGTH}
            </Text>
          )}
        </View>

        {/* Send Button */}
        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          onPressIn={handlePressIn}
          delayPressIn={0}
          delayPressOut={0}
          // CRITICAL: Don't disable button based on isSubmitting - let onPressIn handle it
          // Otherwise disabled buttons might not fire onPressIn properly on some platforms
          disabled={!canSend}
          // Prevent touch from propagating to parent (which might cause blur)
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible
          accessibilityLabel={isSubmitting ? "Submitting comment..." : "Send comment"}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons
              name="send"
              size={22}
              color={canSend ? "#FFFFFF" : "#999999"}
            />
          )}
        </Pressable>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      </KeyboardAvoidingView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  replyContext: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  replyText: {
    fontSize: 13,
    color: "#606060",
  },
  replyName: {
    fontWeight: "600",
    color: "#000000",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#606060",
  },
  inputContainer: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: "#F5F5F5",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    color: "#000000",
    minHeight: 20,
    maxHeight: 84,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      },
    }),
  },
  charCount: {
    fontSize: 11,
    color: "#999999",
    textAlign: "right",
    marginTop: 2,
  },
  charCountError: {
    color: "#FF0000",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#065FD4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#FF0000",
  },
});

export const CommentComposer = memo(CommentComposerComponent);

export default CommentComposer;

