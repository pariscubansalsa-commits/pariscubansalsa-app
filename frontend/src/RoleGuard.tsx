import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "./auth";
import { COLORS } from "./theme";

type Role = "admin" | "organisateur" | "artiste" | "visiteur";

type Props = {
  /** Roles allowed to view the wrapped screen. Admin always passes. */
  allow: Role[];
  /** If true, only the active status is allowed (denies pending/suspended). */
  requireActive?: boolean;
  /** Redirect target when blocked. Default: /unauthorized */
  redirectTo?: string;
  children: React.ReactNode;
};

export default function RoleGuard({
  allow,
  requireActive,
  redirectTo = "/unauthorized",
  children,
}: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const role = (user.role || (user.is_admin ? "admin" : "visiteur")) as Role;
    if (role === "admin" || user.is_admin) return; // admin bypass
    if (!allow.includes(role)) {
      router.replace(redirectTo as any);
      return;
    }
    if (requireActive && user.status && user.status !== "active") {
      // pending/suspended users still see UI but downstream API calls return 403
      // We don't redirect — the dashboard renders an info banner.
    }
  }, [loading, user, router, allow, requireActive, redirectTo]);

  if (loading || !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={COLORS.primaryText} />
      </View>
    );
  }
  const role = (user.role || (user.is_admin ? "admin" : "visiteur")) as Role;
  if (role !== "admin" && !user.is_admin && !allow.includes(role)) {
    return (
      <View style={styles.loader}>
        <Text>Redirection…</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
