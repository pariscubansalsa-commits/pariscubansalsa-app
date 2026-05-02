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
import * as ImagePicker from "expo-image-picker";
import { api, EntryItem, EntryType } from "../../src/api";
import EntryCard from "../../src/EntryCard";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { Image } from "react-native";

const TYPES: { key: EntryType | "pending" | "rejected" | "history"; label: string }[] = [
  { key: "pending", label: "À valider" },
  { key: "agenda", label: "Agenda" },
  { key: "soiree", label: "Soirées" },
  { key: "workshop", label: "Workshops" },
  { key: "festival", label: "Festivals" },
  { key: "history", label: "Historique" },
  { key: "rejected", label: "Archivés" },
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
  cover_photo: null as string | null,
  featured: false,
};

export default function AdminEntries() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<EntryType | "pending" | "rejected" | "history">("pending");
  const [items, setItems] = useState<EntryItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EntryItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [pendingTypeMap, setPendingTypeMap] = useState<Record<string, EntryType>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user?.is_admin) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      if (filter === "pending") {
        const data = token ? await api.listPendingEntries(token) : [];
        setItems(data);
      } else if (filter === "rejected") {
        const data = token ? await api.listRejectedEntries(token) : [];
        setItems(data);
      } else if (filter === "history") {
        const data = token ? await api.listPastEntries(token) : [];
        setItems(data);
      } else {
        const data = await api.listEntries(filter);
        setItems(data);
      }
    } finally {
      setBusy(false);
    }
  }, [filter, token]);

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
      cover_photo: e.cover_photo || null,
      featured: !!e.featured,
    });
    setModalOpen(true);
  };

  const pickCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const a = res.assets[0];
      setForm({
        ...form,
        cover_photo: `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`,
      });
    }
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
      const body = { type: filter === "pending" ? "soiree" : filter, ...form };
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

  const handleApprove = async (id: string, type?: EntryType) => {
    if (!token) return;
    const targetType = type || pendingTypeMap[id];
    await api.approveEntry(token, id, targetType);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const handleApproveFeature = async (id: string) => {
    if (!token) return;
    const targetType = pendingTypeMap[id];
    await api.approveEntry(token, id, targetType);
    await api.featureEntry(token, id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const handleSyncCalendar = async () => {
    if (!token) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await api.syncCalendar(token);
      setSyncResult(
        `Synchro OK — ${r.created} nouveaux, ${r.updated} mis à jour, ${r.unchanged} inchangés`
      );
      await load();
    } catch (e: any) {
      setSyncResult("Erreur de synchro: " + (e.message || "?"));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleRestore = async (id: string) => {
    if (!token) return;
    await api.approveEntry(token, id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    const ok =
      Platform.OS === "web"
        ? window.confirm("Refuser cette proposition ? Elle sera archivée.")
        : await new Promise<boolean>((r) =>
            Alert.alert("Refuser ?", "Cette proposition sera archivée.", [
              { text: "Annuler", onPress: () => r(false) },
              { text: "Refuser", style: "destructive", onPress: () => r(true) },
            ])
          );
    if (!ok) return;
    await api.rejectEntry(token, id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const handleFeature = async (id: string) => {
    if (!token) return;
    await api.featureEntry(token, id);
    await load();
  };

  const handleUnfeature = async (id: string) => {
    if (!token) return;
    await api.unfeatureEntry(token, id);
    await load();
  };

  const isWorkshop = filter === "workshop";
  const isFestival = filter === "festival";
  const isPending = filter === "pending";
  const isRejected = filter === "rejected";
  const isHistory = filter === "history";

  const handleDuplicate = async (id: string) => {
    if (!token) return;
    try {
      const created = await api.duplicateEntry(token, id);
      setSyncResult(`Copie créée — pense à lui donner une nouvelle date dans À VALIDER (${created.title})`);
      setTimeout(() => setSyncResult(null), 6000);
    } catch (e: any) {
      setSyncResult("Erreur duplication: " + (e.message || "?"));
    }
  };

  const TYPE_OPTIONS: { v: EntryType; l: string }[] = [
    { v: "soiree", l: "Soirée" },
    { v: "workshop", l: "Workshop" },
    { v: "festival", l: "Festival" },
    { v: "agenda", l: "Sortie" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="admin-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>AGENDA & SORTIES</Text>
        <TouchableOpacity
          testID="gcal-sync-btn"
          onPress={handleSyncCalendar}
          disabled={syncing}
          style={syncing && { opacity: 0.6 }}
        >
          <Ionicons
            name={syncing ? "sync" : "refresh"}
            size={18}
            color={COLORS.primaryText}
          />
        </TouchableOpacity>
      </View>

      {syncResult && (
        <View style={styles.syncBanner} testID="sync-result">
          <Ionicons name="information-circle" size={14} color={COLORS.primaryText} />
          <Text style={styles.syncBannerTxt}>{syncResult}</Text>
        </View>
      )}

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

      <TouchableOpacity
        testID="create-entry-btn"
        style={[styles.addBtn, (isPending || isRejected || isHistory) && { display: "none" }]}
        onPress={openCreate}
      >
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
            <Text style={styles.emptyTxt}>
              {isPending
                ? "Aucune proposition en attente. La synchro Google Calendar tourne en fond toutes les 15 min."
                : isRejected
                ? "Aucune entrée archivée."
                : isHistory
                ? "Aucun event passé pour le moment."
                : "Aucune entrée pour ce type."}
            </Text>
          )}
          {items.map((e) => {
            const sourceLabel =
              e.source === "gcal"
                ? "GOOGLE CALENDAR"
                : e.source === "submission"
                ? "SOUMISSION"
                : e.source === "organizer"
                ? "ORGANISATEUR"
                : "MANUEL";
            const selectedType = pendingTypeMap[e.id] || (e.type as EntryType);
            return (
              <View key={e.id} style={{ marginBottom: 14 }}>
                {(isPending || isRejected) && (
                  <View style={styles.pendingMeta}>
                    <Ionicons
                      name={isRejected ? "archive" : "time-outline"}
                      size={12}
                      color={COLORS.primaryText}
                    />
                    <Text style={styles.pendingMetaTxt}>
                      {sourceLabel}
                      {e.submitter_name ? ` · ${e.submitter_name}` : ""}
                      {e.submitter_email ? ` · ${e.submitter_email}` : ""}
                    </Text>
                  </View>
                )}
                <EntryCard
                  entry={e}
                  isAdmin
                  onAdminEdit={isPending || isRejected ? undefined : () => openEdit(e)}
                  onAdminDelete={() => handleDelete(e.id)}
                />
                {isPending ? (
                  <View>
                    <Text style={styles.typeLabel}>RECLASSER EN :</Text>
                    <View style={styles.typeChips}>
                      {TYPE_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.v}
                          testID={`set-type-${e.id}-${opt.v}`}
                          onPress={() =>
                            setPendingTypeMap((p) => ({ ...p, [e.id]: opt.v }))
                          }
                          style={[
                            styles.typeChip,
                            selectedType === opt.v && styles.typeChipOn,
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeChipTxt,
                              selectedType === opt.v && styles.typeChipTxtOn,
                            ]}
                          >
                            {opt.l.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.modActions}>
                      <TouchableOpacity
                        testID={`approve-${e.id}`}
                        style={[styles.modBtn, styles.approveBtn]}
                        onPress={() => handleApprove(e.id, selectedType as EntryType)}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={COLORS.primaryText}
                        />
                        <Text style={styles.approveTxt}>VALIDER</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`feature-pending-${e.id}`}
                        style={[styles.modBtn, styles.featureBtn]}
                        onPress={() => handleApproveFeature(e.id)}
                      >
                        <Ionicons name="star" size={16} color={COLORS.accentYellow} />
                        <Text style={styles.featureTxt}>VALIDER + COUP DE CŒUR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`reject-${e.id}`}
                        style={[styles.modBtn, styles.rejectBtn]}
                        onPress={() => handleReject(e.id)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={COLORS.primaryText}
                        />
                        <Text style={styles.rejectTxt}>REFUSER</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : isRejected ? (
                  <TouchableOpacity
                    testID={`restore-${e.id}`}
                    style={[styles.modBtn, styles.featureBtn]}
                    onPress={() => handleRestore(e.id)}
                  >
                    <Ionicons name="arrow-undo" size={16} color={COLORS.accentYellow} />
                    <Text style={styles.featureTxt}>RESTAURER</Text>
                  </TouchableOpacity>
                ) : isHistory ? (
                  <View style={styles.modActions}>
                    <TouchableOpacity
                      testID={`duplicate-history-${e.id}`}
                      style={[styles.modBtn, styles.approveBtn]}
                      onPress={() => handleDuplicate(e.id)}
                    >
                      <Ionicons name="copy-outline" size={16} color={COLORS.primaryText} />
                      <Text style={styles.approveTxt}>DUPLIQUER POUR REPROGRAMMER</Text>
                    </TouchableOpacity>
                  </View>
                ) : e.status === "featured" ? (
                  <View style={styles.modActions}>
                    <TouchableOpacity
                      testID={`duplicate-${e.id}`}
                      style={[styles.modBtn, styles.unfeatureBtn]}
                      onPress={() => handleDuplicate(e.id)}
                    >
                      <Ionicons name="copy-outline" size={16} color={COLORS.primaryText} />
                      <Text style={styles.featureTxt}>DUPLIQUER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`unfeature-${e.id}`}
                      style={[styles.modBtn, styles.unfeatureBtn]}
                      onPress={() => handleUnfeature(e.id)}
                    >
                      <Ionicons name="star-outline" size={16} color={COLORS.primaryText} />
                      <Text style={styles.featureTxt}>RETIRER COUP DE CŒUR</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.modActions}>
                    <TouchableOpacity
                      testID={`duplicate-${e.id}`}
                      style={[styles.modBtn, styles.unfeatureBtn]}
                      onPress={() => handleDuplicate(e.id)}
                    >
                      <Ionicons name="copy-outline" size={16} color={COLORS.primaryText} />
                      <Text style={styles.featureTxt}>DUPLIQUER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`feature-${e.id}`}
                      style={[styles.modBtn, styles.featureBtn]}
                      onPress={() => handleFeature(e.id)}
                    >
                      <Ionicons name="star" size={16} color={COLORS.accentYellow} />
                      <Text style={styles.featureTxt}>METTRE EN COUP DE CŒUR</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
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

              <Text style={[styles.label, { marginTop: 14 }]}>PHOTO / AFFICHE</Text>
              <TouchableOpacity testID="entry-cover-picker" style={styles.coverPicker} onPress={pickCover}>
                {form.cover_photo ? (
                  <Image source={{ uri: form.cover_photo }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverEmpty}>
                    <Ionicons name="image-outline" size={24} color={COLORS.secondaryText} />
                    <Text style={styles.coverEmptyTxt}>CHOISIR UNE IMAGE</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="entry-featured-toggle"
                style={[styles.featureRow, form.featured && styles.featureRowOn]}
                onPress={() => setForm({ ...form, featured: !form.featured })}
              >
                <View style={styles.featureLeft}>
                  <Ionicons
                    name={form.featured ? "heart" : "heart-outline"}
                    size={18}
                    color={form.featured ? COLORS.primaryText : COLORS.secondaryText}
                  />
                  <View>
                    <Text style={styles.featureTitle}>Coup de cœur</Text>
                    <Text style={styles.featureSub}>
                      Mise en avant dans le carrousel d&apos;accueil (partenaires payants)
                    </Text>
                  </View>
                </View>
                <View style={[styles.switch, form.featured && styles.switchOn]}>
                  <View style={[styles.switchDot, form.featured && styles.switchDotOn]} />
                </View>
              </TouchableOpacity>

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
    borderRadius: 40,
  },
  coverPicker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  coverPreview: { width: "100%", height: "100%" },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  coverEmptyTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: COLORS.secondaryText,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  featureRowOn: {
    borderColor: COLORS.accentYellow,
    backgroundColor: "#FFFBEA",
  },
  featureLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flex: 1,
  },
  featureTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.primaryText,
  },
  featureSub: {
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
  pendingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEA",
    borderWidth: 1,
    borderColor: COLORS.accentYellow,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  pendingMetaTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.primaryText,
  },
  approveBtn: {
    backgroundColor: COLORS.accentYellow,
  },
  approveTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  modActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -8,
  },
  modBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 40,
    flexGrow: 1,
    minWidth: 140,
  },
  featureBtn: {
    backgroundColor: "#1A1A1A",
  },
  featureTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: COLORS.accentYellow,
  },
  unfeatureBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    marginTop: -6,
  },
  rejectBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.primaryText,
  },
  rejectTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  typeLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.secondaryText,
    marginTop: 6,
    marginBottom: 4,
  },
  typeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 40,
    backgroundColor: "#fff",
  },
  typeChipOn: {
    backgroundColor: COLORS.primaryText,
    borderColor: COLORS.primaryText,
  },
  typeChipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  typeChipTxtOn: { color: COLORS.accentYellow },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEA",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentYellow,
    paddingHorizontal: SPACING.screen,
    paddingVertical: 8,
  },
  syncBannerTxt: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.primaryText,
  },
  primaryBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
});
