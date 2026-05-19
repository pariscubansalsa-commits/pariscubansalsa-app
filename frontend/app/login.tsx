import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING } from "../src/theme";
import { Logo } from "../src/Logo";
import { useAuth } from "../src/auth";
import { api } from "../src/api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function detectStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    // iOS Safari uses navigator.standalone, Android/desktop use display-mode media query
    const iosStandalone = (window.navigator as any).standalone === true;
    const mqStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    return Boolean(iosStandalone || mqStandalone);
  } catch {
    return false;
  }
}

export default function Login() {
  const router = useRouter();
  const { user, loading, logout, setSession } = useAuth();
  const [standalone, setStandalone] = useState(false);

  // Email/password form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const isStandalone = detectStandalone();
    setStandalone(isStandalone);
    // Auto-expand the password form in PWA standalone mode (where Google OAuth
    // redirect can fail to return to the installed app reliably on iOS).
    if (isStandalone) setShowPwdForm(true);
  }, []);

  const handleGoogleLogin = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const redirectUrl = window.location.origin + "/";
    window.location.href =
      "https://auth.emergentagent.com/?redirect=" + encodeURIComponent(redirectUrl);
  };

  const handlePasswordLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg("Email et mot de passe requis.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.passwordLogin(email.trim(), password);
      await setSession(data);
      // Wipe form
      setPassword("");
      // Redirect by role
      if (data.is_admin || data.role === "admin") {
        router.replace("/admin" as any);
      } else if (data.role === "organisateur") {
        router.replace("/organisateur/dashboard" as any);
      } else if (data.role === "artiste") {
        router.replace("/artiste/dashboard" as any);
      } else {
        router.replace("/");
      }
    } catch (e: any) {
      // Backend returns "Identifiants invalides" for any auth failure
      setErrorMsg(e?.message || "Identifiants invalides");
    } finally {
      setSubmitting(false);
    }
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

  // ---- ANONYMOUS: Google sign-in + email/password fallback ----
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Logo size={18} />
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.bodyAnon}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.overline}>ESPACE MEMBRE</Text>
          <Text style={styles.title}>
            Pour les <Text style={styles.italic}>passionnés.</Text>
          </Text>
          <Text style={styles.sub}>
            {standalone
              ? "Tu es en mode app installée. Connecte-toi avec ton email + mot de passe (le bouton Google ne fonctionne pas toujours depuis une PWA installée sur iPhone)."
              : "Connectez-vous avec Google pour devenir organisateur, réclamer votre fiche artiste, ou accéder au studio admin."}
          </Text>

          {/* Google OAuth — primary on desktop / browser, secondary in PWA */}
          {!standalone && (
            <TouchableOpacity
              testID="google-login-btn"
              style={styles.primary}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={16} color={COLORS.primaryText} />
              <Text style={styles.primaryTxt}>CONTINUER AVEC GOOGLE</Text>
            </TouchableOpacity>
          )}

          {/* Email + password — primary in PWA, secondary on desktop */}
          {!showPwdForm ? (
            <TouchableOpacity
              testID="show-pwd-form-btn"
              onPress={() => setShowPwdForm(true)}
              style={[styles.secondary, { marginTop: 14 }]}
            >
              <Text style={styles.secondaryTxt}>CONNEXION EMAIL / MOT DE PASSE</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.pwdCard} testID="pwd-form">
              {standalone && (
                <View style={styles.standalonePill}>
                  <Ionicons name="phone-portrait-outline" size={12} color={COLORS.primaryText} />
                  <Text style={styles.standalonePillTxt}>MODE APP INSTALLÉE</Text>
                </View>
              )}
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                testID="pwd-email"
                style={styles.input}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setErrorMsg(null);
                }}
                placeholder="ton.email@exemple.com"
                placeholderTextColor={COLORS.secondaryText}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>MOT DE PASSE</Text>
              <TextInput
                testID="pwd-password"
                style={styles.input}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setErrorMsg(null);
                }}
                placeholder="••••••••"
                placeholderTextColor={COLORS.secondaryText}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handlePasswordLogin}
              />
              {errorMsg && (
                <Text style={styles.errorTxt} testID="pwd-error">
                  {errorMsg}
                </Text>
              )}
              <TouchableOpacity
                testID="pwd-submit"
                onPress={handlePasswordLogin}
                disabled={submitting}
                style={[styles.primary, { marginTop: 16 }, submitting && { opacity: 0.6 }]}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <>
                    <Ionicons
                      name="log-in-outline"
                      size={16}
                      color={COLORS.primaryText}
                    />
                    <Text style={styles.primaryTxt}>SE CONNECTER</Text>
                  </>
                )}
              </TouchableOpacity>

              {!standalone && (
                <TouchableOpacity
                  testID="hide-pwd-form-btn"
                  onPress={() => {
                    setShowPwdForm(false);
                    setErrorMsg(null);
                    setPassword("");
                  }}
                  style={{ marginTop: 12, alignItems: "center", paddingVertical: 6 }}
                >
                  <Text style={styles.tertiaryTxt}>← Préférer Google</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            testID="back-to-gallery"
            onPress={() => router.replace("/")}
            style={[styles.secondary, { marginTop: 22 }]}
          >
            <Text style={styles.secondaryTxt}>RETOUR À L&apos;ACCUEIL</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Les visiteurs n&apos;ont pas besoin de compte. Naviguez, taguez et partagez librement.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  bodyAnon: { paddingHorizontal: SPACING.screen, paddingTop: 36, paddingBottom: 80 },
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
  sub: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: COLORS.secondaryText, marginTop: 20, marginBottom: 24 },
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
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  secondary: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  secondaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 1.4, color: COLORS.primaryText },
  tertiary: { marginTop: 10, alignItems: "center", paddingVertical: 12 },
  tertiaryTxt: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.secondaryText },
  note: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText, marginTop: 32, textAlign: "center" },
  // Password form
  pwdCard: {
    marginTop: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
  },
  standalonePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.accentYellow,
    marginBottom: 14,
  },
  standalonePillTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  fieldLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.primaryText,
    backgroundColor: "#fff",
  },
  errorTxt: {
    marginTop: 10,
    color: "#C0392B",
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
  },
});
