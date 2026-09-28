// Official packs shown on the Packs screen. The cards themselves move to JSON pack files
// (docs/CONTENT-PACKS.md) in Stage 2; only the first Warm Words card exists so far.

export type Tint = 'gold' | 'pink' | 'accent' | 'plain';

export interface PackInfo {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  tint: Tint;
}

export const OFFICIAL_PACKS: readonly PackInfo[] = [
  { id: 'warm', name: 'Warm Words', emoji: '💛', blurb: 'Affection, compliments, small kindnesses', tint: 'pink' },
  { id: 'fair-warning', name: 'Fair Warning', emoji: '⚠️', blurb: 'The habits worth knowing early', tint: 'gold' },
  { id: 'desi-abroad', name: 'Desi Abroad', emoji: '✈️', blurb: 'Two countries, one accent, endless calls home', tint: 'accent' },
  { id: 'festival', name: 'Festival Season', emoji: '🪔', blurb: 'Diwali, Eid, Christmas, everything in between', tint: 'gold' },
  { id: 'garba', name: 'Garba Season', emoji: '💃', blurb: 'Nine nights, one playlist', tint: 'pink' },
  { id: 'remember-when', name: 'Remember When', emoji: '⏳', blurb: 'Sixty seconds, one memory', tint: 'accent' },
  { id: 'screen-time', name: 'Screen Time', emoji: '📺', blurb: 'What you rewatch and refuse to admit', tint: 'gold' },
];

export interface ChoiceCard {
  pack: string;
  q: string;
  options: readonly { id: string; emoji: string; label: string }[];
}

export const TODAY_CARD: ChoiceCard = {
  pack: 'warm',
  q: 'How does affection land best for you?',
  options: [
    { id: 'hugs', emoji: '🤗', label: 'Hugs' },
    { id: 'words', emoji: '💬', label: 'Kind words' },
    { id: 'time', emoji: '🍵', label: 'Time together' },
    { id: 'help', emoji: '🧺', label: 'Small help' },
  ],
};
