import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING } from "../src/theme";
import { useAuth } from "../src/auth";

export default function Unauthorized() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const role = user?.role || "visiteur";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed" size={28} color={COLORS.primaryText} />
        </View>
        <Text style={styles.overline}>403 — ACCÈS REFUSÉ</Text>
        <Text style={styles.title}>
          Cette zone n&apos;est pas <Text style={styles.italic}>accessible</Text> avec votre compte.
        </Text>
        <Text style={styles.sub}>
          {user
            ? `Connecté en tant que ${user.email} (rôle : ${role}). Si vous pensez qu'il s'agit d'une erreur, contactez l'équipe Paris Cuban Salsa.`
            : "Vous devez être connecté pour accéder à cette page."}
        </Text>

        <View style={{ marginTop: 32 }}>
          <TouchableOpacity
            style={styles.primary}
            testID="go-home"
            onPress={() => router.replace("/")}
          >
            <Text style={styles.primaryTxt}>RETOUR À L&apos;ACCUEIL</Text>
          </TouchableOpacity>
          {user && (
            <TouchableOpacity
              style={styles.secondary}
              testID="logout-link"
              onPress={async () => {
                await logout();
                router.replace("/");
              }}
            >
              <Text style={styles.secondaryTxt}>SE DÉCONNECTER</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  body: {
    flex: 1,
    paddingHorizontal: SPACING.screen,
    paddingTop: 80,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.secondaryText,
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    lineHeight: 42,
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
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.secondaryText,
    marginTop: 18,
  },
  primary: {
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  secondary: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
});
