import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem } from "../../src/api";
import EntryCard from "../../src/EntryCard";
import TopBar from "../../src/TopBar";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { DanceStyleFilterChips, DanceStyle } from "../../src/DanceStyle";
import { useAuth } from "../../src/auth";
import { notify } from "../../src/dialog";

/** Returns YYYY-MM-DD one month after `iso`, clamped to last day if needed. */
function addOneMonthISO(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  // Get last day of the target month
  const last = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d, last);
  return `${ny.toString().padStart(4, "0")}-${nm
    .toString()
    .padStart(2, "0")}-${nd.toString().padStart(2, "0")}`;
}

function formatDateFR(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Mensuelles() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [danceStyle, setDanceStyle] = useState<DanceStyle | "all">("all");

  // Programmer le prochain — modal state
  const [scheduleEntry, setScheduleEntry] = useState<EntryItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleEndDate, setScheduleEndDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listEntries(
        "mensuelle",
        danceStyle === "all" ? undefined : danceStyle,
      );
      setItems(data);
    } catch (e) {
      console.log("mensuelles err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [danceStyle]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (id: string) => router.push(`/entry/${id}` as any);

  const isAdmin = !!user?.is_admin;
  const canScheduleNext = useCallback(
    (e: EntryItem): boolean => {
      if (!user || !token) return false;
      if (isAdmin) return true;
      return (e as any).submitted_by === user.user_id;
    },
    [user, token, isAdmin],
  );

  const openScheduleModal = (e: EntryItem) => {
    setScheduleEntry(e);
    setScheduleDate(addOneMonthISO(e.date));
    setScheduleEndDate(e.end_date ? addOneMonthISO(e.end_date) : "");
  };

  const closeScheduleModal = () => {
    setScheduleEntry(null);
    setScheduleDate("");
    setScheduleEndDate("");
  };

  const submitSchedule = async () => {
    if (!scheduleEntry || !token) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
      notify("Date invalide", "Format attendu : AAAA-MM-JJ (ex : 2026-07-15)");
      return;
    }
    setSubmitting(true);
    try {
      const overrides: Record<string, string> = { date: scheduleDate };
      if (scheduleEndDate) overrides.end_date = scheduleEndDate;
      const created = await api.duplicateNextEntry(
        token,
        scheduleEntry.id,
        overrides,
      );
      closeScheduleModal();
      if (isAdmin) {
        notify(
          "Édition programmée ✅",
          "Le prochain rendez-vous est publié. Tu peux modifier les détails depuis sa fiche.",
        );
        router.push(`/entry/${created.id}` as any);
      } else {
        notify(
          "Proposition envoyée 📨",
          "Ton prochain rendez-vous est en attente de validation par un admin.",
        );
      }
      load();
    } catch (e: any) {
      notify("Erreur", e?.message || "Impossible de programmer le prochain");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCard = ({ item }: { item: EntryItem }) => (
    <View>
      <EntryCard entry={item} onPress={() => openDetail(item.id)} />
      {canScheduleNext(item) && (
        <TouchableOpacity
          testID={`schedule-next-${item.id}`}
          style={styles.scheduleBtn}
          onPress={() => openScheduleModal(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="repeat" size={14} color={COLORS.primaryText} />
          <Text style={styles.scheduleBtnTxt}>PROGRAMMER LE PROCHAIN</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.primaryText} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID="entries-mensuelle"
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderCard}
        contentContainerStyle={{
          paddingBottom: 40,
          paddingHorizontal: SPACING.screen,
        }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.overline}>LES RENDEZ-VOUS MENSUELS</Text>
            <Text style={styles.title}>
              Les{" "}
              <Text
                style={{
                  fontFamily: FONTS.headingItalic,
                  fontStyle: "italic",
                  color: COLORS.accentYellow,
                }}
              >
                mensuelles.
              </Text>
            </Text>
            <Text style={styles.subtitle}>
              Les soirées récurrentes de la communauté Paris Cuban Salsa. Notez
              les dates — elles reviennent chaque mois.
            </Text>
            <View style={styles.countPill}>
              <Text style={styles.count}>
                {items.length}{" "}
                {items.length <= 1 ? "RENDEZ-VOUS" : "RENDEZ-VOUS"}
              </Text>
            </View>
            <View style={{ marginTop: 18 }}>
              <SubmitEntryButton type="mensuelle" />
            </View>
            <View style={{ marginTop: 12 }}>
              <DanceStyleFilterChips
                value={danceStyle}
                onChange={setDanceStyle}
                testIDPrefix="filter-mensuelle"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={COLORS.primaryText} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>
                Aucun rendez-vous mensuel pour le moment.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primaryText}
          />
        }
      />

      {/* Programmer le prochain — modal */}
      <Modal
        visible={!!scheduleEntry}
        animationType="slide"
        transparent
        onRequestClose={closeScheduleModal}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", maxWidth: 540 }}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalTopBar}>
                <Text style={styles.modalOverline}>
                  {isAdmin ? "ADMIN" : "ORGANISATEUR"} · PROGRAMMER LE PROCHAIN
                </Text>
                <TouchableOpacity
                  onPress={closeScheduleModal}
                  testID="schedule-close"
                >
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 18 }}>
                <Text style={styles.modalTitle}>
                  {scheduleEntry?.title || ""}
                </Text>
                <Text style={styles.modalSub}>
                  Édition actuelle :{" "}
                  {scheduleEntry ? formatDateFR(scheduleEntry.date) : ""}
                </Text>

                {!isAdmin && (
                  <View style={styles.lockedBanner}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={14}
                      color={COLORS.secondaryText}
                    />
                    <Text style={styles.lockedTxt}>
                      Seule la DATE est modifiable. Le reste (titre, lieu,
                      description…) est verrouillé et sera validé par un admin.
                    </Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>NOUVELLE DATE</Text>
                <TextInput
                  testID="schedule-date"
                  style={styles.input}
                  value={scheduleDate}
                  onChangeText={setScheduleDate}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={COLORS.secondaryText}
                  autoCapitalize="none"
                />
                <Text style={styles.fieldHelp}>
                  Pré-rempli à +1 mois — tu peux ajuster.
                </Text>

                {!!scheduleEntry?.end_date && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                      DATE DE FIN (optionnel)
                    </Text>
                    <TextInput
                      testID="schedule-end-date"
                      style={styles.input}
                      value={scheduleEndDate}
                      onChangeText={setScheduleEndDate}
                      placeholder="AAAA-MM-JJ"
                      placeholderTextColor={COLORS.secondaryText}
                      autoCapitalize="none"
                    />
                  </>
                )}

                {/* Read-only summary for organisateur */}
                {!isAdmin && scheduleEntry && (
                  <View style={styles.readonlyCard}>
                    <ReadonlyRow label="LIEU" value={scheduleEntry.venue || "—"} />
                    <ReadonlyRow
                      label="HORAIRE"
                      value={
                        scheduleEntry.time
                          ? scheduleEntry.time +
                            (scheduleEntry.end_time
                              ? ` — ${scheduleEntry.end_time}`
                              : "")
                          : "—"
                      }
                    />
                    {!!scheduleEntry.description && (
                      <ReadonlyRow
                        label="DESCRIPTION"
                        value={scheduleEntry.description}
                      />
                    )}
                  </View>
                )}

                <TouchableOpacity
                  testID="schedule-submit"
                  style={[
                    styles.submitBtn,
                    submitting && { opacity: 0.6 },
                  ]}
                  onPress={submitSchedule}
                  disabled={submitting}
                >
                  <Text style={styles.submitTxt}>
                    {submitting
                      ? "ENVOI…"
                      : isAdmin
                      ? "PUBLIER LE PROCHAIN"
                      : "ENVOYER POUR VALIDATION"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.readonlyLabel}>{label}</Text>
      <Text style={styles.readonlyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: { paddingTop: 12, paddingBottom: 18 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1,
    color: COLORS.primaryText,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.secondaryText,
    marginTop: 12,
    marginBottom: 14,
  },
  countPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 40,
  },
  count: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
  },
  empty: { padding: 40, alignItems: "center" },
  emptyTxt: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    textAlign: "center",
  },
  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    marginTop: -10,
    marginBottom: 22,
    backgroundColor: COLORS.accentYellow,
    borderRadius: 40,
  },
  scheduleBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
  },
  modalTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#FAFAFA",
  },
  modalOverline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  modalTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    letterSpacing: -0.3,
  },
  modalSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 4,
    marginBottom: 14,
  },
  lockedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    backgroundColor: "#FFF8DC",
    borderRadius: 8,
    marginBottom: 14,
  },
  lockedTxt: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.secondaryText,
  },
  fieldLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
    marginBottom: 6,
  },
  fieldHelp: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.primaryText,
    backgroundColor: "#fff",
  },
  readonlyCard: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  readonlyLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: COLORS.secondaryText,
  },
  readonlyValue: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.primaryText,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 40,
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
  },
  submitTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.accentYellow,
  },
});
