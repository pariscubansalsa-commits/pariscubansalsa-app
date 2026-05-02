import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RoleGuard from "../../src/RoleGuard";
import { useAuth } from "../../src/auth";
import { api, EntryItem, TeacherItem } from "../../src/api";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const STYLES_OPTIONS = [
  "Salsa cubaine",
  "Son",
  "Rumba",
  "Rueda de casino",
  "Afro-cubain",
  "Reggaeton",
];

function Inner() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [profile, setProfile] = React.useState<TeacherItem | null>(null);
  const [workshops, setWorkshops] = React.useState<EntryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Edit form state
  const [bio, setBio] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [facebook, setFacebook] = React.useState("");
  const [danceStyles, setDanceStyles] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      try {
        const p = await api.artisteProfile(token);
        setProfile(p);
        setBio(p.bio || "");
        setInstagram(p.instagram || "");
        setFacebook(p.facebook || "");
        setDanceStyles(p.dance_styles || []);
      } catch (e: any) {
        // If 404 (no link yet), keep profile null
        setProfile(null);
      }
      try {
        const ws = await api.artisteWorkshops(token);
        setWorkshops(ws);
      } catch {
        setWorkshops([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api.artisteUpdateProfile(token, {
        bio,
        instagram,
        facebook,
        dance_styles: danceStyles,
      });
      Alert.alert("Profil mis à jour", "Vos modifications ont été enregistrées.");
      reload();
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteWorkshop = (id: string) => {
    if (!token) return;
    Alert.alert("Supprimer", "Confirmer la suppression de ce workshop ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.artisteDeleteWorkshop(token, id);
            reload();
          } catch (e: any) {
            Alert.alert("Erreur", e.message || "");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const isPending = user?.status === "pending";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity testID="back-home" onPress={() => router.replace("/")}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>ESPACE ARTISTE</Text>
          <TouchableOpacity
            testID="logout-btn"
            onPress={async () => {
              await logout();
              router.replace("/");
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.primaryText} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isPending && (
            <View style={styles.banner}>
              <Ionicons name="time-outline" size={18} color="#92400E" />
              <Text style={styles.bannerTxt}>
                Votre demande est en attente de validation par l&apos;admin. Dès qu&apos;elle est validée, vous pourrez éditer votre profil et soumettre des workshops.
              </Text>
            </View>
          )}

          {!profile ? (
            <View>
              <Text style={styles.overline}>AUCUN PROFIL LIÉ</Text>
              <Text style={styles.title}>
                Réclamez votre <Text style={styles.italic}>fiche artiste</Text>.
              </Text>
              <TouchableOpacity
                testID="goto-claim"
                style={styles.primary}
                onPress={() => router.push("/artiste/signup" as any)}
              >
                <Text style={styles.primaryTxt}>RÉCLAMER MA FICHE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.overline}>{profile.name?.toUpperCase()}</Text>
              <Text style={styles.title}>
                Mon <Text style={styles.italic}>profil.</Text>
              </Text>

              {!!profile.photo && (
                <Image source={{ uri: profile.photo }} style={styles.photo} />
              )}

              <Text style={styles.label}>BIO</Text>
              <TextInput
                testID="input-bio"
                style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]}
                value={bio}
                onChangeText={setBio}
                multiline
                editable={!isPending}
              />

              <Text style={styles.label}>STYLES DE DANSE</Text>
              <View style={styles.chipsRow}>
                {STYLES_OPTIONS.map((s) => {
                  const active = danceStyles.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      testID={`style-${s}`}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        if (isPending) return;
                        setDanceStyles(
                          active ? danceStyles.filter((x) => x !== s) : [...danceStyles, s]
                        );
                      }}
                      disabled={isPending}
                    >
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>INSTAGRAM</Text>
              <TextInput
                testID="input-instagram"
                style={styles.input}
                value={instagram}
                onChangeText={setInstagram}
                placeholder="@handle"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                editable={!isPending}
              />
              <Text style={styles.label}>FACEBOOK</Text>
              <TextInput
                testID="input-facebook"
                style={styles.input}
                value={facebook}
                onChangeText={setFacebook}
                placeholder="URL ou handle"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                editable={!isPending}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                testID="save-profile-btn"
                style={[styles.primary, (saving || isPending) && { opacity: 0.6 }]}
                disabled={saving || isPending}
                onPress={onSave}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <Text style={styles.primaryTxt}>ENREGISTRER</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Mes workshops</Text>
              <TouchableOpacity
                testID="create-workshop-btn"
                style={styles.secondary}
                onPress={() => router.push("/artiste/workshop/new" as any)}
                disabled={isPending}
              >
                <Ionicons name="add" size={18} color={COLORS.primaryText} />
                <Text style={styles.primaryTxt}>SOUMETTRE UN WORKSHOP</Text>
              </TouchableOpacity>

              {workshops.length === 0 ? (
                <Text style={styles.empty}>Aucun workshop pour le moment.</Text>
              ) : (
                workshops.map((w) => (
                  <View key={w.id} style={styles.card} testID={`art-workshop-${w.id}`}>
                    <Text style={styles.cardDate}>{w.date}</Text>
                    <Text style={styles.cardTitle}>{w.title}</Text>
                    <Text style={styles.cardSub}>
                      {w.status === "pending" ? "En attente" : w.status === "rejected" ? "Refusé" : "Validé"}
                    </Text>
                    {w.status === "pending" && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <TouchableOpacity
                          testID={`edit-ws-${w.id}`}
                          style={styles.actBtn}
                          onPress={() => router.push(`/artiste/workshop/${w.id}` as any)}
                        >
                          <Ionicons name="create-outline" size={14} color={COLORS.primaryText} />
                          <Text style={styles.actTxt}>MODIFIER</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID={`delete-ws-${w.id}`}
                          style={[styles.actBtn, { borderColor: "#991B1B" }]}
                          onPress={() => onDeleteWorkshop(w.id)}
                        >
                          <Ionicons name="trash-outline" size={14} color="#991B1B" />
                          <Text style={[styles.actTxt, { color: "#991B1B" }]}>SUPPRIMER</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function ArtisteDashboard() {
  return (
    <RoleGuard allow={["artiste"]}>
      <Inner />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topTitle: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5, color: COLORS.primaryText },
  content: { padding: SPACING.screen, paddingBottom: 100 },
  overline: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.8, color: COLORS.secondaryText },
  title: { fontFamily: FONTS.heading, fontSize: 36, lineHeight: 40, color: COLORS.primaryText, marginTop: 6 },
  italic: { fontFamily: FONTS.headingItalic, fontStyle: "italic", color: COLORS.accentYellow },
  banner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 14,
    marginBottom: 22,
  },
  bannerTxt: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: "#92400E", lineHeight: 18 },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginTop: 20,
    backgroundColor: COLORS.surface,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginTop: 22,
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
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.primaryText, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: COLORS.accentYellow },
  chipTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: COLORS.primaryText },
  chipTxtActive: { color: COLORS.primaryText },
  primary: {
    marginTop: 24,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  secondary: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    marginTop: 36,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  card: { borderWidth: 1, borderColor: COLORS.primaryText, padding: 14, marginTop: 12 },
  cardDate: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.secondaryText, letterSpacing: 0.5 },
  cardTitle: { fontFamily: FONTS.heading, fontSize: 18, color: COLORS.primaryText, marginTop: 4 },
  cardSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText, marginTop: 4 },
  actBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: COLORS.primaryText },
  empty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText, marginTop: 14, fontStyle: "italic" },
  error: { color: "#dc2626", fontFamily: FONTS.bodySemi, fontSize: 13, marginTop: 14 },
});
