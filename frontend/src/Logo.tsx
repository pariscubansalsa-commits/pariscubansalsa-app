import React from "react";
import { Text, StyleSheet, View, Image } from "react-native";
import { COLORS, FONTS } from "./theme";

export function Logo({ size = 15 }: { size?: number }) {
  const badgeSize = size * 2.6;
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
        <Image
          source={require("../assets/images/pcs-logo.png")}
          style={styles.badgeImg}
          resizeMode="contain"
        />
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  badgeImg: {
    width: "85%",
    height: "85%",
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
