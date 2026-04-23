import React, { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { api } from "./api";
import { useAuth } from "./auth";
import { COLORS, FONTS } from "./theme";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const { setSession } = useAuth();
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      router.replace("/");
      return;
    }
    const sessionId = decodeURIComponent(match[1]);

    (async () => {
      try {
        const data = await api.authSession(sessionId);
        await setSession(data);
        // Clear hash
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {}
        if (data.is_admin) {
          router.replace("/admin");
        } else {
          router.replace("/");
        }
      } catch (e) {
        console.log("auth callback err", e);
        router.replace("/");
      }
    })();
  }, [setSession, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={COLORS.primaryText} />
      <Text style={styles.txt}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  txt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
});
