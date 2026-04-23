import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { COLORS, FONTS } from "./theme";

export function Logo({ size = 15 }: { size?: number }) {
  const badgeSize = size * 2.2;
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
          },
        ]}
      >
        <Text style={[styles.badgeTxt, { fontSize: size * 0.72 }]}>PCS</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.word, { fontSize: size }]}>Paris Cuban </Text>
        <Text
          style={[
            styles.word,
            styles.italic,
            { fontSize: size, color: COLORS.accentYellow },
          ]}
        >
          Salsa
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: {
    color: COLORS.accentYellow,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
  },
  textWrap: { flexDirection: "row", alignItems: "baseline" },
  word: {
    color: COLORS.primaryText,
    fontFamily: FONTS.heading,
    letterSpacing: -0.3,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
  },
});
