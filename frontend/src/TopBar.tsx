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
import { Logo } from "./Logo";
import { useAuth } from "./auth";
import { COLORS, FONTS, SPACING } from "./theme";

export default function TopBar({ subtitle }: { subtitle?: string }) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        <Logo size={14} />
        <View style={styles.right}>
          {user?.is_admin ? (
            <TouchableOpacity
              testID="admin-dashboard-link"
              onPress={() => router.push("/admin")}
              style={styles.btn}
            >
              <Ionicons name="settings-outline" size={14} color={COLORS.primaryText} />
              <Text style={styles.btnTxt}>ADMIN</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="admin-login-link"
              onPress={() => router.push("/login")}
              style={styles.loginBtn}
            >
              <Text style={styles.btnTxt}>CONNEXION</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {subtitle ? (
        <View style={styles.subRow}>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
  },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  loginBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primaryText,
  },
  btnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  subRow: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 10,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
  },
});
