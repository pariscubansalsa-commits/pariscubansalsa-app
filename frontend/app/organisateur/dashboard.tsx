import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,

} from "react-native";
import { confirmAction, notify } from "../../src/dialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RoleGuard from "../../src/RoleGuard";
import { useAuth } from "../../src/auth";
import { api, EntryItem } from "../../src/api";
import { COLORS, FONTS, SPACING } from "../../src/theme";

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    pending: { label: "EN ATTENTE", bg: "#FEF3C7", fg: "#92400E" },
    approved: { label: "VALIDÉ", bg: "#D1FAE5", fg: "#065F46" },
    featured: { label: "COUP DE CŒUR", bg: COLORS.accentYellow, fg: COLORS.primaryText },
    rejected: { label: "REFUSÉ", bg: "#FEE2E2", fg: "#991B1B" },
  };
  const info = map[status || "pending"] || map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: info.bg }]}>
      <Text style={[styles.badgeTxt, { color: info.fg }]}>{info.label}</Text>
    </View>
  );
}

function Inner() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [entries, setEntries] = React.useState<EntryItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.organisateurEntries(token);
      setEntries(data);
    } catch (e) {
      console.error(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const onDelete = (id: string) => {
    if (!token) return;
    confirmAction({
      title: "Supprimer",
      message: "Confirmer la suppression de cet événement ?",
      okLabel: "Supprimer",
      cancelLabel: "Annuler",
      destructive: true,
      onConfirm: async () => {
          try {
            await api.organisateurDeleteEntry(token, id);
            reload();
          } catch (e: any) {
            notify("Erreur", e.message || "");
          }
        },
    });
  };

  const isPending = user?.status === "pending";
  const isSuspended = user?.status === "suspended";
  const struct = user?.organizer?.structure_name || user?.name;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-home" onPress={() => router.replace("/")}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>ESPACE ORGANISATEUR</Text>
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

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>{struct?.toUpperCase()}</Text>
        <Text style={styles.title}>
          Mes <Text style={styles.italic}>événements.</Text>
        </Text>

        {isPending && (
          <View style={styles.banner}>
            <Ionicons name="time-outline" size={18} color="#92400E" />
            <Text style={styles.bannerTxt}>
              Compte en attente d&apos;approbation. Vous pouvez soumettre des
              événements mais ils ne seront validés qu&apos;après validation
              de votre compte par l&apos;équipe.
            </Text>
          </View>
        )}
        {isSuspended && (
          <View style={[styles.banner, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="warning-outline" size={18} color="#991B1B" />
            <Text style={[styles.bannerTxt, { color: "#991B1B" }]}>
              Compte suspendu. Contactez l&apos;équipe pour plus d&apos;informations.
            </Text>
          </View>
        )}

        <TouchableOpacity
          testID="create-event-btn"
          style={styles.primary}
          onPress={() => router.push("/organisateur/event/new" as any)}
        >
          <Ionicons name="add" size={18} color={COLORS.primaryText} />
          <Text style={styles.primaryTxt}>SOUMETTRE UN ÉVÉNEMENT</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Tous mes événements</Text>

        {loading ? (
          <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 40 }} />
        ) : entries && entries.length > 0 ? (
          entries.map((e) => (
            <View key={e.id} style={styles.card} testID={`org-entry-${e.id}`}>
              <View style={styles.cardHead}>
                <StatusBadge status={e.status} />
                <Text style={styles.cardDate}>{e.date || "—"}</Text>
              </View>
              <Text style={styles.cardTitle}>{e.title}</Text>
              {!!e.venue && <Text style={styles.cardSub}>{e.venue}</Text>}
              <View style={styles.cardActions}>
                {e.status === "pending" ? (
                  <>
                    <TouchableOpacity
                      testID={`edit-${e.id}`}
                      style={styles.actBtn}
                      onPress={() => router.push(`/organisateur/event/${e.id}` as any)}
                    >
                      <Ionicons name="create-outline" size={14} color={COLORS.primaryText} />
                      <Text style={styles.actTxt}>MODIFIER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`delete-${e.id}`}
                      style={[styles.actBtn, styles.actDanger]}
                      onPress={() => onDelete(e.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#991B1B" />
                      <Text style={[styles.actTxt, { color: "#991B1B" }]}>SUPPRIMER</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.locked}>
                    {e.status === "rejected"
                      ? "Événement refusé par la modération."
                      : "Événement validé — lecture seule."}
                  </Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>
            Aucun événement pour le moment. Cliquez sur &quot;Soumettre un événement&quot; pour commencer.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function OrganisateurDashboard() {
  return (
    <RoleGuard allow={["organisateur"]}>
      <Inner />
    </RoleGuard>
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
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  content: { padding: SPACING.screen, paddingBottom: 80 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    color: COLORS.primaryText,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  banner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 14,
    marginTop: 20,
  },
  bannerTxt: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  primary: {
    marginTop: 24,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    marginTop: 36,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    padding: 14,
    marginBottom: 12,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDate: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.secondaryText,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.primaryText,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  cardSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.secondaryText, marginTop: 4 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  actBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actDanger: { borderColor: "#991B1B" },
  actTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  locked: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    fontStyle: "italic",
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  empty: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 30,
    textAlign: "center",
    fontStyle: "italic",
  },
});
