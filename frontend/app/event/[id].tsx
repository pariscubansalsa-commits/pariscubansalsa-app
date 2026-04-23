import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, EventItem, PhotoItem } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = 4;
const NUM_COLS = SCREEN_W >= 768 ? 3 : 2;
const TILE_SIZE = (SCREEN_W - SPACING.screen * 2 - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [shareToast, setShareToast] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, ph] = await Promise.all([api.getEvent(id), api.listPhotos(id)]);
      setEvent(ev);
      setPhotos(ph);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const activePhoto = activeIdx != null ? photos[activeIdx] : null;

  const shareUrl = useMemo(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return `${window.location.origin}/event/${id}`;
    }
    return `pcs.photos/event/${id}`;
  }, [id]);

  const handleShareEvent = async () => {
    try {
      if (Platform.OS === "web" && (navigator as any)?.share) {
        await (navigator as any).share({
          title: event?.name ?? "Paris Cuban Salsa",
          text: `Photos from ${event?.name}`,
          url: shareUrl,
        });
        return;
      }
      await Clipboard.setStringAsync(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 1800);
    } catch (e) {
      console.log("share err", e);
    }
  };

  const handleDownload = async (photo: PhotoItem) => {
    try {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const a = document.createElement("a");
        a.href = photo.data;
        a.download = `pcs-${photo.id}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const ext = photo.data.startsWith("data:image/png") ? "png" : "jpg";
      const fileUri = FileSystem.cacheDirectory + `pcs-${photo.id}.${ext}`;
      const base64 = photo.data.split(",")[1] || "";
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (e) {
      console.log("download err", e);
      Alert.alert("Download failed");
    }
  };

  const handleAddTag = async () => {
    if (!activePhoto) return;
    const label = tagInput.trim();
    if (!label) return;
    try {
      const t = await api.addTag(activePhoto.id, label);
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === activePhoto.id ? { ...p, tags: [...p.tags, t] } : p
        )
      );
      setTagInput("");
    } catch (e) {
      console.log("tag err", e);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!token) return;
    try {
      await api.deletePhoto(token, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setActiveIdx(null);
    } catch (e) {
      console.log(e);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return d;
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

  if (!event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.err}>Event not found.</Text>
          <TouchableOpacity onPress={() => router.replace("/")}>
            <Text style={styles.backLink}>BACK TO GALLERY</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="back-btn"
          onPress={() => router.replace("/")}
          style={styles.topBtn}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>EVENT</Text>
        <TouchableOpacity
          testID="share-event-btn"
          onPress={handleShareEvent}
          style={styles.topBtn}
        >
          <Ionicons name="share-outline" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {event.cover_photo && (
          <Image source={{ uri: event.cover_photo }} style={styles.cover} />
        )}

        <View style={styles.meta}>
          <Text style={styles.metaDate}>{formatDate(event.date)}</Text>
          <Text style={styles.title}>{event.name}</Text>
          {!!event.description && (
            <Text style={styles.desc}>{event.description}</Text>
          )}

          <TouchableOpacity
            testID="share-ig-btn"
            style={styles.shareBtn}
            onPress={handleShareEvent}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-instagram" size={16} color={COLORS.primaryText} />
            <Text style={styles.shareBtnTxt}>PARTAGER EN STORY INSTAGRAM</Text>
          </TouchableOpacity>

          {user?.is_admin && (
            <TouchableOpacity
              testID="manage-event-btn"
              style={[styles.shareBtn, styles.manageBtn]}
              onPress={() => router.push(`/admin/event/${event.id}`)}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primaryText} />
              <Text style={styles.shareBtnTxt}>GÉRER & UPLOADER</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>
          {photos.length} PHOTO{photos.length === 1 ? "" : "S"}
        </Text>

        <View style={styles.grid}>
          {photos.map((p, idx) => (
            <TouchableOpacity
              key={p.id}
              testID={`photo-${idx}`}
              onPress={() => setActiveIdx(idx)}
              activeOpacity={0.85}
              style={[
                styles.tile,
                {
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  marginRight: (idx + 1) % NUM_COLS === 0 ? 0 : GRID_GAP,
                  marginBottom: GRID_GAP,
                },
              ]}
            >
              <Image source={{ uri: p.data }} style={styles.tileImg} />
              {p.tags.length > 0 && (
                <View style={styles.tileTagBadge}>
                  <Ionicons name="pricetag" size={10} color={COLORS.primaryText} />
                  <Text style={styles.tileTagTxt}>{p.tags.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          {photos.length === 0 && (
            <View style={styles.emptyGrid}>
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySub}>
                {user?.is_admin
                  ? "Tap 'Manage & Upload' to add photos."
                  : "Check back soon."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {shareToast && (
        <View style={styles.toast} testID="share-toast">
          <Text style={styles.toastTxt}>LINK COPIED</Text>
        </View>
      )}

      {/* Lightbox */}
      <Modal
        visible={activeIdx != null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setActiveIdx(null)}
      >
        {activePhoto && (
          <View style={styles.lightbox}>
            <View style={styles.lightboxBar}>
              <TouchableOpacity
                testID="lightbox-close"
                onPress={() => setActiveIdx(null)}
                style={styles.lbBtn}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.lbCount}>
                {(activeIdx ?? 0) + 1} / {photos.length}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  testID="lightbox-download"
                  onPress={() => handleDownload(activePhoto)}
                  style={styles.lbBtn}
                >
                  <Ionicons name="download-outline" size={22} color="#fff" />
                </TouchableOpacity>
                {user?.is_admin && (
                  <TouchableOpacity
                    testID="lightbox-delete"
                    onPress={() =>
                      Platform.OS === "web"
                        ? window.confirm("Delete this photo?") &&
                          handleDeletePhoto(activePhoto.id)
                        : Alert.alert("Delete photo?", "", [
                            { text: "Cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => handleDeletePhoto(activePhoto.id),
                            },
                          ])
                    }
                    style={styles.lbBtn}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.lbImgWrap}>
              <TouchableOpacity
                disabled={(activeIdx ?? 0) <= 0}
                onPress={() => setActiveIdx((i) => (i != null ? i - 1 : 0))}
                style={styles.navZoneLeft}
                testID="lightbox-prev"
              >
                <Ionicons
                  name="chevron-back"
                  size={32}
                  color={(activeIdx ?? 0) <= 0 ? "rgba(255,255,255,0.2)" : "#fff"}
                />
              </TouchableOpacity>
              <Image source={{ uri: activePhoto.data }} style={styles.lbImg} />
              <TouchableOpacity
                disabled={(activeIdx ?? 0) >= photos.length - 1}
                onPress={() => setActiveIdx((i) => (i != null ? i + 1 : 0))}
                style={styles.navZoneRight}
                testID="lightbox-next"
              >
                <Ionicons
                  name="chevron-forward"
                  size={32}
                  color={
                    (activeIdx ?? 0) >= photos.length - 1
                      ? "rgba(255,255,255,0.2)"
                      : "#fff"
                  }
                />
              </TouchableOpacity>
            </View>

            <View style={styles.lbBottom}>
              <View style={styles.tagsRow}>
                {activePhoto.tags.length === 0 ? (
                  <Text style={styles.noTagsTxt}>No one tagged yet.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {activePhoto.tags.map((t) => (
                      <View key={t.id} style={styles.tagChip}>
                        <Text style={styles.tagChipTxt}>{t.label}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
              <TouchableOpacity
                testID="open-tag-sheet"
                style={styles.tagMeBtn}
                onPress={() => setTagSheetOpen(true)}
              >
                <Ionicons name="pricetag-outline" size={14} color={COLORS.primaryText} />
                <Text style={styles.tagMeBtnTxt}>TAG YOURSELF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Tag bottom sheet */}
      <Modal
        visible={tagSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTagSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetBackdrop}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setTagSheetOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Tag yourself</Text>
            <Text style={styles.sheetSub}>
              Enter your name or @instagram handle.
            </Text>
            <TextInput
              testID="tag-input"
              style={styles.input}
              placeholder="@your_handle or Your Name"
              placeholderTextColor={COLORS.secondaryText}
              value={tagInput}
              onChangeText={setTagInput}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={async () => {
                await handleAddTag();
                setTagSheetOpen(false);
              }}
            />
            <TouchableOpacity
              testID="submit-tag"
              style={styles.primaryBtn}
              onPress={async () => {
                await handleAddTag();
                setTagSheetOpen(false);
              }}
            >
              <Text style={styles.primaryBtnTxt}>ADD TAG</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setTagSheetOpen(false)}
            >
              <Text style={styles.cancelTxt}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
  cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: COLORS.surface },
  meta: { paddingHorizontal: SPACING.screen, paddingTop: 24 },
  metaDate: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: COLORS.primaryText,
    marginTop: 8,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.secondaryText,
    marginTop: 16,
  },
  shareBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  manageBtn: { backgroundColor: "transparent", marginTop: 8 },
  shareBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.primaryText,
    marginHorizontal: SPACING.screen,
    marginTop: 32,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
    marginTop: 20,
    marginBottom: 16,
    marginHorizontal: SPACING.screen,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.screen,
  },
  tile: { backgroundColor: COLORS.surface, position: "relative" },
  tileImg: { width: "100%", height: "100%" },
  tileTagBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tileTagTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.primaryText,
  },
  emptyGrid: { width: "100%", padding: 40, alignItems: "center" },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  emptySub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 8,
    textAlign: "center",
  },
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: COLORS.primaryText,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  toastTxt: {
    color: COLORS.accentYellow,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
  },

  // Lightbox
  lightbox: { flex: 1, backgroundColor: COLORS.lightboxBg },
  lightboxBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 28,
    paddingBottom: 12,
  },
  lbBtn: { padding: 8 },
  lbCount: {
    color: "#fff",
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  lbImgWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  lbImg: { flex: 1, height: "100%", resizeMode: "contain" },
  navZoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  navZoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  lbBottom: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tagsRow: { minHeight: 30, marginBottom: 12 },
  noTagsTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    fontStyle: "italic",
  },
  tagChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  tagChipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.primaryText,
  },
  tagMeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 12,
  },
  tagMeBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },

  // Sheet
  sheetBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.screen,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.primaryText,
  },
  sheetSub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 6,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.primaryText,
    marginBottom: 12,
  },
  primaryBtn: {
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
  cancelBtn: { paddingVertical: 14, alignItems: "center" },
  cancelTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
  },
});
