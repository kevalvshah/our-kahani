import { useRef, useState } from 'preact/hooks';
import { applyLook, loadLook, saveLook, type Look } from '../look';
import { Note, ScreenTitle } from '../components';

type Choice<K extends keyof Look> = [Look[K], string];

interface Setting<K extends keyof Look> {
  key: K;
  title: string;
  sub: string;
  choices: Choice<K>[];
  /** What is actually in effect when the stored value is unset (follows the phone). */
  effective?: () => Look[K];
}

const prefersCalm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SETTINGS = [
  {
    key: 'theme',
    title: 'Theme',
    sub: 'Follow the phone, or lock it',
    choices: [[undefined, 'Phone'], ['light', 'Light'], ['dark', 'Dark']],
  } satisfies Setting<'theme'>,
  {
    key: 'accent',
    title: 'Accent',
    sub: 'One colour runs through the whole app',
    choices: [['teal', 'Teal'], ['kumkum', 'Kumkum'], ['marigold', 'Marigold'], ['neel', 'Neel']],
  } satisfies Setting<'accent'>,
  {
    key: 'text',
    title: 'Text size',
    sub: 'Everything scales together',
    choices: [['small', 'Small'], ['regular', 'Regular'], ['large', 'Large']],
  } satisfies Setting<'text'>,
  {
    key: 'motion',
    title: 'Motion',
    sub: 'Reveals can fade in, or just appear',
    choices: [['playful', 'Playful'], ['calm', 'Calm']],
    effective: () => (prefersCalm() ? 'calm' : 'playful'),
  } satisfies Setting<'motion'>,
  {
    key: 'texture',
    title: 'Background',
    sub: 'The dotted paper, or plain',
    choices: [['dots', 'Dotted'], ['plain', 'Plain']],
  } satisfies Setting<'texture'>,
  {
    key: 'emoji',
    title: 'Emoji icons',
    sub: 'Keep the little tiles, or go word-only',
    choices: [['on', 'On'], ['off', 'Off']],
  } satisfies Setting<'emoji'>,
] as Setting<keyof Look>[];

export function LookScreen() {
  const [look, setLook] = useState<Look>(loadLook);
  const latest = useRef(look);

  // Always build on the latest choice, so quick taps never undo each other (and it still
  // works when storage is blocked, e.g. private browsing).
  function choose<K extends keyof Look>(key: K, value: Look[K]) {
    const next = { ...latest.current, [key]: value };
    if (value === undefined) delete next[key];
    latest.current = next;
    applyLook(next);
    saveLook(next);
    setLook(next);
  }

  return (
    <section>
      <ScreenTitle
        emoji="🎨"
        lead="Your settings, on your device only. They are never sent anywhere and your person can pick something completely different."
      >
        Make it ours
      </ScreenTitle>
      <div class="rows settings">
        {SETTINGS.map((s) => {
          const current = look[s.key] ?? s.effective?.();
          return (
            <div key={s.key} class="setting" role="group" aria-labelledby={`look-${s.key}`}>
              <div id={`look-${s.key}`} class="row-title">
                {s.title}
              </div>
              <p class="row-sub">{s.sub}</p>
              <div class="choices">
                {s.choices.map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    class={current === value ? 'choice is-on' : 'choice'}
                    aria-pressed={current === value}
                    onClick={() => choose(s.key, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Note>
        Larger text, calm motion and dark mode are also picked up from your phone's own settings when you have them
        on.
      </Note>
    </section>
  );
}
