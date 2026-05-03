import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import { COLORS, FONTS } from "../../src/theme";

export default function Festivals() {
  return (
    <EntriesScreen
      type="festival"
      overline="FESTIVALS FR & EUROPE"
      headline={
        <>
          Les grands{" "}
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontStyle: "italic",
              color: COLORS.accentYellow,
            }}
          >
            rendez-vous.
          </Text>
        </>
      }
      subtitle="Calendrier des festivals de salsa cubaine en France et en Europe. Réservez vos vacances dansantes."
      showDanceStyleFilter
    />
  );
}
