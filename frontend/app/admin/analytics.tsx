import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";

type DashData = {
  period: string;
  visitors: { today: number; week: number; month: number };
  daily: { date: string; uniques: number }[];
  top_views: { entry_id: string; count: number; title: string; type: string }[];
  top_tickets: { entry_id: string; count: number; title: string; type: string }[];
  top_artists: { teacher_id: string; count: number; name: string }[];
  top_gallery: { _id: string; count: number }[];
  channels: { channel: string; count: number }[];
  conversions: { entry_id: string; views: number; tickets: number; rate: number; title: string }[];
  featured: { entry_id: string; title: string; impressions: number; tickets: number; rate: number }[];
};

const PERIODS = [
  { v: "7d", l: "7 jours" },
  { v: "30d", l: "30 jours" },
  { v: "90d", l: "3 mois" },
];

function getApiBase(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "") + "/api";
  return "/api";
}

export default function AdminAnalytics() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${getApiBase()}/analytics/dashboard?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const json = await r.json();
      setData(json);
    } catch (e) {
      console.log("analytics err", e);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    if (!authLoading && !user?.is_admin) {
      router.replace("/login");
      return;
    }
    load();
  }, [authLoading, user, router, load]);

  const maxDaily = Math.max(1, ...(data?.daily?.map((d) => d.uniques) ?? [1]));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/admin")} testID="admin-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>ANALYTICS</Text>
        <TouchableOpacity onPress={load} disabled={loading}>
          <Ionicons
            name={loading ? "sync" : "refresh"}
            size={18}
            color={COLORS.primaryText}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 80 }}>
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.v}
              testID={`period-${p.v}`}
              onPress={() => setPeriod(p.v as any)}
              style={[styles.periodChip, period === p.v && styles.periodChipOn]}
            >
              <Text style={[styles.periodTxt, period === p.v && styles.periodTxtOn]}>
                {p.l.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading || !data ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.primaryText} />
          </View>
        ) : (
          <>
            {/* Visitors KPIs */}
            <View style={styles.kpiRow}>
              <KPI label="AUJOURD'HUI" value={data.visitors.today} />
              <KPI label="7 JOURS" value={data.visitors.week} />
              <KPI label="30 JOURS" value={data.visitors.month} />
            </View>

            {/* Daily chart */}
            <Section title="ÉVOLUTION QUOTIDIENNE" sub={`Visiteurs uniques · ${period}`}>
              {data.daily.length === 0 ? (
                <Text style={styles.empty}>Pas encore de données.</Text>
              ) : (
                <View style={styles.chartRow}>
                  {data.daily.slice(-30).map((d, i) => (
                    <View key={d.date + i} style={styles.bar}>
                      <View
                        style={[
                          styles.barFill,
                          { height: `${(d.uniques / maxDaily) * 100}%` },
                        ]}
                      />
                      {i === 0 || i === data.daily.length - 1 ? (
                        <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </Section>

            <Section title="TOP 10 EVENTS LES PLUS VUS" sub="Vues détail">
              {data.top_views.length === 0 ? (
                <Text style={styles.empty}>Aucune vue trackée.</Text>
              ) : (
                data.top_views.map((r, i) => (
                  <Row key={r.entry_id} idx={i + 1} title={r.title} value={r.count} />
                ))
              )}
            </Section>

            <Section title="TOP 10 BILLETS CLIQUÉS" sub="click_ticket">
              {data.top_tickets.length === 0 ? (
                <Text style={styles.empty}>Aucun clic ticket.</Text>
              ) : (
                data.top_tickets.map((r, i) => (
                  <Row key={r.entry_id} idx={i + 1} title={r.title} value={r.count} />
                ))
              )}
            </Section>

            <Section title="TOP 5 ARTISTES" sub="click_artist">
              {data.top_artists.length === 0 ? (
                <Text style={styles.empty}>Aucune fiche consultée.</Text>
              ) : (
                data.top_artists.map((r, i) => (
                  <Row key={r.teacher_id} idx={i + 1} title={r.name} value={r.count} />
                ))
              )}
            </Section>

            <Section title="CONVERSION" sub="Vues → clic ticket par event">
              {data.conversions.length === 0 ? (
                <Text style={styles.empty}>Pas assez de données.</Text>
              ) : (
                data.conversions.map((r, i) => (
                  <View key={r.entry_id} style={styles.convRow}>
                    <Text style={styles.convIdx}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.convTitle} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={styles.convSub}>
                        {r.views} vues · {r.tickets} clics tickets
                      </Text>
                    </View>
                    <Text style={styles.convRate}>{r.rate}%</Text>
                  </View>
                ))
              )}
            </Section>

            <Section title="COUPS DE CŒUR — PERFORMANCE" sub="Impressions → clics ticket">
              {data.featured.length === 0 ? (
                <Text style={styles.empty}>Aucun coup de cœur actif.</Text>
              ) : (
                data.featured.map((r, i) => (
                  <View key={r.entry_id} style={styles.convRow}>
                    <Text style={styles.convIdx}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.convTitle} numberOfLines={1}>
                        ⭐ {r.title}
                      </Text>
                      <Text style={styles.convSub}>
                        {r.impressions} imp · {r.tickets} tickets
                      </Text>
                    </View>
                    <Text style={styles.convRate}>{r.rate}%</Text>
                  </View>
                ))
              )}
            </Section>

            <Section title="CANAUX DE PARTAGE" sub="click_share par canal">
              {data.channels.length === 0 ? (
                <Text style={styles.empty}>Aucun partage tracké.</Text>
              ) : (
                data.channels.map((c) => (
                  <Row key={c.channel} title={c.channel} value={c.count} />
                ))
              )}
            </Section>

            <Text style={styles.footer}>
              Données live via collection MongoDB analytics_events.
              GA4 (G-R13W4BZG92) actif côté navigateur.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionOver}>{title}</Text>
      {sub && <Text style={styles.sectionSub}>{sub}</Text>}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ idx, title, value }: { idx?: number; title: string; value: number }) {
  return (
    <View style={styles.row}>
      {idx !== undefined && <Text style={styles.rowIdx}>{idx}</Text>}
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
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
  periodRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    borderRadius: 40,
  },
  periodChipOn: {
    backgroundColor: COLORS.primaryText,
  },
  periodTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  periodTxtOn: { color: COLORS.accentYellow },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
  kpi: {
    flex: 1,
    padding: 14,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
  },
  kpiLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: COLORS.accentYellow,
  },
  kpiValue: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: "#fff",
    marginTop: 6,
  },
  section: {
    marginBottom: 22,
    backgroundColor: "#fff",
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  sectionOver: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  sectionSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  sectionBody: { marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 10,
  },
  rowIdx: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.secondaryText,
    width: 22,
  },
  rowTitle: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.primaryText,
  },
  rowValue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.primaryText,
  },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 10,
  },
  convIdx: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.secondaryText,
    width: 22,
  },
  convTitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.primaryText,
  },
  convSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  convRate: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.accentYellow,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  empty: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    paddingVertical: 12,
    textAlign: "center",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 2,
    paddingTop: 16,
  },
  bar: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    width: "70%",
    backgroundColor: COLORS.accentYellow,
    minHeight: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  barLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  footer: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.secondaryText,
    textAlign: "center",
    marginTop: 30,
    fontStyle: "italic",
  },
});
