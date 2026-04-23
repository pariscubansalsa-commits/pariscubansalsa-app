import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING } from "../src/theme";
import { Logo } from "../src/Logo";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const router = useRouter();

  const handleLogin = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const redirectUrl = window.location.origin + "/";
    window.location.href =
      "https://auth.emergentagent.com/?redirect=" + encodeURIComponent(redirectUrl);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Logo size={18} />
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.overline}>ADMIN ACCESS</Text>
        <Text style={styles.title}>
          For the <Text style={styles.italic}>keepers</Text> of the archive.
        </Text>
        <Text style={styles.sub}>
          Only event organizers can upload photos and manage galleries. Sign in
          with your Google account to continue.
        </Text>

        <TouchableOpacity
          testID="google-login-btn"
          style={styles.primary}
          onPress={handleLogin}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={16} color={COLORS.primaryText} />
          <Text style={styles.primaryTxt}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="back-to-gallery"
          onPress={() => router.replace("/")}
          style={styles.secondary}
        >
          <Text style={styles.secondaryTxt}>BACK TO GALLERY</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Visitors don&apos;t need an account. Just browse, tag, and share.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  body: { flex: 1, paddingHorizontal: SPACING.screen, paddingTop: 48 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.secondaryText,
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: COLORS.primaryText,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.secondaryText,
    marginTop: 20,
  },
  primary: {
    marginTop: 40,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  secondary: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  note: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 40,
    textAlign: "center",
  },
});
