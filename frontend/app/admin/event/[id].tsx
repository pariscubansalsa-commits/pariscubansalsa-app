import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, EventItem, PhotoItem } from "../../../src/api";
import { useAuth } from "../../../src/auth";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

export default function AdminEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading, token } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, ph] = await Promise.all([api.getEvent(id), api.listPhotos(id)]);
      setEvent(ev);
      setPhotos(ph);
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    if (!loading && !user?.is_admin) {
      router.replace("/login");
      return;
    }
    if (user?.is_admin) load();
  }, [user, loading, router, load]);

  const pickPhotos = async () => {
    if (!token || !id) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });
    if (res.canceled) return;
    const datas = res.assets
      .filter((a) => a.base64)
      .map((a) => `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`);
    if (!datas.length) return;
    setUploading(true);
    try {
      await api.uploadPhotos(token, id, datas);
      await load();
    } catch (e: any) {
      console.log(e);
      if (Platform.OS === "web") window.alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (pid: string) => {
    if (!token) return;
    const ok =
      Platform.OS === "web"
        ? window.confirm("Delete this photo?")
        : await new Promise<boolean>((resolve) =>
            Alert.alert("Delete photo?", "", [
              { text: "Cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ])
          );
    if (!ok) return;
    await api.deletePhoto(token, pid);
    setPhotos((prev) => prev.filter((p) => p.id !== pid));
  };

  if (loading || busy) {
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="admin-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>MANAGE EVENT</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <Text style={styles.overline}>{event.date}</Text>
          <Text style={styles.title}>{event.name}</Text>
          {!!event.description && <Text style={styles.desc}>{event.description}</Text>}

          <TouchableOpacity
            testID="upload-photos-btn"
            style={[styles.primaryBtn, uploading && { opacity: 0.6 }]}
            onPress={pickPhotos}
            disabled={uploading}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={16}
              color={COLORS.primaryText}
            />
            <Text style={styles.primaryBtnTxt}>
              {uploading ? "UPLOADING..." : "UPLOAD PHOTOS"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="view-public-btn"
            style={styles.secondaryBtn}
            onPress={() => router.push(`/event/${event.id}`)}
          >
            <Ionicons name="eye-outline" size={16} color={COLORS.primaryText} />
            <Text style={styles.primaryBtnTxt}>VIEW PUBLIC PAGE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>
          {photos.length} PHOTO{photos.length === 1 ? "" : "S"}
        </Text>

        <View style={styles.grid}>
          {photos.map((p) => (
            <View key={p.id} style={styles.tile}>
              <Image source={{ uri: p.data }} style={styles.tileImg} />
              <TouchableOpacity
                testID={`delete-photo-${p.id}`}
                style={styles.tileDel}
                onPress={() => handleDeletePhoto(p.id)}
              >
                <Ionicons name="trash-outline" size={14} color="#fff" />
              </TouchableOpacity>
              {p.tags.length > 0 && (
                <View style={styles.tagBadge}>
                  <Text style={styles.tagBadgeTxt}>{p.tags.length} TAGS</Text>
                </View>
              )}
            </View>
          ))}
          {photos.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySub}>
                Tap &quot;Upload Photos&quot; to add pictures from this event.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  err: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
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
  header: { paddingHorizontal: SPACING.screen, paddingTop: 32 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: COLORS.primaryText,
    marginTop: 8,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 10,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnTxt: {
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
    marginTop: 16,
    marginBottom: 12,
    marginHorizontal: SPACING.screen,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: SPACING.screen,
  },
  tile: { width: "32%", aspectRatio: 1, position: "relative" },
  tileImg: { width: "100%", height: "100%", backgroundColor: COLORS.surface },
  tileDel: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
  },
  tagBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagBadgeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  empty: { width: "100%", padding: 40, alignItems: "center" },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  emptySub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 8,
    textAlign: "center",
  },
});
