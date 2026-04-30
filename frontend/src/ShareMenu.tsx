import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { COLORS, FONTS, SPACING } from "./theme";

export type ShareTarget = {
  /** URL to share */
  url: string;
  /** Short title shown by share APIs */
  title?: string;
  /** Optional longer text used in WhatsApp/Twitter */
  text?: string;
};

async function openExternal(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}

/**
 * Try the native share sheet first (mobile + supported browsers).
 * If it's not available (typical desktop), open our custom modal with multiple share targets.
 */
export function useShareMenu() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ShareTarget | null>(null);

  const triggerShare = async (t: ShareTarget) => {
    try {
      // Native or browser share API (best UX)
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        (navigator as any).share
      ) {
        await (navigator as any).share({
          title: t.title,
          text: t.text,
          url: t.url,
        });
        return { used: "native" as const };
      }
      if (Platform.OS !== "web") {
        // Try React Native Share API on native (will be expo-sharing on photos, but for plain text/url we use Linking)
        // Fall back to our modal with extra targets.
      }
    } catch (e) {
      // user cancelled native share — do nothing
      return { used: "cancelled" as const };
    }
    // Fallback: open our menu
    setTarget(t);
    setOpen(true);
    return { used: "menu" as const };
  };

  const close = () => {
    setOpen(false);
    setTarget(null);
  };

  const ShareMenu = () => {
    const [copied, setCopied] = useState(false);
    if (!target) return null;
    const encoded = encodeURIComponent(target.url);
    const text = encodeURIComponent(target.text || target.title || target.url);

    const targets: {
      key: string;
      label: string;
      icon: any;
      color: string;
      onPress: () => void;
    }[] = [
      {
        key: "whatsapp",
        label: "WhatsApp",
        icon: "logo-whatsapp",
        color: "#25D366",
        onPress: () => openExternal(`https://wa.me/?text=${text}%20${encoded}`),
      },
      {
        key: "instagram",
        label: "Instagram",
        icon: "logo-instagram",
        color: "#E1306C",
        onPress: async () => {
          // Instagram doesn't accept a direct share URL; we copy the link and deep-link to the app
          await Clipboard.setStringAsync(target.url);
          setCopied(true);
          openExternal("https://www.instagram.com/");
        },
      },
      {
        key: "facebook",
        label: "Facebook",
        icon: "logo-facebook",
        color: "#1877F2",
        onPress: () =>
          openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`),
      },
      {
        key: "x",
        label: "X (Twitter)",
        icon: "logo-twitter",
        color: "#000",
        onPress: () =>
          openExternal(`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`),
      },
      {
        key: "messenger",
        label: "Messenger",
        icon: "chatbubble-ellipses",
        color: "#0866FF",
        onPress: () =>
          openExternal(`https://www.facebook.com/dialog/send?link=${encoded}&app_id=0`),
      },
      {
        key: "email",
        label: "Email",
        icon: "mail",
        color: "#666",
        onPress: () =>
          openExternal(
            `mailto:?subject=${encodeURIComponent(target.title || "")}&body=${text}%20${encoded}`,
          ),
      },
    ];

    const handleCopy = async () => {
      await Clipboard.setStringAsync(target.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };

    return (
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Partager</Text>
            {!!target.title && (
              <Text style={styles.subtitle} numberOfLines={2}>
                {target.title}
              </Text>
            )}

            <View style={styles.grid}>
              {targets.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  testID={`share-${t.key}`}
                  style={styles.tile}
                  onPress={() => {
                    t.onPress();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: t.color }]}>
                    <Ionicons name={t.icon} size={22} color="#fff" />
                  </View>
                  <Text style={styles.tileTxt}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.linkRow}>
              <Text style={styles.linkTxt} numberOfLines={1}>
                {target.url}
              </Text>
              <TouchableOpacity
                testID="share-copy"
                style={[styles.copyBtn, copied && styles.copyBtnOn]}
                onPress={handleCopy}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={14}
                  color={COLORS.primaryText}
                />
                <Text style={styles.copyTxt}>{copied ? "COPIÉ !" : "COPIER"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={close}>
              <Text style={styles.closeTxt}>FERMER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return { triggerShare, ShareMenu };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.screen,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.primaryText,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 2,
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
    marginBottom: 18,
  },
  tile: { width: "30%", alignItems: "center", gap: 6 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.primaryText,
    letterSpacing: 0.4,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  linkTxt: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 40,
  },
  copyBtnOn: { backgroundColor: "#A8E6A0" },
  copyTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  closeBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
  },
});

export default useShareMenu;
