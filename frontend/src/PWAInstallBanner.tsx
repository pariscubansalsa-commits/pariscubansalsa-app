import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "./theme";

const STORAGE_KEY = "pcs_pwa_banner_dismissed";

/**
 * Install banner shown only on web.
 *  - Android: capture beforeinstallprompt and show a "Installer" button that
 *    triggers the native prompt.
 *  - iOS Safari: show after 3s a guidance toast (browsers do not expose any
 *    install API on iOS, the user must use the Share menu manually).
 *  - Standalone (already installed) or dismissed → render nothing.
 */
export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // Already installed → skip
    if (
      (window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (window.navigator as any).standalone === true
    ) {
      return;
    }

    // Previously dismissed → skip
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {}

    const ua = window.navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIOS && isSafari) {
      // Show the iOS guidance after 3s
      const t = setTimeout(() => {
        setIosMode(true);
        setVisible(true);
      }, 3000);
      return () => clearTimeout(t);
    }

    const onBefore = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", onBefore as any);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore as any);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "1");
      }
    } catch {}
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  if (Platform.OS !== "web" || !visible) return null;

  if (iosMode) {
    return (
      <View
        pointerEvents="box-none"
        style={styles.bannerWrap}
        testID="pwa-banner-ios"
      >
        <View style={styles.banner}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconTxt}>PCS</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>Installer Paris Cuban Salsa</Text>
            <Text style={styles.body}>
              Appuyez sur{" "}
              <Text style={styles.bodyAccent}>Partager</Text>{" "}
              <Ionicons
                name="share-outline"
                size={12}
                color={COLORS.accentYellow}
              />{" "}
              puis{" "}
              <Text style={styles.bodyAccent}>Sur l&apos;écran d&apos;accueil</Text>{" "}
              ↓
            </Text>
          </View>
          <TouchableOpacity onPress={dismiss} testID="pwa-banner-close">
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.bannerWrap} testID="pwa-banner">
      <View style={styles.banner}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconTxt}>PCS</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Installer l&apos;app PCS</Text>
          <Text style={styles.body}>
            Accès direct depuis l&apos;écran d&apos;accueil, plein écran.
          </Text>
        </View>
        <TouchableOpacity
          onPress={install}
          style={styles.installBtn}
          testID="pwa-banner-install"
        >
          <Text style={styles.installTxt}>INSTALLER</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={dismiss} testID="pwa-banner-close">
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: "absolute",
    bottom: 90,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111111",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTxt: {
    fontFamily: FONTS.heading,
    fontSize: 13,
    color: "#111",
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.4,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: "#bbb",
    marginTop: 1,
    lineHeight: 14,
  },
  bodyAccent: {
    color: COLORS.accentYellow,
    fontFamily: FONTS.bodyBold,
  },
  installBtn: {
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 40,
  },
  installTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: "#111",
  },
});
