import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "./api";
import { COLORS, FONTS, SPACING } from "./theme";
import { openExternal } from "./links";
import { track } from "./analytics";

type Highlight = {
  id: string;
  entry_id: string;
  video_url?: string;
  video_file?: string;
  is_sponsored?: boolean;
  cta_text?: string;
  cta_link?: string;
  active?: boolean;
  order?: number;
  entry?: {
    id: string;
    title: string;
    date: string;
    end_date?: string | null;
    venue?: string;
    type?: string;
    ticket_link?: string;
    cover_photo?: string;
  };
};

const CARD_W = 220;
const CARD_H = Math.round(CARD_W * (16 / 9)); // ~391

const MONTHS = [
  "JANV.", "FÉVR.", "MARS", "AVRIL", "MAI", "JUIN",
  "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC.",
];
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// ────────────────────────────────────────────────────────────────────────────
// External embed detection — returns an iframe URL or null if it's a direct
// video file we can play with <video>.
// ────────────────────────────────────────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube (short or full)
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) {
    return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0&playsinline=1`;
  }
  // Instagram reel / post
  m = url.match(/instagram\.com\/(?:reel|p|tv)\/([\w-]+)/);
  if (m) {
    return `https://www.instagram.com/p/${m[1]}/embed/`;
  }
  // TikTok video
  m = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (m) {
    return `https://www.tiktok.com/embed/v2/${m[1]}`;
  }
  return null;
}

export default function HighlightsCarousel() {
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listHighlights();
        setItems(data || []);
      } catch (e) {
        console.log("highlights err", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <View style={styles.section} testID="highlights-carousel">
      <View style={styles.header}>
        <Text style={styles.overline}>HIGHLIGHTS 🎬</Text>
        <Text style={styles.title}>
          Le mois en{" "}
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontStyle: "italic",
              color: COLORS.accentYellow,
            }}
          >
            vidéo.
          </Text>
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SPACING.screen,
          gap: 12,
        }}
        style={{ marginHorizontal: -SPACING.screen }}
      >
        {items.map((h) => (
          <HighlightCard key={h.id} highlight={h} />
        ))}
      </ScrollView>
    </View>
  );
}

function HighlightCard({ highlight }: { highlight: Highlight }) {
  const router = useRouter();
  const containerRef = useRef<View>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [visible, setVisible] = useState(false);

  // IntersectionObserver — autoplay only when visible (web only — RN Native
  // doesn't support raw <video>, but we run as a PWA so always web).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    // @ts-ignore RN web compatibility
    const el = (containerRef.current as any)?._nativeTag
      ? null
      : (containerRef.current as any as HTMLElement | null);
    // RN web → containerRef is the underlying div directly
    const node = (el || (containerRef.current as any)) as HTMLElement | null;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          setVisible(en.isIntersecting && en.intersectionRatio > 0.5);
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Drive the <video> element when visibility changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [visible]);

  const onCardPress = () => {
    if (highlight.entry) {
      track("click_highlight", {
        entry_id: highlight.entry.id,
        extra: { sponsored: !!highlight.is_sponsored },
      });
      router.push(`/entry/${highlight.entry.id}` as any);
    }
  };

  const onCtaPress = (e: any) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    const link = highlight.cta_link || highlight.entry?.ticket_link;
    if (!link) return;
    track("click_highlight_cta", {
      entry_id: highlight.entry?.id || highlight.entry_id,
      extra: { sponsored: !!highlight.is_sponsored },
    });
    openExternal(link);
  };

  const toggleMute = (e: any) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  };

  const embedUrl = highlight.video_url ? getEmbedUrl(highlight.video_url) : null;
  const directVideoSrc = highlight.video_file || (!embedUrl ? highlight.video_url : "");
  const entry = highlight.entry;
  const dateLabel = entry
    ? entry.end_date && entry.end_date !== entry.date
      ? `${formatDate(entry.date)} – ${formatDate(entry.end_date)}`
      : formatDate(entry.date)
    : "";

  return (
    <TouchableOpacity
      ref={containerRef as any}
      onPress={onCardPress}
      activeOpacity={0.92}
      testID={`highlight-card-${highlight.id}`}
      style={styles.card}
    >
      {/* Video layer */}
      <View style={styles.videoLayer}>
        {Platform.OS === "web" ? (
          embedUrl ? (
            // External embed via iframe (YouTube/IG/TikTok)
            // @ts-ignore — web-only element
            <iframe
              src={embedUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: "none", // let the card capture taps
              }}
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="lazy"
            />
          ) : directVideoSrc ? (
            // Direct MP4 (uploaded or external file)
            // @ts-ignore — web-only element
            <video
              ref={videoRef as any}
              src={directVideoSrc}
              muted={muted}
              autoPlay
              loop
              playsInline
              preload="metadata"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : entry?.cover_photo ? (
            // @ts-ignore web img
            <img
              src={entry.cover_photo}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              alt=""
            />
          ) : (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTxt}>PCS</Text>
            </View>
          )
        ) : (
          // Native RN fallback (shouldn't trigger — app is PWA-only)
          <View style={styles.fallback}>
            <Text style={styles.fallbackTxt}>PCS</Text>
          </View>
        )}
      </View>

      {/* Top-right partner badge */}
      {highlight.is_sponsored && (
        <View style={styles.partnerBadge} pointerEvents="none">
          <Ionicons name="heart" size={10} color={COLORS.primaryText} />
          <Text style={styles.partnerTxt}>PARTENAIRE</Text>
        </View>
      )}

      {/* Mute toggle (only relevant for direct video — embeds ignore it) */}
      {Platform.OS === "web" && !embedUrl && directVideoSrc && (
        <TouchableOpacity
          onPress={toggleMute}
          style={styles.muteBtn}
          testID={`highlight-mute-${highlight.id}`}
          hitSlop={6}
        >
          <Ionicons
            name={muted ? "volume-mute" : "volume-high"}
            size={14}
            color="#fff"
          />
        </TouchableOpacity>
      )}

      {/* Bottom overlay with title + date + venue + CTA */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.overlayInfo} pointerEvents="none">
          <Text style={styles.cardTitle} numberOfLines={2}>
            {entry?.title || "Sans titre"}
          </Text>
          {!!dateLabel && (
            <Text style={styles.cardMeta}>
              {dateLabel}
              {entry?.venue ? ` · ${entry.venue}` : ""}
            </Text>
          )}
        </View>
        {(highlight.cta_link || entry?.ticket_link) && (
          <TouchableOpacity
            onPress={onCtaPress}
            style={styles.ctaBtn}
            testID={`highlight-cta-${highlight.id}`}
            activeOpacity={0.85}
          >
            <Ionicons name="ticket" size={12} color={COLORS.primaryText} />
            <Text style={styles.ctaTxt} numberOfLines={1}>
              {highlight.cta_text || "ACHETER LE TICKET"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, marginBottom: 8 },
  header: { paddingHorizontal: 0, marginBottom: 14 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: COLORS.primaryText,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
    position: "relative",
  },
  videoLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: "#111" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  fallbackTxt: {
    fontFamily: FONTS.heading,
    fontSize: 52,
    color: COLORS.accentYellow,
  },
  partnerBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 40,
  },
  partnerTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    letterSpacing: 0.9,
    color: COLORS.primaryText,
  },
  muteBtn: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    // Soft gradient via stacked rgba — RN web supports linear-gradient via style
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayInfo: { marginBottom: 8 },
  cardTitle: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    lineHeight: 19,
    color: "#fff",
    letterSpacing: -0.2,
  },
  cardMeta: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 0.9,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 40,
  },
  ctaTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: COLORS.primaryText,
  },
});
