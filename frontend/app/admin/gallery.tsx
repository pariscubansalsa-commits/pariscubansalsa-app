import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, EventItem } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { Logo } from "../../src/Logo";

export default function AdminHome() {
  const { user, loading, token, logout } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listEvents();
      setEvents(data);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user?.is_admin) {
      router.replace("/login");
      return;
    }
    if (user?.is_admin) load();
  }, [user, loading, router, load]);

  const pickCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const a = res.assets[0];
      const mime = a.mimeType || "image/jpeg";
      setCover(`data:${mime};base64,${a.base64}`);
    }
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!name.trim() || !date.trim()) {
      if (Platform.OS === "web") window.alert("Nom et date sont requis");
      else Alert.alert("Champs manquants", "Nom et date sont requis");
      return;
    }
    setSubmitting(true);
    try {
      const ev = await api.createEvent(token, {
        name: name.trim(),
        date: date.trim(),
        description: description.trim(),
        cover_photo: cover || null,
      });
      setEvents((prev) => [ev, ...prev]);
      setCreateOpen(false);
      setName("");
      setDate("");
      setDescription("");
      setCover(null);
    } catch (e: any) {
      console.log(e);
      if (Platform.OS === "web") window.alert("Create failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    const ok =
      Platform.OS === "web"
        ? window.confirm("Supprimer cet événement et toutes ses photos ?")
        : await new Promise<boolean>((resolve) =>
            Alert.alert("Supprimer l'événement ?", "Cette action est irréversible.", [
              { text: "Annuler", onPress: () => resolve(false) },
              { text: "Supprimer", style: "destructive", onPress: () => resolve(true) },
            ])
          );
    if (!ok) return;
    await api.deleteEvent(token, id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="back-to-public">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Logo size={14} />
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

      <FlatList
        testID="admin-events-list"
        data={events}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.overline}>ADMIN · GALERIE PHOTO</Text>
            <Text style={styles.title}>
              Vos <Text style={styles.italic}>événements</Text>.
            </Text>
            <Text style={styles.sub}>Connecté en tant que {user?.email}</Text>

            <TouchableOpacity
              testID="create-event-btn"
              style={styles.createBtn}
              onPress={() => setCreateOpen(true)}
            >
              <Ionicons name="add" size={18} color={COLORS.primaryText} />
              <Text style={styles.createBtnTxt}>CRÉER UN ÉVÉNEMENT</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => router.push(`/admin/event/${item.id}`)}
              testID={`admin-event-${item.id}`}
            >
              {item.cover_photo ? (
                <Image source={{ uri: item.cover_photo }} style={styles.rowThumb} />
              ) : (
                <View style={[styles.rowThumb, styles.rowThumbFallback]}>
                  <Text style={styles.rowThumbTxt}>PCS</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowDate}>{item.date}</Text>
                <Text style={styles.rowName} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`delete-event-${item.id}`}
              style={styles.delBtn}
              onPress={() => handleDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.primaryText} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun événement pour l&apos;instant</Text>
            <Text style={styles.emptySub}>
              Créez votre premier événement photo pour commencer.
            </Text>
          </View>
        }
      />

      {/* Create Event Modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetBackdrop}
        >
          <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Nouvel événement</Text>
                <TouchableOpacity onPress={() => setCreateOpen(false)}>
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>NOM DE L&apos;ÉVÉNEMENT</Text>
              <TextInput
                testID="event-name-input"
                style={styles.input}
                placeholder="Salsa Night Vol. 12"
                placeholderTextColor={COLORS.secondaryText}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>DATE (AAAA-MM-JJ)</Text>
              <TextInput
                testID="event-date-input"
                style={styles.input}
                placeholder="2026-02-20"
                placeholderTextColor={COLORS.secondaryText}
                value={date}
                onChangeText={setDate}
                autoCapitalize="none"
              />

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                testID="event-desc-input"
                style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                placeholder="Une soirée cubaine au Cabaret Sauvage..."
                placeholderTextColor={COLORS.secondaryText}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={styles.label}>PHOTO DE COUVERTURE</Text>
              <TouchableOpacity
                testID="pick-cover-btn"
                style={styles.coverPicker}
                onPress={pickCover}
              >
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverEmpty}>
                    <Ionicons
                      name="image-outline"
                      size={28}
                      color={COLORS.secondaryText}
                    />
                    <Text style={styles.coverEmptyTxt}>CHOISIR UNE IMAGE</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="submit-create-event"
                style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}
              >
                <Text style={styles.primaryBtnTxt}>
                  {submitting ? "CRÉATION..." : "CRÉER L'ÉVÉNEMENT"}
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
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: { paddingHorizontal: SPACING.screen, paddingTop: 32, paddingBottom: 16 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.secondaryText,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: COLORS.primaryText,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 10,
  },
  createBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  createBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginHorizontal: SPACING.screen,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowThumb: { width: 56, height: 56, backgroundColor: COLORS.surface },
  rowThumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryText,
  },
  rowThumbTxt: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.accentYellow,
  },
  rowDate: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
    textTransform: "uppercase",
  },
  rowName: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.primaryText,
    marginTop: 2,
  },
  delBtn: { paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  empty: { padding: 40, alignItems: "center" },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  emptySub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 8,
    textAlign: "center",
  },

  sheetBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheetScroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.screen,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetTitle: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.primaryText },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.primaryText,
  },
  coverPicker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    aspectRatio: 16 / 9,
    backgroundColor: COLORS.surface,
  },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverEmptyTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
  },
  coverPreview: { width: "100%", height: "100%" },
  primaryBtn: {
    marginTop: 24,
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
