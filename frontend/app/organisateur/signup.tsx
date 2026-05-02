import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { Logo } from "../../src/Logo";
import { COLORS, FONTS, SPACING } from "../../src/theme";

export default function OrganisateurSignup() {
  const router = useRouter();
  const { user, loading, token, refresh } = useAuth();
  const [structureName, setStructureName] = React.useState("");
  const [motivation, setMotivation] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  // Already an organizer? send to dashboard
  if (user.role === "organisateur") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <Text style={styles.overline}>DÉJÀ INSCRIT</Text>
          <Text style={styles.title}>
            Vous êtes déjà <Text style={styles.italic}>organisateur</Text>.
          </Text>
          <TouchableOpacity
            testID="goto-dashboard"
            style={styles.primary}
            onPress={() => router.replace("/organisateur/dashboard" as any)}
          >
            <Text style={styles.primaryTxt}>OUVRIR MON ESPACE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onSubmit = async () => {
    setError(null);
    if (!structureName.trim()) {
      setError("Le nom de votre structure est requis.");
      return;
    }
    if (!token) {
      setError("Session expirée, reconnectez-vous.");
      return;
    }
    setSubmitting(true);
    try {
      await api.signupOrganisateur(token, {
        structure_name: structureName.trim(),
        motivation: motivation.trim(),
        phone: phone.trim(),
        website: website.trim(),
      });
      await refresh();
      Alert.alert(
        "Compte créé",
        "Votre demande est en attente d'approbation. Vous pouvez déjà soumettre des événements."
      );
      router.replace("/organisateur/dashboard" as any);
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.primaryText} />
          </TouchableOpacity>
          <Logo size={14} />
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.overline}>ESPACE ORGANISATEUR</Text>
          <Text style={styles.title}>
            Devenir <Text style={styles.italic}>organisateur</Text>.
          </Text>
          <Text style={styles.sub}>
            Soumettez vos soirées, festivals et workshops directement depuis votre espace. Toutes les soumissions passent par la modération de l&apos;équipe Paris Cuban Salsa.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>NOM DE LA STRUCTURE *</Text>
            <TextInput
              testID="input-structure"
              style={styles.input}
              value={structureName}
              onChangeText={setStructureName}
              placeholder="Ex: Casa de la Salsa"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>TÉLÉPHONE</Text>
            <TextInput
              testID="input-phone"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+33…"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>SITE / RÉSEAUX</Text>
            <TextInput
              testID="input-website"
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://… ou @instagram"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>MOTIVATION</Text>
            <TextInput
              testID="input-motivation"
              style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]}
              value={motivation}
              onChangeText={setMotivation}
              placeholder="Présentez votre projet, le type d'événements que vous organisez…"
              placeholderTextColor="#9ca3af"
              multiline
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="submit-organizer-signup"
            style={[styles.primary, submitting && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.primaryText} />
            ) : (
              <Text style={styles.primaryTxt}>CRÉER MON COMPTE ORGANISATEUR</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.note}>
            Votre compte sera placé en attente d&apos;approbation. Vous pourrez quand
            même soumettre des événements (mais ils ne seront validés qu&apos;une
            fois votre compte approuvé).
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
  body: { padding: SPACING.screen, paddingTop: 28, paddingBottom: 60 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.secondaryText,
    marginBottom: 10,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
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
    marginTop: 14,
  },
  field: { marginTop: 24 },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
  },
  primary: {
    marginTop: 28,
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
  error: {
    color: "#dc2626",
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    marginTop: 18,
  },
  note: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 16,
    textAlign: "center",
    lineHeight: 18,
  },
});
