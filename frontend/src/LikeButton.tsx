import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "./api";
import { COLORS, FONTS } from "./theme";
import { track } from "./analytics";

// ───────────────────────────── localStorage helpers ──────────────────────────
// We store the SET of liked entry IDs in localStorage so the heart stays
// filled on revisit. Pure-web, but the app ships as PWA so no native fallback
// is required (AsyncStorage would be plugged here for native).
const STORAGE_KEY = "pcs_likes";

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readLikedSet(): Set<string> {
  const s = safeStorage();
  if (!s) return new Set();
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeLikedSet(set: Set<string>): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* quota or private-mode — ignore */
  }
}

// Notify other LikeButton instances on the same page when the liked-set
// changes so siblings refresh their filled/empty state without a reload.
const LIKE_EVENT = "pcs:like-changed";
function broadcastLikeChange(entryId: string, liked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(LIKE_EVENT, { detail: { entryId, liked } })
    );
  } catch {
    /* old browsers */
  }
}

export function hasLiked(entryId: string): boolean {
  return readLikedSet().has(entryId);
}

// ──────────────────────────────── component ──────────────────────────────────
export type LikeButtonProps = {
  entryId: string;
  initialCount?: number;
  size?: "small" | "medium" | "large";
  /** Stops parent press handlers (cards) from firing when the heart is tapped. */
  stopPropagation?: boolean;
};

const SIZE_MAP = {
  small: { icon: 13, font: 11, padV: 4, padH: 7, gap: 4 },
  medium: { icon: 16, font: 13, padV: 6, padH: 9, gap: 5 },
  large: { icon: 22, font: 15, padV: 9, padH: 14, gap: 7 },
} as const;

export default function LikeButton({
  entryId,
  initialCount = 0,
  size = "small",
  stopPropagation = true,
}: LikeButtonProps) {
  const [liked, setLiked] = useState<boolean>(() => hasLiked(entryId));
  const [count, setCount] = useState<number>(Math.max(0, initialCount));
  const [pending, setPending] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const dims = SIZE_MAP[size];

  // Keep local count in sync when parent re-renders with a fresh number
  // (e.g., a list refetches after a screen focus).
  useEffect(() => {
    setCount(Math.max(0, initialCount));
  }, [initialCount]);

  // Listen for sibling LikeButtons changing the same entry (rare but
  // happens when a card AND its detail screen are mounted).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = (e: any) => {
      if (e?.detail?.entryId === entryId) {
        setLiked(!!e.detail.liked);
      }
    };
    window.addEventListener(LIKE_EVENT, onChange as any);
    return () => window.removeEventListener(LIKE_EVENT, onChange as any);
  }, [entryId]);

  const bounce = useCallback(() => {
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.35,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);

  const onPress = useCallback(
    async (e?: any) => {
      if (stopPropagation && e && typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }
      if (pending) return;
      setPending(true);

      const wasLiked = liked;
      const nextLiked = !wasLiked;

      // Optimistic UI ----------------------------------------------------
      setLiked(nextLiked);
      setCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
      const stored = readLikedSet();
      if (nextLiked) stored.add(entryId);
      else stored.delete(entryId);
      writeLikedSet(stored);
      broadcastLikeChange(entryId, nextLiked);
      if (nextLiked) bounce();

      try {
        const res = nextLiked
          ? await api.likeEntry(entryId)
          : await api.unlikeEntry(entryId);
        // Reconcile with server-side total
        if (typeof res?.likes === "number") setCount(res.likes);
        track(nextLiked ? "like_entry" : "unlike_entry", {
          entry_id: entryId,
        });
      } catch (err: any) {
        // 429 (rate-limit) — undo optimistic update.
        const msg = String(err?.message || "");
        if (msg.startsWith("429")) {
          setLiked(wasLiked);
          setCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
          const back = readLikedSet();
          if (wasLiked) back.add(entryId);
          else back.delete(entryId);
          writeLikedSet(back);
          broadcastLikeChange(entryId, wasLiked);
        } else {
          // Network error — keep local state but log.
          // eslint-disable-next-line no-console
          console.log("likeEntry err", err);
        }
      } finally {
        setPending(false);
      }
    },
    [entryId, liked, pending, stopPropagation, bounce]
  );

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Retirer le like" : "Liker"}
      testID={`like-button-${entryId}`}
      style={({ pressed }) => [
        styles.btn,
        {
          paddingVertical: dims.padV,
          paddingHorizontal: dims.padH,
          gap: dims.gap,
          opacity: pressed ? 0.85 : 1,
        },
        liked ? styles.btnActive : styles.btnIdle,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={dims.icon}
          color={liked ? COLORS.accentYellow : COLORS.secondaryText}
        />
      </Animated.View>
      <Text
        style={[
          styles.count,
          { fontSize: dims.font, color: liked ? COLORS.primaryText : COLORS.secondaryText },
        ]}
        numberOfLines={1}
      >
        {count}
      </Text>
    </Pressable>
  );
}

// Compact, inline display only — meant to live next to a "date · venue" row
// on a card. Looks like a small pill: [♡ 12].
const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 40,
    borderWidth: 1,
    // Use a transparent background by default — the parent card controls bg.
    backgroundColor: "transparent",
  },
  btnIdle: {
    borderColor: COLORS.border,
  },
  btnActive: {
    borderColor: COLORS.accentYellow,
    backgroundColor: "rgba(245,197,24,0.10)",
  },
  count: {
    fontFamily: FONTS.bodyBold,
    letterSpacing: 0.3,
  },
});

// Allow callers to subtly wrap the button in a row with extra meta.
export const LikeRow = ({ children }: { children: React.ReactNode }) => (
  <View style={rowStyles.row}>{children}</View>
);
const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
