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

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { confirmAction, notify } from "../../src/dialog";
import { useAuth } from "../../src/auth";
import { api, TeacherItem } from "../../src/api";
import { Logo } from "../../src/Logo";
import { COLORS, FONTS, SPACING } from "../../src/theme";

export default function ArtisteSignup() {
  const router = useRouter();
  const { user, loading, token, refresh } = useAuth();
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = React.useState<string | null>(null);
  const [requestedName, setRequestedName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<"existing" | "new">("existing");

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  React.useEffect(() => {
    api.listTeachers().then(setTeachers).catch(() => setTeachers([]));
  }, []);

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (user.role === "artiste" && user.status === "active" && user.artist_teacher_id) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <Text style={styles.overline}>DÉJÀ LIÉ</Text>
          <Text style={styles.title}>
            Vous êtes déjà lié à une <Text style={styles.italic}>fiche artiste</Text>.
          </Text>
          <TouchableOpacity
            testID="goto-artiste-dashboard"
            style={styles.primary}
            onPress={() => router.replace("/artiste/dashboard" as any)}
          >
            <Text style={styles.primaryTxt}>OUVRIR MON ESPACE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async () => {
    setError(null);
    if (!token) {
      setError("Session expirée.");
      return;
    }
    if (tab === "existing") {
      if (!selectedTeacherId) {
        setError("Sélectionnez un profil dans la liste.");
        return;
      }
    } else {
      if (!requestedName.trim()) {
        setError("Indiquez le nom à créer.");
        return;
      }
    }
    setSubmitting(true);
    try {
      await api.signupArtiste(token, {
        teacher_id: tab === "existing" ? selectedTeacherId! : undefined,
        requested_name: tab === "new" ? requestedName.trim() : undefined,
        message: message.trim(),
      });
      await refresh();
      notify(
        "Demande envoyée",
        tab === "existing"
          ? "Votre demande sera validée par l'admin."
          : "Votre demande de création a été envoyée à l'admin."
      );
      router.replace("/artiste/dashboard" as any);
    } catch (e: any) {
      setError(e.message || "Erreur");
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
          <Text style={styles.overline}>RÉCLAME TON PROFIL</Text>
          <Text style={styles.title}>
            Tu es <Text style={styles.italic}>artiste ?</Text>
          </Text>
          <Text style={styles.sub}>
            Lie ton compte à ta fiche prof. Une fois la demande validée par l&apos;admin, tu pourras mettre à jour ta bio, tes réseaux et soumettre des workshops.
          </Text>

          <View style={styles.tabs}>
            <TouchableOpacity
              testID="tab-existing"
              style={[styles.tab, tab === "existing" && styles.tabActive]}
              onPress={() => setTab("existing")}
            >
              <Text style={[styles.tabTxt, tab === "existing" && styles.tabTxtActive]}>
                JE SUIS DANS LA LISTE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tab-new"
              style={[styles.tab, tab === "new" && styles.tabActive]}
              onPress={() => setTab("new")}
            >
              <Text style={[styles.tabTxt, tab === "new" && styles.tabTxtActive]}>
                JE NE SUIS PAS LISTÉ
              </Text>
            </TouchableOpacity>
          </View>

          {tab === "existing" ? (
            <>
              <Text style={styles.label}>RECHERCHE</Text>
              <TextInput
                testID="input-search"
                style={styles.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Lorenys…"
                placeholderTextColor="#9ca3af"
              />
              <View style={{ marginTop: 16 }}>
                {filtered.length === 0 ? (
                  <Text style={styles.empty}>Aucun profil trouvé.</Text>
                ) : (
                  filtered.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      testID={`select-teacher-${t.id}`}
                      style={[styles.teacher, selectedTeacherId === t.id && styles.teacherActive]}
                      onPress={() => setSelectedTeacherId(t.id)}
                    >
                      <Text style={styles.teacherName}>{t.name}</Text>
                      {!!t.dance_styles && t.dance_styles.length > 0 && (
                        <Text style={styles.teacherStyles}>{t.dance_styles.join(" • ")}</Text>
                      )}
                      {selectedTeacherId === t.id && (
                        <View style={styles.checkMark}>
                          <Ionicons name="checkmark" size={16} color={COLORS.primaryText} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>NOM ARTISTE / DUO *</Text>
              <TextInput
                testID="input-requested-name"
                style={styles.input}
                value={requestedName}
                onChangeText={setRequestedName}
                placeholder="Ex: Yulier & Daira"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.note}>
                L&apos;admin créera ta fiche et te rattachera. Tu seras notifié dès validation.
              </Text>
            </>
          )}

          <Text style={styles.label}>MESSAGE À L&apos;ÉQUIPE</Text>
          <TextInput
            testID="input-message"
            style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Quelques mots pour aider à la validation…"
            placeholderTextColor="#9ca3af"
            multiline
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="submit-artist-claim"
            style={[styles.primary, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.primaryText} />
            ) : (
              <Text style={styles.primaryTxt}>ENVOYER LA DEMANDE</Text>
            )}
          </TouchableOpacity>
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
  body: { padding: SPACING.screen, paddingBottom: 80 },
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
  italic: { fontFamily: FONTS.headingItalic, fontStyle: "italic", color: COLORS.accentYellow },
  sub: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 22, color: COLORS.secondaryText, marginTop: 14 },
  tabs: { flexDirection: "row", marginTop: 28, borderWidth: 1, borderColor: COLORS.primaryText },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.primaryText },
  tabTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: COLORS.primaryText },
  tabTxtActive: { color: "#fff" },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginTop: 24,
    marginBottom: 8,
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
  teacher: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teacherActive: { borderColor: COLORS.primaryText, backgroundColor: "rgba(245,197,24,0.1)" },
  teacherName: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.primaryText,
    letterSpacing: -0.3,
  },
  teacherStyles: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.secondaryText, marginTop: 2 },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    marginTop: 28,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  error: { color: "#dc2626", fontFamily: FONTS.bodySemi, fontSize: 13, marginTop: 16 },
  empty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText, fontStyle: "italic" },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.secondaryText, marginTop: 10, lineHeight: 18 },
});
