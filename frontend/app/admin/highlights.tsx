import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Logo } from "../../src/Logo";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

type Highlight = {
  id: string;
  entry_id: string;
  video_url?: string;
  video_file?: string;
  is_sponsored?: boolean;
  cta_text?: string;
  cta_link?: string;
  active?: boolean;
  order?: number;
  entry?: {
    id: string;
    title: string;
    date: string;
    venue?: string;
    type?: string;
  };
};

export default function AdminHighlights() {
  const router = useRouter();
  const { user, loading: authLoading, token } = useAuth();
  const [items, setItems] = useState<Highlight[]>([]);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.is_admin) router.replace("/login");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [hs, es] = await Promise.all([
        api.listHighlights(token, true),
        api.listEntries(),
      ]);
      setItems(hs || []);
      setEntries(es || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    if (!token) return;
    const payload = next.map((h, i) => ({ id: h.id, order: i }));
    await api.reorderHighlights(token, payload);
  };

  const toggleActive = async (h: Highlight) => {
    if (!token) return;
    const updated = await api.updateHighlight(token, h.id, { active: !h.active });
    setItems((arr) => arr.map((x) => (x.id === h.id ? updated : x)));
  };

  const remove = async (h: Highlight) => {
    if (!token) return;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !window.confirm(`Supprimer le highlight pour "${h.entry?.title}" ?`)
    )
      return;
    await api.deleteHighlight(token, h.id);
    setItems((arr) => arr.filter((x) => x.id !== h.id));
  };

  const startEdit = (h: Highlight) => {
    setEditingId(h.id);
    setShowForm(true);
  };

  const editing = useMemo(
    () => items.find((h) => h.id === editingId) || null,
    [items, editingId]
  );

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primaryText} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="back-admin">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Logo size={14} />
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>GÉRER LES HIGHLIGHTS</Text>
        <Text style={styles.title}>
          Reels{" "}
          <Text style={styles.italic}>en home.</Text>
        </Text>
        <Text style={styles.sub}>
          {items.length} highlight{items.length > 1 ? "s" : ""}. Drag-and-drop
          non disponible — utilisez les flèches pour réordonner. Les inactifs
          ne sont jamais affichés en home.
        </Text>

        <TouchableOpacity
          style={styles.addBtn}
          testID="hl-add"
          onPress={() => {
            setEditingId(null);
            setShowForm(true);
          }}
        >
          <Ionicons name="add" size={18} color={COLORS.primaryText} />
          <Text style={styles.addBtnTxt}>AJOUTER UN HIGHLIGHT</Text>
        </TouchableOpacity>

        {items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Aucun highlight pour le moment.</Text>
          </View>
        )}

        {items.map((h, idx) => (
          <View key={h.id} style={styles.row} testID={`hl-row-${h.id}`}>
            <View style={styles.rowOrder}>
              <TouchableOpacity onPress={() => move(idx, -1)} disabled={idx === 0}>
                <Ionicons
                  name="chevron-up"
                  size={16}
                  color={idx === 0 ? "#BBB" : COLORS.primaryText}
                />
              </TouchableOpacity>
              <Text style={styles.rowOrderTxt}>{idx + 1}</Text>
              <TouchableOpacity
                onPress={() => move(idx, 1)}
                disabled={idx === items.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={idx === items.length - 1 ? "#BBB" : COLORS.primaryText}
                />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {h.entry?.title || "Event supprimé"}
                </Text>
                {h.is_sponsored && (
                  <View style={styles.sponsorTag}>
                    <Text style={styles.sponsorTagTxt}>PARTENAIRE</Text>
                  </View>
                )}
                {!h.active && (
                  <View style={styles.inactiveTag}>
                    <Text style={styles.inactiveTagTxt}>INACTIF</Text>
                  </View>
                )}
              </View>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {h.entry?.date} · {h.entry?.venue || "—"} ·{" "}
                {h.video_file ? "vidéo uploadée" : h.video_url || "—"}
              </Text>
            </View>

            <View style={styles.rowActions}>
              <Switch
                value={!!h.active}
                onValueChange={() => toggleActive(h)}
                trackColor={{ false: "#ddd", true: COLORS.accentYellow }}
                thumbColor="#fff"
              />
              <TouchableOpacity onPress={() => startEdit(h)} testID={`hl-edit-${h.id}`}>
                <Ionicons name="pencil" size={16} color={COLORS.primaryText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(h)} testID={`hl-del-${h.id}`}>
                <Ionicons name="trash" size={16} color="#C44" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" transparent>
        <HighlightForm
          editing={editing}
          entries={entries}
          token={token || ""}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSaved={(item: Highlight) => {
            if (editingId) {
              setItems((arr) => arr.map((x) => (x.id === item.id ? item : x)));
            } else {
              setItems((arr) => [...arr, item]);
            }
            setShowForm(false);
            setEditingId(null);
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Add / Edit form (modal)
// ────────────────────────────────────────────────────────────────────────────
function HighlightForm({
  editing,
  entries,
  token,
  onClose,
  onSaved,
}: {
  editing: Highlight | null;
  entries: EntryItem[];
  token: string;
  onClose: () => void;
  onSaved: (h: Highlight) => void;
}) {
  const [entryId, setEntryId] = useState(editing?.entry_id || "");
  const [videoUrl, setVideoUrl] = useState(editing?.video_url || "");
  const [videoFile, setVideoFile] = useState(editing?.video_file || "");
  const [isSponsored, setIsSponsored] = useState(!!editing?.is_sponsored);
  const [active, setActive] = useState(editing?.active !== false);
  const [ctaText, setCtaText] = useState(editing?.cta_text || "ACHETER LE TICKET");
  const [ctaLink, setCtaLink] = useState(editing?.cta_link || "");
  const [entryQuery, setEntryQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const q = entryQuery.trim().toLowerCase();
    if (!q) return entries.slice(0, 50);
    return entries
      .filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q) ||
          e.date?.includes(q)
      )
      .slice(0, 50);
  }, [entries, entryQuery]);

  const selected = entries.find((e) => e.id === entryId);

  const pickFile = async () => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_VIDEO_BYTES) {
        setError(`Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)}MB). Max 20MB.`);
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        setVideoFile(String(reader.result || ""));
        setVideoUrl("");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const save = async () => {
    if (!entryId) {
      setError("Sélectionnez un event lié.");
      return;
    }
    if (!videoFile && !videoUrl) {
      setError("Uploadez une vidéo OU collez un lien Instagram/TikTok/YouTube.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        entry_id: entryId,
        video_url: videoUrl,
        video_file: videoFile,
        is_sponsored: isSponsored,
        active,
        cta_text: ctaText,
        cta_link: ctaLink,
      };
      const result = editing
        ? await api.updateHighlight(token, editing.id, body)
        : await api.createHighlight(token, body);
      onSaved(result);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.modalWrap}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editing ? "Modifier le highlight" : "Nouveau highlight"}
          </Text>
          <TouchableOpacity onPress={onClose} testID="hl-form-close">
            <Ionicons name="close" size={22} color={COLORS.primaryText} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 540 }}>
          <Text style={styles.lbl}>EVENT LIÉ</Text>
          {selected ? (
            <View style={styles.selectedEntry}>
              <Text style={styles.selectedEntryTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <Text style={styles.selectedEntryMeta} numberOfLines={1}>
                {selected.date} · {selected.venue}
              </Text>
              <TouchableOpacity onPress={() => setEntryId("")}>
                <Text style={styles.changeLink}>CHANGER</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                placeholder="Rechercher (titre, lieu, date)…"
                value={entryQuery}
                onChangeText={setEntryQuery}
                style={styles.input}
                testID="hl-entry-search"
              />
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                {filteredEntries.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setEntryId(e.id)}
                    style={styles.entryOption}
                    testID={`hl-entry-${e.id}`}
                  >
                    <Text style={styles.entryOptionTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.entryOptionMeta} numberOfLines={1}>
                      {e.date} · {e.venue || "—"} · {e.type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={styles.lbl}>VIDÉO</Text>
          {videoFile ? (
            <View style={styles.fileChip}>
              <Ionicons name="videocam" size={14} color={COLORS.primaryText} />
              <Text style={styles.fileChipTxt}>Vidéo uploadée</Text>
              <TouchableOpacity onPress={() => setVideoFile("")}>
                <Ionicons name="close-circle" size={16} color="#888" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={pickFile} style={styles.fileBtn}>
              <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primaryText} />
              <Text style={styles.fileBtnTxt}>UPLOADER UN MP4 (≤20MB)</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.lbl, { marginTop: 12 }]}>OU LIEN EXTERNE</Text>
          <TextInput
            placeholder="https://www.instagram.com/reel/… · TikTok · YouTube Short"
            value={videoUrl}
            onChangeText={(t) => {
              setVideoUrl(t);
              if (t) setVideoFile("");
            }}
            style={styles.input}
            testID="hl-video-url"
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLbl}>PARTENAIRE (badge jaune)</Text>
            <Switch
              value={isSponsored}
              onValueChange={setIsSponsored}
              trackColor={{ false: "#ddd", true: COLORS.accentYellow }}
              thumbColor="#fff"
              testID="hl-sponsored"
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLbl}>ACTIF (visible en home)</Text>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: "#ddd", true: COLORS.accentYellow }}
              thumbColor="#fff"
              testID="hl-active"
            />
          </View>

          <Text style={styles.lbl}>TEXTE DU BOUTON CTA</Text>
          <TextInput
            value={ctaText}
            onChangeText={setCtaText}
            style={styles.input}
            placeholder="ACHETER LE TICKET"
          />
          <Text style={styles.lbl}>LIEN CTA (vide = ticket_link de l'event)</Text>
          <TextInput
            value={ctaLink}
            onChangeText={setCtaLink}
            style={styles.input}
            placeholder="https://…"
            autoCapitalize="none"
          />

          {!!error && <Text style={styles.err}>{error}</Text>}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnTxt}>ANNULER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            testID="hl-form-save"
          >
            <Text style={styles.saveBtnTxt}>
              {saving ? "ENREGISTREMENT…" : "ENREGISTRER"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  content: { padding: SPACING.screen, paddingBottom: 80 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 30,
    color: COLORS.primaryText,
    marginTop: 4,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.secondaryText,
    marginTop: 8,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 12,
    borderRadius: 40,
    marginTop: 20,
    marginBottom: 16,
  },
  addBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  empty: { padding: 24, alignItems: "center" },
  emptyTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 12,
    marginBottom: 8,
  },
  rowOrder: { alignItems: "center", gap: 2 },
  rowOrderTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.secondaryText,
  },
  rowTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.primaryText,
    flexShrink: 1,
  },
  rowMeta: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sponsorTag: {
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sponsorTagTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    letterSpacing: 0.6,
    color: COLORS.primaryText,
  },
  inactiveTag: {
    backgroundColor: "#EEE",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveTagTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    letterSpacing: 0.6,
    color: COLORS.secondaryText,
  },

  // Modal
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  modalTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.primaryText,
  },
  lbl: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  input: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  selectedEntry: {
    marginHorizontal: 16,
    padding: 10,
    backgroundColor: "#FFFBEA",
    borderWidth: 1,
    borderColor: "#F0E2A0",
    borderRadius: 8,
  },
  selectedEntryTitle: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primaryText },
  selectedEntryMeta: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.secondaryText, marginTop: 2 },
  changeLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.accentYellow,
    marginTop: 6,
  },
  entryOption: {
    marginHorizontal: 16,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  entryOptionTitle: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.primaryText },
  entryOptionMeta: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.secondaryText, marginTop: 1 },
  fileBtn: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  fileBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  fileChip: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fileChipTxt: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.primaryText, flex: 1 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  toggleLbl: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  err: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "#C44",
    marginHorizontal: 16,
    marginTop: 10,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    alignItems: "center",
  },
  cancelBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 40,
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
  },
  saveBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.accentYellow,
  },
});
