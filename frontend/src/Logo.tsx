import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { COLORS, FONTS } from "./theme";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.txt, { fontSize: size, fontFamily: FONTS.heading }]}>
        Paris Cuban{" "}
      </Text>
      <Text
        style={[
          styles.txt,
          {
            fontSize: size,
            color: COLORS.accentYellow,
            fontFamily: FONTS.headingItalic,
            fontStyle: "italic",
          },
        ]}
      >
        Salsa
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline" },
  txt: { color: COLORS.primaryText, letterSpacing: -0.5 },
});
