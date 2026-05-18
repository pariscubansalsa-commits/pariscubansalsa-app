import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryMediaItem } from "./api";
import { COLORS, FONTS } from "./theme";
import { openExternal } from "./links";

const { width: SCREEN_W } = Dimensions.get("window");
const COLS = SCREEN_W >= 700 ? 4 : 3;
const GAP = 4;
const TILE = (SCREEN_W - 32 - GAP * (COLS - 1)) / COLS;

/** Best-effort parse of a YouTube video id from a URL. */
function parseYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/** Best-effort parse of an Instagram shortcode from a post/reel URL. */
function parseInstagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function thumbnailFor(item: EntryMediaItem): string | null {
  if (item.kind === "photo") return item.data;
  // video → try to derive a YouTube thumb
  const yt = parseYouTubeId(item.data);
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  return null;
}

async function openLink(url: string) {
  openExternal(url);
}

/** Download a base64 photo on web by triggering an anchor click. */
function downloadBase64(name: string, data: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = data;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function EntryGallery({
  entryId,
  reloadKey,
}: {
  entryId: string;
  /** Bumped by the parent after an admin upload to force a refresh */
  reloadKey?: number;
}) {
  const [items, setItems] = useState<EntryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listEntryMedia(entryId);
      setItems(data);
    } catch (e) {
      console.log("gallery err", e);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={COLORS.primaryText} />
      </View>
    );
  }

  if (items.length === 0) return null;

  const current = openIdx !== null ? items[openIdx] : null;
  const closeLightbox = () => setOpenIdx(null);
  const next = () =>
    setOpenIdx((i) => (i === null ? null : Math.min(items.length - 1, i + 1)));
  const prev = () =>
    setOpenIdx((i) => (i === null ? null : Math.max(0, i - 1)));

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>GALERIE — {items.length} MÉDIA{items.length > 1 ? "S" : ""}</Text>
      </View>

      <View style={styles.grid}>
        {items.map((it, idx) => {
          const thumb = thumbnailFor(it);
          return (
            <TouchableOpacity
              key={it.id}
              testID={`gallery-tile-${it.id}`}
              activeOpacity={0.85}
              onPress={() => setOpenIdx(idx)}
              style={[styles.tile, { width: TILE, height: TILE }]}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.tileImg} />
              ) : (
                <View style={[styles.tileImg, styles.tileFallback]}>
                  <Ionicons name="film-outline" size={24} color={COLORS.accentYellow} />
                </View>
              )}
              {it.kind === "video" && (
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={14} color={COLORS.primaryText} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        visible={openIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={closeLightbox}
      >
        <View style={styles.lightboxBackdrop}>
          <View style={styles.lightboxTopBar}>
            <Text style={styles.lightboxCount}>
              {openIdx !== null ? `${openIdx + 1} / ${items.length}` : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {!!current && current.kind === "photo" && (
                <TouchableOpacity
                  testID="lightbox-download"
                  onPress={() =>
                    downloadBase64(`pcs-${current.id}.jpg`, current.data)
                  }
                  style={styles.lightboxBtn}
                >
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.lightboxBtnTxt}>TÉLÉCHARGER</Text>
                </TouchableOpacity>
              )}
              {!!current && current.kind === "video" && (
                <TouchableOpacity
                  testID="lightbox-open-video"
                  onPress={() => openLink(current.data)}
                  style={styles.lightboxBtn}
                >
                  <Ionicons name="open-outline" size={18} color="#fff" />
                  <Text style={styles.lightboxBtnTxt}>OUVRIR</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                testID="lightbox-close"
                onPress={closeLightbox}
                style={styles.lightboxBtn}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.lightboxContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {!!current && (
              <View style={styles.mediaWrap}>
                {current.kind === "photo" ? (
                  <Image
                    source={{ uri: current.data }}
                    style={styles.lightboxImg}
                    resizeMode="contain"
                  />
                ) : Platform.OS === "web" ? (
                  (() => {
                    const yt = parseYouTubeId(current.data);
                    const ig = parseInstagramShortcode(current.data);
                    if (yt) {
                      return React.createElement("iframe" as any, {
                        src: `https://www.youtube.com/embed/${yt}?autoplay=0`,
                        width: "100%",
                        height: 480,
                        frameBorder: 0,
                        allow:
                          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                        allowFullScreen: true,
                        style: { border: "none", maxWidth: 720 },
                        title: "Video",
                      });
                    }
                    if (ig) {
                      return React.createElement("iframe" as any, {
                        src: `https://www.instagram.com/p/${ig}/embed/`,
                        width: "100%",
                        height: 560,
                        frameBorder: 0,
                        scrolling: "no",
                        allowTransparency: "true",
                        style: { border: "none", maxWidth: 540 },
                        title: "Instagram",
                      });
                    }
                    return (
                      <TouchableOpacity
                        onPress={() => openLink(current.data)}
                        style={styles.videoFallback}
                      >
                        <Ionicons name="open-outline" size={28} color="#fff" />
                        <Text style={styles.videoFallbackTxt}>OUVRIR LA VIDÉO</Text>
                      </TouchableOpacity>
                    );
                  })()
                ) : (
                  <TouchableOpacity
                    onPress={() => openLink(current.data)}
                    style={styles.videoFallback}
                  >
                    <Ionicons name="open-outline" size={28} color="#fff" />
                    <Text style={styles.videoFallbackTxt}>OUVRIR LA VIDÉO</Text>
                  </TouchableOpacity>
                )}
                {!!current.title && (
                  <Text style={styles.caption}>{current.title}</Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.lightboxNav}>
            <TouchableOpacity
              testID="lightbox-prev"
              onPress={prev}
              disabled={openIdx === 0}
              style={[styles.navBtn, openIdx === 0 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="lightbox-next"
              onPress={next}
              disabled={openIdx === items.length - 1}
              style={[
                styles.navBtn,
                openIdx === items.length - 1 && { opacity: 0.3 },
              ]}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  loaderWrap: { padding: 24, alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  header: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.primaryText,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { backgroundColor: COLORS.surface, position: "relative" },
  tileImg: { width: "100%", height: "100%" },
  tileFallback: {
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.accentYellow,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    paddingTop: Platform.OS === "ios" ? 40 : 16,
  },
  lightboxTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  lightboxCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#fff",
  },
  lightboxBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
  },
  lightboxBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#fff",
  },
  lightboxContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  mediaWrap: { alignItems: "center", maxWidth: "100%" },
  lightboxImg: {
    width: SCREEN_W - 24,
    maxWidth: 900,
    height: SCREEN_W - 24 > 900 ? 900 : SCREEN_W - 24,
  },
  videoFallback: {
    paddingVertical: 60,
    paddingHorizontal: 30,
    borderWidth: 1,
    borderColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  videoFallbackTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: "#fff",
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: "#fff",
    marginTop: 12,
    textAlign: "center",
  },
  lightboxNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 18,
  },
  navBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
  },
});
