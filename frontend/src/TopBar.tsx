import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "./auth";
import { COLORS, FONTS, SPACING } from "./theme";
import { openExternal } from "./links";

export default function TopBar() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => router.replace("/")}
          style={styles.logoWrap}
          activeOpacity={0.8}
        >
          <View style={styles.logoMark}>
            <Image
          source={require("../assets/images/pcs-logo.png")}
          style={styles.logoImg}
          resizeMode="cover"
        />
          </View>
          <View style={styles.logoText}>
            <Text style={styles.logoRow1}>Paris Cuban</Text>
            <Text style={styles.logoRow2}>Salsa</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.right}>
          {user?.is_admin ? (
            <TouchableOpacity
              testID="admin-dashboard-link"
              onPress={() => router.push("/admin")}
              style={styles.iconBtn}
            >
              <Ionicons name="settings-outline" size={16} color={COLORS.accentYellow} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="admin-login-link"
              onPress={() => router.push("/login")}
              style={styles.iconBtn}
            >
              <Ionicons name="lock-closed-outline" size={15} color={COLORS.accentYellow} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            testID="instagram-link"
            onPress={() => openExternal("https://www.instagram.com/pariscubansalsa/")}
            style={styles.instaBtn}
          >
            <Ionicons name="logo-instagram" size={14} color={COLORS.accentYellow} />
            <Text style={styles.instaTxt}>@pariscubansalsa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#111" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    height: 56,
  },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%" },
  logoText: { justifyContent: "center" },
  logoRow1: {
    fontFamily: FONTS.heading,
    fontSize: 13,
    color: "#fff",
    lineHeight: 14,
  },
  logoRow2: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: COLORS.accentYellow,
    lineHeight: 14,
  },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(245,197,24,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,197,24,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  instaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(245,197,24,0.3)",
  },
  instaTxt: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.accentYellow,
    letterSpacing: 0.3,
  },
});
