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
        <Text style={styles.title}>
          Les soirées en{" "}
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

  // ─── WEB RENDERING ─────────────────────────────────────────────────────
  // We bypass React Native's StyleSheet entirely for the iframe + overlay
  // stacking so CSS properties like `isolation` and explicit `z-index`
  // reach the DOM. This guarantees the overlay sits ABOVE YouTube /
  // Instagram / TikTok iframes on every browser, mobile included.
  if (Platform.OS === "web") {
    const ctaLink = highlight.cta_link || entry?.ticket_link;
    return (
      // @ts-ignore — raw web rendering
      <div
        ref={containerRef as any}
        data-testid={`highlight-card-${highlight.id}`}
        onClick={onCardPress as any}
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: "#111",
          position: "relative",
          flexShrink: 0,
          isolation: "isolate",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Media layer — z-index 0 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            backgroundColor: "#111",
          }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: "none",
                display: "block",
              }}
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="lazy"
            />
          ) : directVideoSrc ? (
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
                display: "block",
              }}
            />
          ) : entry?.cover_photo ? (
            <img
              src={entry.cover_photo}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#111",
                color: COLORS.accentYellow,
                fontFamily: FONTS.heading,
                fontSize: 52,
              }}
            >
              PCS
            </div>
          )}
        </div>

        {/* Partner badge — z-index 3 */}
        {highlight.is_sponsored && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 3,
              backgroundColor: COLORS.accentYellow,
              padding: "3px 6px",
              borderRadius: 40,
              pointerEvents: "none",
            }}
          >
            <Ionicons name="heart" size={10} color={COLORS.primaryText} />
            <span
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 8,
                letterSpacing: 0.9,
                color: COLORS.primaryText,
              }}
            >
              PARTENAIRE
            </span>
          </div>
        )}

        {/* Mute toggle — z-index 3 */}
        {!embedUrl && directVideoSrc && (
          <div
            onClick={toggleMute as any}
            data-testid={`highlight-mute-${highlight.id}`}
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 3,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Ionicons
              name={muted ? "volume-mute" : "volume-high"}
              size={14}
              color="#fff"
            />
          </div>
        )}

        {/* Bottom overlay — z-index 10 (guaranteed above iframes) */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: 12,
            paddingTop: 22,
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.2) 100%)",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontFamily: FONTS.heading,
                fontSize: 16,
                lineHeight: "19px",
                color: "#fff",
                letterSpacing: -0.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {entry?.title || "Sans titre"}
            </div>
            {!!dateLabel && (
              <div
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 9,
                  letterSpacing: 0.9,
                  color: "rgba(255,255,255,0.85)",
                  marginTop: 4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {dateLabel}
                {entry?.venue ? ` · ${entry.venue}` : ""}
              </div>
            )}
          </div>
          {ctaLink && (
            <div
              onClick={onCtaPress as any}
              data-testid={`highlight-cta-${highlight.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                backgroundColor: COLORS.accentYellow,
                padding: "7px 10px",
                borderRadius: 40,
                cursor: "pointer",
              }}
            >
              <Ionicons name="ticket" size={12} color={COLORS.primaryText} />
              <span
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 10,
                  letterSpacing: 1.1,
                  color: COLORS.primaryText,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {highlight.cta_text || "ACHETER LE TICKET"}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── NATIVE FALLBACK (rarely used — the app ships as PWA) ────────────
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
  section: { marginTop: 24, marginBottom: 4 },
  header: { paddingHorizontal: 0, marginBottom: 12 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: COLORS.primaryText,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
    position: "relative",
    // @ts-ignore RN-Web: force a stacking context so children z-index works
    // reliably above embedded iframes (YouTube/Instagram/TikTok).
    transform: [{ translateZ: 0 } as any],
    isolation: "isolate" as any,
  },
  videoLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: "#111", zIndex: 0 },
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
    zIndex: 3,
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
    zIndex: 3,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 22,
    // Strong dark gradient via stacked rgba so the overlay text is readable
    // even on top of bright video content (YouTube TV thumbnails, etc.).
    backgroundColor: "rgba(0,0,0,0.78)",
    zIndex: 5,
    // @ts-ignore RN-Web: ensure it sits in its own GPU layer above iframes
    transform: [{ translateZ: 0 } as any],
    boxShadow: "0 -8px 20px rgba(0,0,0,0.45)" as any,
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
