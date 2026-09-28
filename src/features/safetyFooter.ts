// Country-aware safety footer for Gentle Corner (CLAUDE.md rule 9). Lists only numbers that
// have been verified. Everywhere else: local emergency number plus findahelpline.com.
// Never add a number here without verifying it first.

export interface SafetyFooter {
  country: string | null;
  lines: string[];
}

const VERIFIED: Record<string, { name: string; lines: string[] }> = {
  GB: { name: 'United Kingdom', lines: ['999 for emergencies', 'Samaritans 116 123, any time'] },
  US: { name: 'United States', lines: ['911 for emergencies', '988 Suicide & Crisis Lifeline, call or text'] },
  CA: { name: 'Canada', lines: ['911 for emergencies', '988 Suicide Crisis Helpline, call or text'] },
  AU: { name: 'Australia', lines: ['000 for emergencies', 'Lifeline 13 11 14, any time'] },
};

export const FIND_A_HELPLINE = 'https://findahelpline.com';

/**
 * The region written explicitly in a language tag ("en-GB", "hi-IN"). Never guessed from the
 * language alone ("en" could be anywhere).
 */
export function regionFromLocale(tag: string): string | null {
  try {
    // Intl canonicalises the region (upper case, and "UK" becomes "GB").
    return new Intl.Locale(tag.replace('_', '-')).region ?? null;
  } catch {
    return null;
  }
}

/** Uses the browser's own language settings only. Nothing is looked up over the network. */
export function safetyFooter(languages: readonly string[]): SafetyFooter {
  // The first language with an explicit region decides. A region without verified numbers
  // gets the generic line, never another country's numbers.
  for (const tag of languages) {
    const region = regionFromLocale(tag);
    if (!region) continue;
    const known = VERIFIED[region];
    return known ? { country: known.name, lines: known.lines } : { country: null, lines: [] };
  }
  return { country: null, lines: [] };
}

/** A country chosen in the profile wins; otherwise the browser's language settings. */
export function safetyFooterFor(country: string | undefined, languages: readonly string[]): SafetyFooter {
  const known = country ? VERIFIED[country] : undefined;
  if (known) return { country: known.name, lines: known.lines };
  if (country) return { country: null, lines: [] };
  return safetyFooter(languages);
}
