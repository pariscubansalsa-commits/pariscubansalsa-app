import React from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "./theme";
import { openExternal } from "./links";

/**
 * Parse an Instagram post URL and return the shortcode (e.g. CmHpAaNL_q5).
 * Accepts URLs like:
 *   https://www.instagram.com/p/XXXX/
 *   https://www.instagram.com/reel/XXXX/
 *   https://www.instagram.com/tv/XXXX/
 */
function parseInstagramShortcode(url: string): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

const openLink = (url: string) => openExternal(url);

export default function InstagramEmbed({ url }: { url: string }) {
  const code = parseInstagramShortcode(url);
  if (!code) return null;
  const embedUrl = `https://www.instagram.com/p/${code}/embed/`;

  // On web, render an iframe. On native, render a fallback CTA opening the link.
  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <Ionicons name="logo-instagram" size={16} color={COLORS.primaryText} />
          <Text style={styles.header}>POST INSTAGRAM</Text>
        </View>
        <View style={styles.frameWrap}>
          {React.createElement("iframe" as any, {
            src: embedUrl,
            width: "100%",
            height: 560,
            frameBorder: 0,
            scrolling: "no",
            allowTransparency: "true",
            allow: "encrypted-media",
            style: { border: "none", display: "block", borderRadius: 10 },
            title: "Instagram post",
          })}
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.fallback} onPress={() => openLink(url)}>
      <Ionicons name="logo-instagram" size={18} color={COLORS.primaryText} />
      <Text style={styles.fallbackTxt}>VOIR LE POST INSTAGRAM</Text>
      <Ionicons name="open-outline" size={14} color={COLORS.primaryText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#FAFAFA",
  },
  header: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  frameWrap: {
    width: "100%",
    minHeight: 560,
    backgroundColor: "#fff",
  },
  fallback: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    borderRadius: 40,
  },
  fallbackTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
});
