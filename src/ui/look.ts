// "Make it ours": per-device appearance settings. They hold no user content, are stored in
// this browser only, and are never sent anywhere or attached to any server record.

export interface Look {
  /** Unset follows the phone. */
  theme?: 'light' | 'dark';
  accent: 'teal' | 'kumkum' | 'marigold' | 'neel';
  text: 'small' | 'regular' | 'large';
  /** Unset follows the phone's reduced-motion setting. */
  motion?: 'playful' | 'calm';
  texture: 'dots' | 'plain';
  emoji: 'on' | 'off';
}

export const DEFAULT_LOOK: Look = { accent: 'teal', text: 'regular', texture: 'dots', emoji: 'on' };

const STORAGE_KEY = 'ok.look.v1';

const ALLOWED: { [K in keyof Look]-?: readonly string[] } = {
  theme: ['light', 'dark'],
  accent: ['teal', 'kumkum', 'marigold', 'neel'],
  text: ['small', 'regular', 'large'],
  motion: ['playful', 'calm'],
  texture: ['dots', 'plain'],
  emoji: ['on', 'off'],
};

/** Keeps only known keys with known values, so storage can never inject anything. */
export function sanitizeLook(value: unknown): Look {
  const out: Look = { ...DEFAULT_LOOK };
  if (typeof value !== 'object' || value === null) return out;
  for (const key of Object.keys(ALLOWED) as (keyof Look)[]) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'string' && ALLOWED[key].includes(v)) (out as unknown as Record<string, string>)[key] = v;
  }
  return out;
}

export function loadLook(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Look {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? sanitizeLook(JSON.parse(raw)) : { ...DEFAULT_LOOK };
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveLook(look: Look, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(sanitizeLook(look)));
  } catch {
    // Private mode or storage blocked: the look still applies for this visit.
  }
}

/** The attributes the CSS in tokens.css reads. Absent means "follow the phone" or default. */
export function lookAttributes(look: Look): Record<string, string | null> {
  return {
    'data-k-theme': look.theme ?? null,
    'data-k-accent': look.accent === 'teal' ? null : look.accent,
    'data-k-text': look.text === 'regular' ? null : look.text,
    'data-k-motion': look.motion ?? null,
    'data-k-texture': look.texture === 'dots' ? null : look.texture,
    'data-k-emoji': look.emoji === 'on' ? null : look.emoji,
  };
}

export function applyLook(look: Look, root: Element = document.documentElement): void {
  for (const [name, value] of Object.entries(lookAttributes(look))) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
