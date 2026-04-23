import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem, EntryType } from "../../src/api";
import EntryCard from "../../src/EntryCard";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const TYPES: { key: EntryType; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "soiree", label: "Soirées" },
  { key: "workshop", label: "Workshops" },
  { key: "festival", label: "Festivals" },
];

const EMPTY = {
  title: "",
  date: "",
  end_date: "",
  time: "",
  venue: "",
  address: "",
  description: "",
  instructor: "",
  ticket_link: "",
};

export default function AdminEntries() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<EntryType>("agenda");
  const [items, setItems] = useState<EntryItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EntryItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user?.is_admin) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.listEntries(filter);
      setItems(data);
    } finally {
      setBusy(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user?.is_admin) load();
  }, [load, user]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  };

  const openEdit = (e: EntryItem) => {
    setEditing(e);
    setForm({
      title: e.title || "",
      date: e.date || "",
      end_date: e.end_date || "",
      time: e.time || "",
      venue: e.venue || "",
      address: e.address || "",
      description: e.description || "",
      instructor: e.instructor || "",
      ticket_link: e.ticket_link || "",
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    if (!form.title.trim() || !form.date.trim()) {
      if (Platform.OS === "web") window.alert("Titre et date requis");
      else Alert.alert("Champs manquants", "Titre et date sont requis");
      return;
    }
    setSubmitting(true);
    try {
      const body = { type: filter, ...form };
      if (editing) await api.updateEntry(token, editing.id, body);
      else await api.createEntry(token, body);
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
        ? window.confirm("Supprimer cette entrée ?")
        : await new Promise<boolean>((r) =>
            Alert.alert("Supprimer ?", "", [
              { text: "Annuler", onPress: () => r(false) },
              { text: "Supprimer", style: "destructive", onPress: () => r(true) },
            ])
          );
    if (!ok) return;
    await api.deleteEntry(token, id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const isWorkshop = filter === "workshop";
  const isFestival = filter === "festival";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="admin-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>AGENDA & SORTIES</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            testID={`filter-${t.key}`}
            style={[styles.tab, filter === t.key && styles.tabActive]}
            onPress={() => setFilter(t.key)}
          >
            <Text
              style={[styles.tabTxt, filter === t.key && styles.tabTxtActive]}
            >
              {t.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity testID="create-entry-btn" style={styles.addBtn} onPress={openCreate}>
        <Ionicons name="add" size={18} color={COLORS.primaryText} />
        <Text style={styles.addTxt}>AJOUTER UNE ENTRÉE</Text>
      </TouchableOpacity>

      {busy ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primaryText} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length === 0 && (
            <Text style={styles.emptyTxt}>Aucune entrée pour ce type.</Text>
          )}
          {items.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              isAdmin
              onAdminEdit={() => openEdit(e)}
              onAdminDelete={() => handleDelete(e.id)}
            />
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
                  {editing ? "Modifier l'entrée" : "Nouvelle entrée"}
                </Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              <Field label="TITRE" testID="entry-title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <Field label="DATE (AAAA-MM-JJ)" testID="entry-date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} autoCapitalize="none" />
              {isFestival && (
                <Field label="DATE DE FIN (AAAA-MM-JJ)" testID="entry-end-date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} autoCapitalize="none" />
              )}
              <Field label="HORAIRE" testID="entry-time" value={form.time} onChange={(v) => setForm({ ...form, time: v })} placeholder="20:30" />
              <Field label="LIEU" testID="entry-venue" value={form.venue} onChange={(v) => setForm({ ...form, venue: v })} placeholder="Le Cabaret Sauvage" />
              <Field label="ADRESSE" testID="entry-address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Parc de la Villette, Paris" />
              {isWorkshop && (
                <Field label="PROFESSEUR" testID="entry-instructor" value={form.instructor} onChange={(v) => setForm({ ...form, instructor: v })} />
              )}
              <Field label="DESCRIPTION" testID="entry-description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline />
              <Field label="LIEN TICKET (URL)" testID="entry-ticket" value={form.ticket_link} onChange={(v) => setForm({ ...form, ticket_link: v })} placeholder="https://www.helloasso.com/..." autoCapitalize="none" />

              <TouchableOpacity
                testID="submit-entry"
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

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  testID,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  testID?: string;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, multiline && { height: 90, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={COLORS.secondaryText}
        autoCapitalize={autoCapitalize}
      />
    </View>
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
  tabs: { paddingHorizontal: SPACING.screen, paddingVertical: 14, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  tabActive: { backgroundColor: COLORS.primaryText, borderColor: COLORS.primaryText },
  tabTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  tabTxtActive: { color: COLORS.accentYellow },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    marginHorizontal: SPACING.screen,
    marginBottom: 16,
  },
  addTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: SPACING.screen, paddingBottom: 40 },
  emptyTxt: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: "center",
    marginTop: 30,
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
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
  },
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
});
