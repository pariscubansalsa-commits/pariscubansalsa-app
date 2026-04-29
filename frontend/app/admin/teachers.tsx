import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, TeacherItem } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const EMPTY = {
  name: "",
  bio: "",
  photo: null as string | null,
  instagram: "",
  facebook: "",
  dance_styles: [] as string[],
  trusted_teacher: false,
};

const STYLE_OPTIONS = [
  "Salsa cubaine",
  "Afro-cubain",
  "Rumba",
  "Son cubano",
  "Rueda de casino",
  "Reggaeton",
  "Bachata",
];

export default function AdminTeachers() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user?.is_admin) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.listTeachers();
      setTeachers(data);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) load();
  }, [load, user]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  };

  const openEdit = (t: TeacherItem) => {
    setEditing(t);
    setForm({
      name: t.name || "",
      bio: t.bio || "",
      photo: t.photo || null,
      instagram: t.instagram || "",
      facebook: t.facebook || "",
      dance_styles: t.dance_styles || [],
      trusted_teacher: !!t.trusted_teacher,
    });
    setModalOpen(true);
  };

  const toggleStyle = (style: string) => {
    setForm((prev) => {
      const exists = prev.dance_styles.includes(style);
      return {
        ...prev,
        dance_styles: exists
          ? prev.dance_styles.filter((s) => s !== style)
          : [...prev.dance_styles, style],
      };
    });
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const a = res.assets[0];
      setForm({ ...form, photo: `data:${a.mimeType || "image/jpeg"};base64,${a.base64}` });
    }
  };

  const submit = async () => {
    if (!token) return;
    if (!form.name.trim()) {
      if (Platform.OS === "web") window.alert("Le nom est requis");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) await api.updateTeacher(token, editing.id, form);
      else await api.createTeacher(token, form);
      setModalOpen(false);
      await load();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Erreur: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    const ok =
      Platform.OS === "web"
        ? window.confirm("Supprimer ce professeur ?")
        : await new Promise<boolean>((r) =>
            Alert.alert("Supprimer ?", "", [
              { text: "Annuler", onPress: () => r(false) },
              { text: "Supprimer", style: "destructive", onPress: () => r(true) },
            ])
          );
    if (!ok) return;
    await api.deleteTeacher(token, id);
    setTeachers((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="admin-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>PROFESSEURS</Text>
        <View style={{ width: 20 }} />
      </View>

      <TouchableOpacity testID="create-teacher-btn" style={styles.addBtn} onPress={openCreate}>
        <Ionicons name="add" size={18} color={COLORS.primaryText} />
        <Text style={styles.addTxt}>AJOUTER UN PROFESSEUR</Text>
      </TouchableOpacity>

      {busy ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primaryText} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 40 }}>
          {teachers.length === 0 && (
            <Text style={styles.emptyTxt}>Aucun professeur pour l&apos;instant.</Text>
          )}
          {teachers.map((t) => (
            <View key={t.id} style={styles.row}>
              {t.photo ? (
                <Image source={{ uri: t.photo }} style={styles.rowPhoto} />
              ) : (
                <View style={[styles.rowPhoto, styles.rowPhotoFallback]}>
                  <Text style={styles.rowPhotoTxt}>
                    {t.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{t.name}</Text>
                {!!t.bio && (
                  <Text style={styles.rowBio} numberOfLines={2}>
                    {t.bio}
                  </Text>
                )}
              </View>
              <View style={{ gap: 4 }}>
                <TouchableOpacity testID={`edit-teacher-${t.id}`} onPress={() => openEdit(t)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={16} color={COLORS.primaryText} />
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-teacher-${t.id}`} onPress={() => handleDelete(t.id)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <ScrollView contentContainerStyle={styles.sheetWrap}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editing ? "Modifier" : "Nouveau professeur"}
                </Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>PHOTO</Text>
              <TouchableOpacity
                testID="pick-teacher-photo"
                style={styles.photoPicker}
                onPress={pickPhoto}
              >
                {form.photo ? (
                  <Image source={{ uri: form.photo }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Ionicons name="person-outline" size={32} color={COLORS.secondaryText} />
                    <Text style={styles.photoEmptyTxt}>CHOISIR UNE PHOTO</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>NOM</Text>
              <TextInput
                testID="teacher-name"
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
              />
              <Text style={styles.label}>BIO</Text>
              <TextInput
                testID="teacher-bio"
                style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                multiline
                value={form.bio}
                onChangeText={(v) => setForm({ ...form, bio: v })}
              />
              <Text style={styles.label}>INSTAGRAM</Text>
              <TextInput
                testID="teacher-ig"
                style={styles.input}
                value={form.instagram}
                onChangeText={(v) => setForm({ ...form, instagram: v })}
                autoCapitalize="none"
                placeholder="@handle"
                placeholderTextColor={COLORS.secondaryText}
              />
              <Text style={styles.label}>FACEBOOK (URL)</Text>
              <TextInput
                testID="teacher-fb"
                style={styles.input}
                value={form.facebook}
                onChangeText={(v) => setForm({ ...form, facebook: v })}
                autoCapitalize="none"
                placeholder="https://facebook.com/..."
                placeholderTextColor={COLORS.secondaryText}
              />

              <Text style={styles.label}>STYLES DE DANSE</Text>
              <View style={styles.chipRow}>
                {STYLE_OPTIONS.map((s) => {
                  const active = form.dance_styles.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      testID={`style-${s}`}
                      onPress={() => toggleStyle(s)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipTxt, active && styles.chipTxtActive]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                testID="teacher-trusted-toggle"
                style={[styles.trustRow, form.trusted_teacher && styles.trustRowOn]}
                onPress={() =>
                  setForm({ ...form, trusted_teacher: !form.trusted_teacher })
                }
              >
                <View style={styles.trustLeft}>
                  <Ionicons
                    name={form.trusted_teacher ? "shield-checkmark" : "shield-outline"}
                    size={18}
                    color={
                      form.trusted_teacher ? COLORS.primaryText : COLORS.secondaryText
                    }
                  />
                  <View>
                    <Text style={styles.trustTitle}>Prof vérifié</Text>
                    <Text style={styles.trustSub}>
                      Les workshops de ce prof sont publiés sans validation manuelle.
                    </Text>
                  </View>
                </View>
                <View style={[styles.switch, form.trusted_teacher && styles.switchOn]}>
                  <View
                    style={[styles.switchDot, form.trusted_teacher && styles.switchDotOn]}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                testID="submit-teacher"
                style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                onPress={submit}
                disabled={submitting}
              >
                <Text style={styles.primaryBtnTxt}>
                  {submitting ? "ENREGISTREMENT..." : editing ? "METTRE À JOUR" : "CRÉER"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
  topTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    margin: SPACING.screen,
  },
  addTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTxt: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: "center",
    marginTop: 30,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    marginBottom: 10,
  },
  rowPhoto: { width: 56, height: 56, backgroundColor: COLORS.surface },
  rowPhotoFallback: {
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  rowPhotoTxt: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.accentYellow,
  },
  rowName: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.primaryText,
  },
  rowBio: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  iconBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
  },
  backdrop: { flex: 1, backgroundColor: COLORS.overlay },
  sheetWrap: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    padding: SPACING.screen,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.primaryText },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
  },
  photoPicker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    aspectRatio: 1,
    width: 140,
    backgroundColor: COLORS.surface,
  },
  photoEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoEmptyTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: COLORS.secondaryText,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  photoPreview: { width: "100%", height: "100%" },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 40,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: COLORS.primaryText,
    borderColor: COLORS.primaryText,
  },
  chipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: COLORS.primaryText,
  },
  chipTxtActive: { color: COLORS.accentYellow },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  trustRowOn: {
    borderColor: COLORS.accentYellow,
    backgroundColor: "#FFFBEA",
  },
  trustLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flex: 1,
  },
  trustTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.primaryText,
  },
  trustSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
    maxWidth: 220,
  },
  switch: {
    width: 38,
    height: 22,
    borderRadius: 12,
    backgroundColor: "#E4E4E7",
    padding: 2,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: COLORS.accentYellow },
  switchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  switchDotOn: { alignSelf: "flex-end" },
});
