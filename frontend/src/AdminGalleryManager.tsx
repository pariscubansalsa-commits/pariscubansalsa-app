import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, EntryMediaItem } from "./api";
import { COLORS, FONTS, SPACING } from "./theme";
import { confirmAction, notify } from "./dialog";

/** Convert a File to a base64 data URI. */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB raw

export default function AdminGalleryManager({
  visible,
  onClose,
  entryId,
  token,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  entryId: string;
  token: string;
  onChanged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<EntryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listEntryMedia(entryId);
      setItems(data);
    } catch (e) {
      console.log("admin gallery err", e);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const pickPhotos = async () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      const tooLarge = files.find((f) => f.size > MAX_PHOTO_BYTES);
      if (tooLarge) {
        notify(
          "Photo trop lourde",
          `« ${tooLarge.name} » dépasse 4 Mo. Compressez-la avant l'envoi.`
        );
        return;
      }
      setUploading(true);
      try {
        const datas = await Promise.all(files.map(fileToDataURL));
        await api.addEntryMedia(
          token,
          entryId,
          datas.map((d, i) => ({
            kind: "photo" as const,
            data: d,
            title: files[i].name.replace(/\.[^.]+$/, ""),
          }))
        );
        await load();
        onChanged?.();
      } catch (e: any) {
        notify("Erreur upload", e?.message || "Envoi impossible");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const addVideo = async () => {
    const url = videoUrl.trim();
    if (!url) {
      notify("Lien manquant", "Collez l'URL YouTube ou Instagram.");
      return;
    }
    if (!/youtube\.com|youtu\.be|instagram\.com/.test(url)) {
      notify("Lien non supporté", "Seuls YouTube et Instagram sont reconnus.");
      return;
    }
    setUploading(true);
    try {
      await api.addEntryMedia(token, entryId, [
        { kind: "video", data: url, title: videoTitle.trim() },
      ]);
      setVideoUrl("");
      setVideoTitle("");
      await load();
      onChanged?.();
    } catch (e: any) {
      notify("Erreur", e?.message || "Ajout impossible");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (m: EntryMediaItem) => {
    const ok = await confirmAction("Supprimer ce média ?", "Cette action est irréversible.");
    if (!ok) return;
    try {
      await api.deleteEntryMedia(token, m.id);
      setItems((prev) => prev.filter((i) => i.id !== m.id));
      onChanged?.();
    } catch (e: any) {
      notify("Erreur", e?.message || "Suppression impossible");
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    const [m] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, m);
    setItems(reordered);
    try {
      await api.reorderEntryMedia(token, entryId, reordered.map((x) => x.id));
      onChanged?.();
    } catch (e) {
      console.log("reorder err", e);
      load();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.safe}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 14) }]}>
          <Text style={styles.topTitle}>GÉRER LA GALERIE</Text>
          <TouchableOpacity
            onPress={onClose}
            testID="admin-gallery-close"
            hitSlop={12}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={24} color={COLORS.primaryText} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 60 }}>
          {/* Upload photos */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>AJOUTER DES PHOTOS</Text>
            <Text style={styles.cardHelp}>
              4 Mo max par photo. Plusieurs photos d&apos;un coup possible.
            </Text>
            <TouchableOpacity
              testID="admin-gallery-upload-photo"
              style={styles.primaryBtn}
              onPress={pickPhotos}
              disabled={uploading}
            >
              <Ionicons name="image-outline" size={18} color={COLORS.primaryText} />
              <Text style={styles.primaryBtnTxt}>
                {uploading ? "ENVOI…" : "CHOISIR DES PHOTOS"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add video URL */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>AJOUTER UNE VIDÉO (YOUTUBE / INSTAGRAM)</Text>
            <TextInput
              testID="admin-gallery-video-url"
              style={styles.input}
              placeholder="https://www.youtube.com/watch?v=... ou https://www.instagram.com/p/..."
              placeholderTextColor={COLORS.secondaryText}
              value={videoUrl}
              onChangeText={setVideoUrl}
              autoCapitalize="none"
            />
            <TextInput
              testID="admin-gallery-video-title"
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Titre / légende (optionnel)"
              placeholderTextColor={COLORS.secondaryText}
              value={videoTitle}
              onChangeText={setVideoTitle}
            />
            <TouchableOpacity
              testID="admin-gallery-add-video"
              style={[styles.secondaryBtn, { marginTop: 10 }]}
              onPress={addVideo}
              disabled={uploading}
            >
              <Ionicons name="logo-youtube" size={18} color={COLORS.primaryText} />
              <Text style={styles.secondaryBtnTxt}>AJOUTER LA VIDÉO</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          <Text style={styles.section}>
            {items.length} MÉDIA{items.length > 1 ? "S" : ""} EN GALERIE
          </Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 20 }} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>
              Aucun média pour le moment. Ajoutez photos ou vidéos ci-dessus.
            </Text>
          ) : (
            items.map((m, idx) => (
              <View key={m.id} style={styles.row} testID={`admin-gallery-item-${m.id}`}>
                <View style={styles.rowThumbWrap}>
                  {m.kind === "photo" ? (
                    <Image source={{ uri: m.data }} style={styles.rowThumb} />
                  ) : (
                    <View style={[styles.rowThumb, styles.rowThumbVideo]}>
                      <Ionicons name="play" size={20} color={COLORS.accentYellow} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={styles.rowKind}>
                    {m.kind === "photo" ? "PHOTO" : "VIDÉO"}
                  </Text>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {m.title || (m.kind === "video" ? m.data : "Sans titre")}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    testID={`admin-gallery-up-${m.id}`}
                    onPress={() => move(idx, -1)}
                    disabled={idx === 0}
                    style={[styles.iconBtn, idx === 0 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="arrow-up" size={16} color={COLORS.primaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`admin-gallery-down-${m.id}`}
                    onPress={() => move(idx, 1)}
                    disabled={idx === items.length - 1}
                    style={[
                      styles.iconBtn,
                      idx === items.length - 1 && { opacity: 0.3 },
                    ]}
                  >
                    <Ionicons name="arrow-down" size={16} color={COLORS.primaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`admin-gallery-delete-${m.id}`}
                    onPress={() => remove(m)}
                    style={[styles.iconBtn, styles.iconBtnDanger]}
                  >
                    <Ionicons name="trash-outline" size={16} color="#C0392B" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  topTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: COLORS.primaryText,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: "#FAFAFA",
  },
  cardLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
    marginBottom: 6,
  },
  cardHelp: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginBottom: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 12,
    borderRadius: 40,
  },
  primaryBtnTxt: {
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
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 12,
    borderRadius: 40,
    backgroundColor: "#fff",
  },
  secondaryBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 8,
    marginBottom: 14,
  },
  section: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.primaryText,
    marginBottom: 12,
  },
  empty: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    textAlign: "center",
    paddingVertical: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowThumbWrap: { width: 60 },
  rowThumb: { width: 60, height: 60, borderRadius: 6, backgroundColor: COLORS.surface },
  rowThumbVideo: {
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  rowKind: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
  },
  rowTitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.primaryText,
    marginTop: 2,
  },
  rowActions: { flexDirection: "row", gap: 4 },
  iconBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 7,
    borderRadius: 6,
  },
  iconBtnDanger: { borderColor: "#C0392B" },
});
