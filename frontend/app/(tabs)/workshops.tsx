import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import { COLORS, FONTS } from "../../src/theme";

export default function Workshops() {
  return (
    <EntriesScreen
      type="workshop"
      overline="STAGES & FORMATIONS"
      headline={
        <>
          Workshops{" "}
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontStyle: "italic",
              color: COLORS.accentYellow,
            }}
          >
            à venir.
          </Text>
        </>
      }
      subtitle="Cours intensifs, stages d'un week-end, masterclasses avec les meilleurs profs de salsa cubaine."
    />
  );
}
