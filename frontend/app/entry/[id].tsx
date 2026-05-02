import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, EntryItem, EntryType } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { formatDateFR, formatDateRangeFR } from "../../src/EntryCard";
import { useShareMenu } from "../../src/ShareMenu";
import { track } from "../../src/analytics";

async function openLink(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}

function buildMapsUrl(venue?: string, address?: string): string {
  const q = [venue, address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const EMPTY_FORM = {
  type: "soiree" as EntryType,
  title: "",
  date: "",
  end_date: "",
  time: "",
  venue: "",
  address: "",
  description: "",
  instructor: "",
  level: "",
  category: "",
  price: "",
  ticket_link: "",
  cover_photo: null as string | null,
  featured: false,
};

const TYPE_OPTIONS: { v: EntryType; l: string }[] = [
  { v: "soiree", l: "Soirée" },
  { v: "workshop", l: "Workshop" },
  { v: "festival", l: "Festival" },
  { v: "agenda", l: "Sortie" },
];

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const [entry, setEntry] = useState<EntryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { triggerShare, ShareMenu } = useShareMenu();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1800);
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const e = await api.getEntry(id);
      setEntry(e);
      // Track entry view
      track("view_entry", {
        entry_id: e.id,
        extra: {
          title: e.title,
          type: e.type,
          featured: !!e.featured || e.status === "featured",
        },
      });
      if (e.featured || e.status === "featured") {
        track("click_featured", { entry_id: e.id, extra: { title: e.title } });
      }
    } catch (err) {
      console.log("entry detail err", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const shareUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin}/entry/${id}`
      : `https://pcs.photos/entry/${id}`;

  const handleShare = () => {
    if (entry) track("click_share", { entry_id: entry.id, channel: "menu" });
    triggerShare({
      title: entry?.title ?? "Paris Cuban Salsa",
      text: entry?.title
        ? `${entry.title} — Paris Cuban Salsa`
        : "Paris Cuban Salsa",
      url: shareUrl,
    });
  };

  const openEdit = () => {
    if (!entry) return;
    setForm({
      type: (entry.type as EntryType) || "soiree",
      title: entry.title || "",
      date: entry.date || "",
      end_date: entry.end_date || "",
      time: entry.time || "",
      venue: entry.venue || "",
      address: entry.address || "",
      description: entry.description || "",
      instructor: entry.instructor || "",
      level: (entry as any).level || "",
      category: (entry as any).category || "",
      price: (entry as any).price || "",
      ticket_link: entry.ticket_link || "",
      cover_photo: entry.cover_photo || null,
      featured: !!entry.featured,
    });
    setEditOpen(true);
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
      setForm((f) => ({
        ...f,
        cover_photo: `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`,
      }));
    }
  };

  const handleSave = async () => {
    if (!token || !entry) return;
    if (!form.title.trim() || !form.date.trim()) {
      if (Platform.OS === "web") window.alert("Titre et date requis");
      else Alert.alert("Champs manquants", "Titre et date sont requis");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateEntry(token, entry.id, form);
      setEntry(updated);
      setEditOpen(false);
      showToast("EVENT MIS À JOUR");
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Erreur: " + e.message);
      else Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !entry) return;
    const ok =
      Platform.OS === "web"
        ? window.confirm("Supprimer cet event ? Cette action est irréversible.")
        : await new Promise<boolean>((r) =>
            Alert.alert("Supprimer ?", "Action irréversible.", [
              { text: "Annuler", onPress: () => r(false) },
              { text: "Supprimer", style: "destructive", onPress: () => r(true) },
            ])
          );
    if (!ok) return;
    try {
      await api.deleteEntry(token, entry.id);
      showToast("EVENT SUPPRIMÉ");
      setTimeout(() => router.back(), 600);
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Erreur: " + e.message);
    }
  };

  const handleDuplicate = async () => {
    if (!token || !entry) return;
    try {
      const created = await api.duplicateEntry(token, entry.id);
      showToast("COPIE CRÉÉE — DATE À DÉFINIR");
      setTimeout(() => router.replace(`/entry/${created.id}` as any), 700);
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Erreur: " + e.message);
    }
  };

  const handleToggleFeature = async () => {
    if (!token || !entry) return;
    try {
      const isFeatured = entry.status === "featured" || !!entry.featured;
      const updated = isFeatured
        ? await api.unfeatureEntry(token, entry.id)
        : await api.featureEntry(token, entry.id);
      setEntry(updated);
      showToast(isFeatured ? "RETIRÉ DES COUPS DE CŒUR" : "AJOUTÉ AUX COUPS DE CŒUR");
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Erreur: " + e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primaryText} />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.err}>Événement introuvable.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>RETOUR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFestival = entry.type === "festival";
  const { day, month, weekday } = formatDateFR(entry.date);
  const range = isFestival ? formatDateRangeFR(entry.date, entry.end_date) : "";
  const isAdmin = !!user?.is_admin && !!entry.id;
  const isFeatured = entry.status === "featured" || !!entry.featured;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>DÉTAIL</Text>
        <TouchableOpacity testID="share-btn" onPress={handleShare} style={styles.topBtn}>
          <Ionicons name="share-outline" size={18} color={COLORS.primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {entry.cover_photo && (
          <Image source={{ uri: entry.cover_photo }} style={styles.cover} />
        )}

        <View style={styles.header}>
          {!isFestival ? (
            <View style={styles.dateBlock}>
              <Text style={styles.weekday}>{weekday}</Text>
              <Text style={styles.day}>{day}</Text>
              <Text style={styles.month}>{month.toUpperCase()}</Text>
            </View>
          ) : (
            <View style={styles.festBadge}>
              <Text style={styles.festBadgeTxt}>{range.toUpperCase()}</Text>
            </View>
          )}
          {entry.featured && (
            <View style={styles.partnerTag}>
              <Ionicons name="heart" size={12} color={COLORS.primaryText} />
              <Text style={styles.partnerTxt}>PARTENAIRE</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {entry.type === "workshop" && !!entry.instructor && (
            <Text style={styles.overline}>
              AVEC {entry.instructor.toUpperCase()}
            </Text>
          )}
          {entry.type === "soiree" && (
            <Text style={styles.overline}>SOIRÉE MENSUELLE</Text>
          )}

          <Text style={styles.title}>{entry.title}</Text>

          <View style={styles.metaGroup}>
            {!!entry.time && (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.primaryText} />
                <Text style={styles.metaTxt}>{entry.time}</Text>
              </View>
            )}
            {!!entry.venue && (
              <TouchableOpacity
                testID="open-maps-venue"
                style={styles.metaRow}
                onPress={() => {
                  track("click_address", { entry_id: entry.id });
                  openLink(buildMapsUrl(entry.venue, entry.address));
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="business-outline" size={16} color={COLORS.primaryText} />
                <Text style={[styles.metaTxt, styles.metaLink]}>{entry.venue}</Text>
                <Ionicons name="open-outline" size={14} color={COLORS.secondaryText} />
              </TouchableOpacity>
            )}
            {!!entry.address && (
              <TouchableOpacity
                testID="open-maps-address"
                style={styles.metaRow}
                onPress={() => {
                  track("click_address", { entry_id: entry.id });
                  openLink(buildMapsUrl(entry.venue, entry.address));
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={16} color={COLORS.primaryText} />
                <Text style={[styles.metaTxt, styles.metaLink]}>{entry.address}</Text>
                <Ionicons name="open-outline" size={14} color={COLORS.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {!!entry.description && (
            <Text style={styles.desc}>{entry.description}</Text>
          )}

          {!!entry.ticket_link && (
            <TouchableOpacity
              testID="detail-ticket"
              style={styles.ticketBtn}
              onPress={() => openLink(entry.ticket_link!)}
            >
              <Ionicons name="ticket-outline" size={16} color={COLORS.primaryText} />
              <Text style={styles.ticketTxt}>ACHETER LE TICKET</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.primaryText} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="detail-share"
            style={styles.secondaryBtn}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={16} color={COLORS.primaryText} />
            <Text style={styles.secondaryTxt}>PARTAGER CET ÉVÉNEMENT</Text>
          </TouchableOpacity>

          {isAdmin && (
            <View style={styles.adminPanel}>
              <View style={styles.adminPanelHead}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.accentYellow} />
                <Text style={styles.adminPanelTitle}>ESPACE ADMIN</Text>
              </View>
              <View style={styles.adminBtnRow}>
                <TouchableOpacity
                  testID="detail-edit"
                  style={[styles.adminBtn, styles.adminBtnPrimary]}
                  onPress={openEdit}
                >
                  <Ionicons name="create-outline" size={16} color={COLORS.primaryText} />
                  <Text style={styles.adminBtnTxt}>MODIFIER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="detail-feature"
                  style={[
                    styles.adminBtn,
                    isFeatured ? styles.adminBtnNeutral : styles.adminBtnAccent,
                  ]}
                  onPress={handleToggleFeature}
                >
                  <Ionicons
                    name={isFeatured ? "star" : "star-outline"}
                    size={16}
                    color={isFeatured ? COLORS.accentYellow : COLORS.primaryText}
                  />
                  <Text
                    style={[
                      styles.adminBtnTxt,
                      isFeatured && { color: COLORS.accentYellow },
                    ]}
                  >
                    {isFeatured ? "RETIRER COUP DE CŒUR" : "METTRE EN COUP DE CŒUR"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                testID="detail-delete"
                style={[styles.adminBtn, styles.adminBtnDanger]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={16} color="#C0392B" />
                <Text style={[styles.adminBtnTxt, { color: "#C0392B" }]}>
                  SUPPRIMER L&apos;EVENT
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="detail-duplicate"
                style={[styles.adminBtn, styles.adminBtnNeutral]}
                onPress={handleDuplicate}
              >
                <Ionicons name="copy-outline" size={16} color={COLORS.accentYellow} />
                <Text style={[styles.adminBtnTxt, { color: COLORS.accentYellow }]}>
                  DUPLIQUER POUR REPROGRAMMER
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <ShareMenu />

      {/* Edit modal */}
      <Modal
        visible={editOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.editBackdrop}
        >
          <ScrollView
            contentContainerStyle={styles.editSheetWrap}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.editSheet}>
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Modifier l&apos;event</Text>
                <TouchableOpacity onPress={() => setEditOpen(false)}>
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fLabel}>TYPE</Text>
              <View style={styles.chipRow}>
                {TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.v}
                    onPress={() => setForm({ ...form, type: opt.v })}
                    style={[styles.chip, form.type === opt.v && styles.chipOn]}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        form.type === opt.v && styles.chipTxtOn,
                      ]}
                    >
                      {opt.l.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.coverSlot}
                onPress={pickCover}
                testID="edit-cover-pick"
              >
                {form.cover_photo ? (
                  <Image source={{ uri: form.cover_photo }} style={styles.coverImg} />
                ) : (
                  <View style={styles.coverEmpty}>
                    <Ionicons name="image-outline" size={28} color={COLORS.secondaryText} />
                    <Text style={styles.coverEmptyTxt}>AJOUTER UNE COUVERTURE</Text>
                  </View>
                )}
                <View style={styles.coverEditOverlay}>
                  <Ionicons name="camera" size={14} color={COLORS.primaryText} />
                  <Text style={styles.coverEditTxt}>
                    {form.cover_photo ? "REMPLACER" : "CHOISIR"}
                  </Text>
                </View>
              </TouchableOpacity>

              <Field
                label="TITRE *"
                value={form.title}
                onChange={(v) => setForm({ ...form, title: v })}
                testID="edit-title"
              />
              <Field
                label="DATE (AAAA-MM-JJ) *"
                value={form.date}
                onChange={(v) => setForm({ ...form, date: v })}
                placeholder="2026-06-14"
                autoCapitalize="none"
                testID="edit-date"
              />
              {form.type === "festival" && (
                <Field
                  label="DATE FIN (festival)"
                  value={form.end_date}
                  onChange={(v) => setForm({ ...form, end_date: v })}
                  placeholder="2026-06-16"
                  autoCapitalize="none"
                  testID="edit-end-date"
                />
              )}
              <Field
                label="HORAIRE"
                value={form.time}
                onChange={(v) => setForm({ ...form, time: v })}
                placeholder="20:30 - 02:00"
                testID="edit-time"
              />
              <Field
                label="LIEU"
                value={form.venue}
                onChange={(v) => setForm({ ...form, venue: v })}
                testID="edit-venue"
              />
              <Field
                label="ADRESSE"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                testID="edit-address"
              />
              {form.type === "workshop" && (
                <Field
                  label="PROFESSEUR / INTERVENANT"
                  value={form.instructor}
                  onChange={(v) => setForm({ ...form, instructor: v })}
                  testID="edit-instructor"
                />
              )}
              <Field
                label="DESCRIPTION"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                multiline
                testID="edit-desc"
              />
              <Field
                label="LIEN BILLETTERIE"
                value={form.ticket_link}
                onChange={(v) => setForm({ ...form, ticket_link: v })}
                placeholder="https://www.helloasso.com/..."
                autoCapitalize="none"
                testID="edit-ticket"
              />

              <TouchableOpacity
                testID="edit-feature-toggle"
                style={[styles.featuredRow, form.featured && styles.featuredRowOn]}
                onPress={() => setForm({ ...form, featured: !form.featured })}
              >
                <View style={styles.featuredLeft}>
                  <Ionicons
                    name={form.featured ? "heart" : "heart-outline"}
                    size={18}
                    color={form.featured ? COLORS.primaryText : COLORS.secondaryText}
                  />
                  <View>
                    <Text style={styles.featuredTitle}>Coup de cœur / Partenaire</Text>
                    <Text style={styles.featuredSub}>
                      Met cet event en avant dans le carrousel d&apos;accueil.
                    </Text>
                  </View>
                </View>
                <View style={[styles.switch, form.featured && styles.switchOn]}>
                  <View
                    style={[styles.switchDot, form.featured && styles.switchDotOn]}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                testID="edit-save"
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveTxt}>
                  {saving ? "ENREGISTREMENT..." : "ENREGISTRER LES MODIFICATIONS"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {toastMsg && (
        <View style={styles.toast} testID="toast">
          <Text style={styles.toastTxt}>{toastMsg}</Text>
        </View>
      )}
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
      <Text style={styles.fLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }]}
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
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  err: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  backLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBtn: { padding: 4 },
  topTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
  },
  cover: { width: "100%", aspectRatio: 16 / 10, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingTop: 20,
  },
  dateBlock: { alignItems: "center", width: 72 },
  weekday: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: COLORS.secondaryText,
  },
  day: {
    fontFamily: FONTS.heading,
    fontSize: 48,
    lineHeight: 52,
    color: COLORS.primaryText,
    marginTop: 4,
  },
  month: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  festBadge: {
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 40,
  },
  festBadgeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: COLORS.primaryText,
  },
  partnerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 40,
  },
  partnerTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  body: { padding: SPACING.screen, paddingTop: 18 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: COLORS.primaryText,
  },
  metaGroup: { marginTop: 18, gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaTxt: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.primaryText, flex: 1 },
  metaLink: { textDecorationLine: "underline" },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.secondaryText,
    marginTop: 20,
  },
  ticketBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 16,
    borderRadius: 40,
  },
  ticketTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    borderRadius: 40,
  },
  secondaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  adminPanel: {
    marginTop: 26,
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 14,
  },
  adminPanelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  adminPanelTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.accentYellow,
  },
  adminBtnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 40,
    flexGrow: 1,
    minWidth: 130,
  },
  adminBtnPrimary: { backgroundColor: COLORS.accentYellow },
  adminBtnAccent: { backgroundColor: "#fff" },
  adminBtnNeutral: { backgroundColor: "#222", borderWidth: 1, borderColor: COLORS.accentYellow },
  adminBtnDanger: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C0392B",
    marginTop: 4,
  },
  adminBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  // Edit modal
  editBackdrop: { flex: 1, backgroundColor: COLORS.overlay },
  editSheetWrap: { flexGrow: 1, justifyContent: "flex-end" },
  editSheet: {
    backgroundColor: "#fff",
    padding: SPACING.screen,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  editTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.primaryText },
  fLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: COLORS.primaryText,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
    borderRadius: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 40,
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: COLORS.primaryText, borderColor: COLORS.primaryText },
  chipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: COLORS.primaryText,
  },
  chipTxtOn: { color: COLORS.accentYellow },
  coverSlot: {
    marginTop: 14,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },
  coverImg: { width: "100%", height: "100%" },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverEmptyTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
  },
  coverEditOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 40,
  },
  coverEditTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  featuredRow: {
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
  featuredRowOn: {
    borderColor: COLORS.accentYellow,
    backgroundColor: "#FFFBEA",
  },
  featuredLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flex: 1,
  },
  featuredTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.primaryText,
  },
  featuredSub: {
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
  saveBtn: {
    marginTop: 22,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 40,
  },
  saveTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: COLORS.primaryText,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 40,
  },
  toastTxt: {
    color: COLORS.accentYellow,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
