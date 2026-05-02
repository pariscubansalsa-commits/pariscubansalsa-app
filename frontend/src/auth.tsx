import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { api } from "./api";

type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin: boolean;
  role?: "admin" | "organisateur" | "artiste" | "visiteur";
  status?: "active" | "pending" | "suspended";
  organizer?: {
    structure_name?: string;
    motivation?: string;
    phone?: string;
    website?: string;
  } | null;
  artist_teacher_id?: string | null;
  pending_artist_claim?: any;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
  setSession: (data: any) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  token: null,
  setSession: async () => {},
  refresh: async () => {},
  logout: async () => {},
});

const TOKEN_KEY = "pcs_session_token";

function getStoredToken(): string | null {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

function setStoredToken(t: string | null) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = getStoredToken();
      const me = await api.authMe(t || undefined);
      setUser(me);
      setToken(t);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If landing via Emergent auth callback, skip /me; AuthCallback will handle it.
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.location.hash?.includes("session_id=")
    ) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const setSession = async (data: any) => {
    setStoredToken(data.session_token);
    setToken(data.session_token);
    setUser({
      user_id: data.user_id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      is_admin: data.is_admin,
    });
    setLoading(false);
  };

  const logout = async () => {
    try {
      await api.logout(token || undefined);
    } catch {}
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, token, setSession, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
