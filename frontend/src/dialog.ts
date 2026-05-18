import { Alert, Platform } from "react-native";

/**
 * Cross-platform dialog helpers.
 *
 * `Alert.alert` from React Native is a NO-OP on Expo Web (or just renders a
 * silent log). To make confirmation flows work in the browser AND on native,
 * we route through window.confirm / window.alert on web and Alert.alert on
 * iOS / Android.
 */

type ConfirmOpts = {
  title: string;
  message?: string;
  okLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

/** Ask the user to confirm an action. Resolves immediately; the actual work
 *  is delegated to `onConfirm` / `onCancel` callbacks (mirrors Alert.alert API). */
export function confirmAction(opts: ConfirmOpts) {
  const { title, message, okLabel = "OK", cancelLabel = "Annuler", destructive, onConfirm, onCancel } = opts;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const text = message ? `${title}\n\n${message}` : title;
    const accepted = window.confirm(text);
    if (accepted) {
      Promise.resolve(onConfirm()).catch(() => {});
    } else if (onCancel) {
      onCancel();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel", onPress: onCancel },
    {
      text: okLabel,
      style: destructive ? "destructive" : "default",
      onPress: () => {
        Promise.resolve(onConfirm()).catch(() => {});
      },
    },
  ]);
}

/** Show an informational message. */
export function notify(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const text = message ? `${title}\n\n${message}` : title;
    window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

/** Prompt for a single line of text. Returns the text or null if cancelled. */
export function prompt(
  title: string,
  defaultValue = "",
  message?: string,
): string | null {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const text = message ? `${title}\n\n${message}` : title;
    return window.prompt(text, defaultValue);
  }
  // On native, the caller should use Alert.prompt (iOS) or a custom modal.
  // This helper just returns null to keep callers explicit.
  return null;
}
