import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RoleGuard from "../../src/RoleGuard";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { COLORS, FONTS, SPACING } from "../../src/theme";

type UserRow = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  organizer?: { structure_name?: string } | null;
  artist_teacher_id?: string | null;
  pending_artist_claim?: any;
  submitted_entries?: number;
  pending_entries?: number;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "#D1FAE5", fg: "#065F46", label: "ACTIF" },
    pending: { bg: "#FEF3C7", fg: "#92400E", label: "EN ATTENTE" },
    suspended: { bg: "#FEE2E2", fg: "#991B1B", label: "SUSPENDU" },
  };
  const info = map[status] || map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: info.bg }]}>
      <Text style={[styles.badgeTxt, { color: info.fg }]}>{info.label}</Text>
    </View>
  );
}

function Inner() {
  const router = useRouter();
  const { token } = useAuth();
  const [tab, setTab] = React.useState<"organisateurs" | "artistes">("organisateurs");
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const role = tab === "organisateurs" ? "organisateur" : "artiste";
      const data = await api.adminListUsers(token, { role });
      setUsers(data as any);
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "");
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const onApproveOrg = (u: UserRow) => {
    if (!token) return;
    Alert.alert("Approuver", `Approuver le compte de ${u.organizer?.structure_name || u.name} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Approuver",
        onPress: async () => {
          try {
            await api.adminApproveOrganizer(token, u.user_id);
            reload();
          } catch (e: any) {
            Alert.alert("Erreur", e.message || "");
          }
        },
      },
    ]);
  };

  const onSuspend = (u: UserRow) => {
    if (!token) return;
    Alert.alert("Suspendre", `Suspendre le compte ${u.email} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Suspendre",
        style: "destructive",
        onPress: async () => {
          try {
            await api.adminSuspendUser(token, u.user_id);
            reload();
          } catch (e: any) {
            Alert.alert("Erreur", e.message || "");
          }
        },
      },
    ]);
  };

  const onReactivate = (u: UserRow) => {
    if (!token) return;
    (async () => {
      try {
        await api.adminReactivateUser(token, u.user_id);
        reload();
      } catch (e: any) {
        Alert.alert("Erreur", e.message || "");
      }
    })();
  };

  const onApproveArtist = (u: UserRow) => {
    if (!token) return;
    const claim = u.pending_artist_claim || {};
    if (claim.teacher_id) {
      Alert.alert(
        "Valider le rattachement",
        `Lier ${u.email} à la fiche "${claim.teacher_name || claim.teacher_id}" ?`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Valider",
            onPress: async () => {
              try {
                await api.adminApproveArtist(token, u.user_id, { teacher_id: claim.teacher_id });
                reload();
              } catch (e: any) {
                Alert.alert("Erreur", e.message || "");
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Création de fiche requise",
        `Cet artiste a demandé la création d'une nouvelle fiche : "${claim.requested_name || "?"}".\n\nCréez d'abord la fiche dans /admin/teachers, puis rouvrez cette page pour la lier.`,
        [{ text: "OK" }]
      );
    }
  };

  const onRejectArtist = (u: UserRow) => {
    if (!token) return;
    Alert.alert("Refuser la demande", `Refuser le claim de ${u.email} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Refuser",
        style: "destructive",
        onPress: async () => {
          try {
            await api.adminRejectArtist(token, u.user_id);
            reload();
          } catch (e: any) {
            Alert.alert("Erreur", e.message || "");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-admin" onPress={() => router.replace("/admin" as any)}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>UTILISATEURS</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          testID="tab-organisateurs"
          style={[styles.tab, tab === "organisateurs" && styles.tabActive]}
          onPress={() => setTab("organisateurs")}
        >
          <Text style={[styles.tabTxt, tab === "organisateurs" && styles.tabTxtActive]}>
            ORGANISATEURS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-artistes"
          style={[styles.tab, tab === "artistes" && styles.tabActive]}
          onPress={() => setTab("artistes")}
        >
          <Text style={[styles.tabTxt, tab === "artistes" && styles.tabTxtActive]}>ARTISTES</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 40 }} />
        ) : users.length === 0 ? (
          <Text style={styles.empty}>Aucun {tab === "organisateurs" ? "organisateur" : "artiste"} pour le moment.</Text>
        ) : (
          users.map((u) => (
            <View key={u.user_id} style={styles.card} testID={`user-${u.user_id}`}>
              <View style={styles.cardHead}>
                <StatusBadge status={u.status} />
                {(u.submitted_entries ?? 0) > 0 && (
                  <Text style={styles.metaTxt}>
                    {u.submitted_entries} évts · {u.pending_entries ?? 0} en attente
                  </Text>
                )}
              </View>
              <Text style={styles.cardTitle}>
                {tab === "organisateurs" ? u.organizer?.structure_name || u.name : u.name}
              </Text>
              <Text style={styles.cardEmail}>{u.email}</Text>

              {tab === "artistes" && u.pending_artist_claim && (
                <View style={styles.claimBox}>
                  {u.pending_artist_claim.teacher_id ? (
                    <Text style={styles.claimTxt}>
                      Souhaite être lié à : {u.pending_artist_claim.teacher_name || u.pending_artist_claim.teacher_id}
                    </Text>
                  ) : (
                    <Text style={styles.claimTxt}>
                      Demande la création d&apos;une fiche : &quot;{u.pending_artist_claim.requested_name || "?"}&quot;
                    </Text>
                  )}
                  {!!u.pending_artist_claim.message && (
                    <Text style={styles.claimMsg}>« {u.pending_artist_claim.message} »</Text>
                  )}
                </View>
              )}
              {tab === "artistes" && u.artist_teacher_id && u.status === "active" && (
                <Text style={styles.linkedTxt}>Lié à la fiche : {u.artist_teacher_id}</Text>
              )}

              <View style={styles.actions}>
                {tab === "organisateurs" && u.status === "pending" && (
                  <TouchableOpacity
                    testID={`approve-org-${u.user_id}`}
                    style={[styles.actBtn, styles.actPrimary]}
                    onPress={() => onApproveOrg(u)}
                  >
                    <Text style={styles.actPrimaryTxt}>APPROUVER</Text>
                  </TouchableOpacity>
                )}
                {tab === "artistes" && u.status === "pending" && (
                  <>
                    <TouchableOpacity
                      testID={`approve-art-${u.user_id}`}
                      style={[styles.actBtn, styles.actPrimary]}
                      onPress={() => onApproveArtist(u)}
                    >
                      <Text style={styles.actPrimaryTxt}>VALIDER LE CLAIM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`reject-art-${u.user_id}`}
                      style={[styles.actBtn, { borderColor: "#991B1B" }]}
                      onPress={() => onRejectArtist(u)}
                    >
                      <Text style={[styles.actTxt, { color: "#991B1B" }]}>REFUSER</Text>
                    </TouchableOpacity>
                  </>
                )}
                {u.status === "active" && (
                  <TouchableOpacity
                    testID={`suspend-${u.user_id}`}
                    style={[styles.actBtn, { borderColor: "#991B1B" }]}
                    onPress={() => onSuspend(u)}
                  >
                    <Text style={[styles.actTxt, { color: "#991B1B" }]}>SUSPENDRE</Text>
                  </TouchableOpacity>
                )}
                {u.status === "suspended" && (
                  <TouchableOpacity
                    testID={`reactivate-${u.user_id}`}
                    style={styles.actBtn}
                    onPress={() => onReactivate(u)}
                  >
                    <Text style={styles.actTxt}>RÉACTIVER</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AdminUsers() {
  return (
    <RoleGuard allow={["admin"]}>
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
  topTitle: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5, color: COLORS.primaryText },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: COLORS.accentYellow },
  tabTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: COLORS.secondaryText },
  tabTxtActive: { color: COLORS.primaryText },
  content: { padding: SPACING.screen, paddingBottom: 80 },
  card: { borderWidth: 1, borderColor: COLORS.primaryText, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: FONTS.heading, fontSize: 18, color: COLORS.primaryText, marginTop: 8, letterSpacing: -0.3 },
  cardEmail: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
  metaTxt: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.secondaryText },
  claimBox: { marginTop: 10, padding: 10, backgroundColor: COLORS.surface, borderLeftWidth: 3, borderLeftColor: COLORS.accentYellow },
  claimTxt: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.primaryText },
  claimMsg: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.secondaryText, marginTop: 4, fontStyle: "italic" },
  linkedTxt: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.secondaryText, marginTop: 6, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  actBtn: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actPrimary: { backgroundColor: COLORS.accentYellow },
  actTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: COLORS.primaryText },
  actPrimaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: COLORS.primaryText },
  badge: { paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1 },
  empty: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.secondaryText, marginTop: 40, textAlign: "center", fontStyle: "italic" },
});
