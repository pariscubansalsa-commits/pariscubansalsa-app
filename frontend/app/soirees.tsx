// Public deep-link alias for the home "Soirées" feed. Useful for sharing
// a clean URL on Instagram/WhatsApp ("pariscubansalsa.com/soirees" reads
// better than "pariscubansalsa.com/"). Renders the same content as `/`.
import React from "react";
import { Redirect } from "expo-router";

export default function SoireesAlias() {
  return <Redirect href="/" />;
}
