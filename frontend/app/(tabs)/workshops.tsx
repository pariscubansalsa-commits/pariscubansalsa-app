import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, EntryItem, TeacherItem } from "../../src/api";
import EntryCard from "../../src/EntryCard";
import TopBar from "../../src/TopBar";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { DanceStyleFilterChips, DanceStyle } from "../../src/DanceStyle";

export default function Workshops() {
  const router = useRouter();
  const [items, setItems] = useState<EntryItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [danceStyle, setDanceStyle] = useState<DanceStyle | "all">("all");
  const [teacherId, setTeacherId] = useState<string | "all">("all");

  const load = useCallback(async () => {
    try {
      const [data, profs] = await Promise.all([
        api.listEntries("workshop", danceStyle === "all" ? undefined : danceStyle),
        api.listTeachers().catch(() => [] as TeacherItem[]),
      ]);
      setItems(data);
      setTeachers(profs);
    } catch (e) {
      console.log("workshops err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [danceStyle]);

  useEffect(() => {
    load();
  }, [load]);

  // Teachers who actually have workshops (used to derive the chip list)
  const teachersWithWorkshops = useMemo(() => {
    const ids = new Set(
      items
        .map((i) => i.teacher_id)
        .filter((x): x is string => !!x)
    );
    // map back to teacher items, preserve order
    return teachers.filter((t) => ids.has(t.id));
  }, [items, teachers]);

  // Combined filter result
  const filtered = useMemo(() => {
    if (teacherId === "all") return items;
    return items.filter((i) => i.teacher_id === teacherId);
  }, [items, teacherId]);

  const openDetail = (id: string) => router.push(`/entry/${id}` as any);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID="workshops-list"
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <EntryCard entry={item} onPress={() => openDetail(item.id)} />
        )}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: SPACING.screen }}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.overline}>STAGES & FORMATIONS</Text>
              <Text style={styles.title}>
                Workshops{" "}
                <Text
                  style={{
                    fontFamily: FONTS.headingItalic,
                    fontStyle: "italic",
                    color: COLORS.accentYellow,
                  }}
                >
                  à venir.
                </Text>
              </Text>
              <Text style={styles.subtitle}>
                Cours intensifs, stages d&apos;un week-end, masterclasses avec
                les meilleurs profs de salsa cubaine.
              </Text>
              <View style={styles.countPill}>
                <Text style={styles.count}>
                  {filtered.length}{" "}
                  {filtered.length <= 1 ? "WORKSHOP" : "WORKSHOPS"}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <SubmitEntryButton type="workshop" customLabel="+ PROPOSER UN WORKSHOP" />
            </View>

            {/* Filter 1 — Dance style */}
            <View style={{ marginTop: 6 }}>
              <Text style={styles.filterLabel}>STYLE DE DANSE</Text>
              <DanceStyleFilterChips
                value={danceStyle}
                onChange={setDanceStyle}
                testIDPrefix="ws-style"
              />
            </View>

            {/* Filter 2 — Teacher */}
            {teachersWithWorkshops.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.filterLabel}>PROFESSEUR</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                  testID="teacher-filter-row"
                >
                  <TeacherChip
                    label="TOUS"
                    active={teacherId === "all"}
                    onPress={() => setTeacherId("all")}
                    testID="filter-teacher-all"
                  />
                  {teachersWithWorkshops.map((t) => (
                    <TeacherChip
                      key={t.id}
                      label={t.name}
                      active={teacherId === t.id}
                      onPress={() => setTeacherId(t.id)}
                      testID={`filter-teacher-${t.id}`}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.spacer} />
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
                {teacherId !== "all" || danceStyle !== "all"
                  ? "Aucun workshop pour ces filtres."
                  : "Aucun workshop pour le moment."}
              </Text>
              {(teacherId !== "all" || danceStyle !== "all") && (
                <TouchableOpacity
                  onPress={() => {
                    setTeacherId("all");
                    setDanceStyle("all");
                  }}
                  testID="reset-filters"
                >
                  <Text style={styles.emptyLink}>RÉINITIALISER LES FILTRES</Text>
                </TouchableOpacity>
              )}
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
    </SafeAreaView>
  );
}

function TeacherChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
        {label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: { paddingTop: 20, paddingBottom: 18 },
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
  filterLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: COLORS.primaryText,
    borderColor: COLORS.primaryText,
  },
  chipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: COLORS.primaryText,
  },
  chipTxtActive: { color: COLORS.accentYellow },
  spacer: { height: 18 },
  empty: { padding: 40, alignItems: "center", gap: 12 },
  emptyTxt: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText, textAlign: "center" },
  emptyLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
    textDecorationLine: "underline",
  },
});
