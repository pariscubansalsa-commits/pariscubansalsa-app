/**
 * Country → flag emoji + ISO-3166 alpha-2 code mapping for festival cards
 * and the country filter chips.
 *
 * Keys are normalized (lowercased + accents stripped) so callers don't have
 * to worry about input casing or diacritics.
 */

export type CountryInfo = {
  code: string; // 2-letter ISO code, used as both filter key and badge label
  flag: string; // emoji flag (uses regional indicator chars)
  label: string; // canonical French display name (preserve accents)
};

// Canonical list. Order matters for the filter chips — keep the most common
// PCS destinations at the top, then sort alphabetically.
const RAW: CountryInfo[] = [
  { code: "FR", flag: "🇫🇷", label: "France" },
  { code: "ES", flag: "🇪🇸", label: "Espagne" },
  { code: "DE", flag: "🇩🇪", label: "Allemagne" },
  { code: "PT", flag: "🇵🇹", label: "Portugal" },
  { code: "HR", flag: "🇭🇷", label: "Croatie" },
  { code: "PL", flag: "🇵🇱", label: "Pologne" },
  { code: "DK", flag: "🇩🇰", label: "Danemark" },
  { code: "GR", flag: "🇬🇷", label: "Grèce" },
  { code: "NO", flag: "🇳🇴", label: "Norvège" },
  { code: "US", flag: "🇺🇸", label: "USA" },
  { code: "UK", flag: "🇬🇧", label: "UK" },
  { code: "CA", flag: "🇨🇦", label: "Canada" },
  { code: "TN", flag: "🇹🇳", label: "Tunisie" },
  { code: "AT", flag: "🇦🇹", label: "Autriche" },
  { code: "SE", flag: "🇸🇪", label: "Suède" },
  { code: "RS", flag: "🇷🇸", label: "Serbie" },
  { code: "HU", flag: "🇭🇺", label: "Hongrie" },
  { code: "SK", flag: "🇸🇰", label: "Slovaquie" },
  { code: "ID", flag: "🇮🇩", label: "Indonésie" },
  { code: "NL", flag: "🇳🇱", label: "Pays-Bas" },
  { code: "CU", flag: "🇨🇺", label: "Cuba" },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .trim();
}

// Build a lookup map: many synonyms / casings → CountryInfo
const LOOKUP = new Map<string, CountryInfo>();
for (const c of RAW) {
  LOOKUP.set(normalize(c.label), c);
  LOOKUP.set(c.code.toLowerCase(), c);
}
// A few extra English spellings often found in scraped data
const ALIASES: Record<string, string> = {
  spain: "ES",
  germany: "DE",
  greece: "GR",
  poland: "PL",
  croatia: "HR",
  denmark: "DK",
  norway: "NO",
  sweden: "SE",
  serbia: "RS",
  hungary: "HU",
  slovakia: "SK",
  indonesia: "ID",
  netherlands: "NL",
  tunisia: "TN",
  austria: "AT",
  portugal: "PT",
  france: "FR",
  cuba: "CU",
  "united kingdom": "UK",
  "great britain": "UK",
  "united states": "US",
  "united states of america": "US",
  "états-unis": "US",
};
for (const [alias, code] of Object.entries(ALIASES)) {
  const c = RAW.find((x) => x.code === code);
  if (c) LOOKUP.set(normalize(alias), c);
}

const UNKNOWN: CountryInfo = { code: "??", flag: "🌍", label: "?" };

/** Resolve a (possibly messy) country string to its CountryInfo, or a
 *  fallback `{ code: "??", flag: "🌍" }` if not recognized. */
export function getCountryInfo(input?: string | null): CountryInfo {
  if (!input) return UNKNOWN;
  const hit = LOOKUP.get(normalize(input));
  return hit || UNKNOWN;
}

/** Canonical list of countries known to PCS, in display order. */
export const KNOWN_COUNTRIES: CountryInfo[] = RAW;
