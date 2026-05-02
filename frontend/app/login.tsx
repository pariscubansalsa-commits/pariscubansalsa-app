import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING } from "../src/theme";
import { Logo } from "../src/Logo";
import { useAuth } from "../src/auth";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const handleLogin = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const redirectUrl = window.location.origin + "/";
    window.location.href =
      "https://auth.emergentagent.com/?redirect=" + encodeURIComponent(redirectUrl);
  };

  // ---- AUTHENTICATED USER: show role-aware menu ----
  if (!loading && user) {
    const role = user.role || (user.is_admin ? "admin" : "visiteur");
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.primaryText} />
          </TouchableOpacity>
          <Logo size={14} />
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.overline}>BONJOUR {user.name?.split(" ")[0]?.toUpperCase()}</Text>
          <Text style={styles.title}>
            Mon <Text style={styles.italic}>espace.</Text>
          </Text>
          <Text style={styles.sub}>Connecté en tant que {user.email} (rôle : {role}).</Text>

          {user.is_admin || role === "admin" ? (
            <TouchableOpacity
              testID="goto-admin"
              style={styles.cardBtn}
              onPress={() => router.replace("/admin" as any)}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Studio Admin</Text>
                <Text style={styles.cardDesc}>Modération, analytics, calendrier</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
          ) : null}

          {role === "organisateur" ? (
            <TouchableOpacity
              testID="goto-organisateur"
              style={styles.cardBtn}
              onPress={() => router.replace("/organisateur/dashboard" as any)}
            >
              <Ionicons name="calendar-outline" size={20} color={COLORS.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Espace organisateur</Text>
                <Text style={styles.cardDesc}>
                  {user.status === "pending" ? "En attente d'approbation" : "Soumettez vos événements"}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
          ) : role === "visiteur" ? (
            <TouchableOpacity
              testID="goto-organisateur-signup"
              style={styles.cardBtn}
              onPress={() => router.push("/organisateur/signup" as any)}
            >
              <Ionicons name="calendar-outline" size={20} color={COLORS.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Devenir organisateur</Text>
                <Text style={styles.cardDesc}>Soumettez vos soirées, festivals, workshops</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
          ) : null}

          {role === "artiste" ? (
            <TouchableOpacity
              testID="goto-artiste"
              style={styles.cardBtn}
              onPress={() => router.replace("/artiste/dashboard" as any)}
            >
              <Ionicons name="sparkles-outline" size={20} color={COLORS.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Espace artiste</Text>
                <Text style={styles.cardDesc}>
                  {user.status === "pending"
                    ? "En attente d'approbation"
                    : "Modifiez votre profil et vos workshops"}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
          ) : role === "visiteur" ? (
            <TouchableOpacity
              testID="goto-artiste-signup"
              style={styles.cardBtn}
              onPress={() => router.push("/artiste/signup" as any)}
            >
              <Ionicons name="sparkles-outline" size={20} color={COLORS.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Réclamer ma fiche artiste</Text>
                <Text style={styles.cardDesc}>Tu enseignes ? Lie ton compte à ta fiche.</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            testID="back-to-gallery"
            onPress={() => router.replace("/")}
            style={styles.secondary}
          >
            <Text style={styles.secondaryTxt}>RETOUR À L&apos;ACCUEIL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="logout-link"
            style={styles.tertiary}
            onPress={async () => {
              await logout();
              router.replace("/");
            }}
          >
            <Text style={styles.tertiaryTxt}>Se déconnecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- ANONYMOUS: original Google sign-in ----
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Logo size={18} />
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.bodyAnon}>
        <Text style={styles.overline}>ESPACE MEMBRE</Text>
        <Text style={styles.title}>
          Pour les <Text style={styles.italic}>passionnés.</Text>
        </Text>
        <Text style={styles.sub}>
          Connectez-vous avec Google pour devenir organisateur, réclamer votre
          fiche artiste, ou accéder au studio admin. Les visiteurs n&apos;ont pas
          besoin de compte pour naviguer.
        </Text>

        <TouchableOpacity
          testID="google-login-btn"
          style={styles.primary}
          onPress={handleLogin}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={16} color={COLORS.primaryText} />
          <Text style={styles.primaryTxt}>CONTINUER AVEC GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="back-to-gallery"
          onPress={() => router.replace("/")}
          style={styles.secondary}
        >
          <Text style={styles.secondaryTxt}>RETOUR À L&apos;ACCUEIL</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Les visiteurs n&apos;ont pas besoin de compte. Naviguez, taguez et partagez librement.
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
  body: { padding: SPACING.screen, paddingTop: 36, paddingBottom: 80 },
  bodyAnon: { flex: 1, paddingHorizontal: SPACING.screen, paddingTop: 48 },
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
  italic: { fontFamily: FONTS.headingItalic, fontStyle: "italic", color: COLORS.accentYellow },
  sub: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: COLORS.secondaryText, marginTop: 20 },
  cardBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    padding: 16,
  },
  cardTitle: { fontFamily: FONTS.heading, fontSize: 18, color: COLORS.primaryText, letterSpacing: -0.3 },
  cardDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
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
  primaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  secondary: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  tertiary: { marginTop: 10, alignItems: "center", paddingVertical: 12 },
  tertiaryTxt: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.secondaryText },
  note: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText, marginTop: 40, textAlign: "center" },
});
