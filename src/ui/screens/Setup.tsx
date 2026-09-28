import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Bytes } from '../../crypto/bytes';
import { COUNTRIES, GREETINGS } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData, type Profile } from '../../data/RoomData';
import { controller } from '../../state/controller';
import { useRoom } from '../../state/roomContext';
import { Brand } from '../Brand';
import { Em, Field, Problem, ScreenTitle } from '../components';
import { problemText } from '../problems';
import { navigate, PATHS } from '../router';

// First run, on each person's own phone: their own first name (typed, never hardcoded), an
// optional country (only for the safety footer) and a greeting. All of it is encrypted.

export function ProfileSetup() {
  const d = useRoomData();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [greeting, setGreeting] = useState('Namaste');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!clean) {
      setProblem('Add your first name to begin.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const profile: Profile = { name: clean, country: country || undefined, greeting };
      await d.put(K.PROFILE, 'profile', profile);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <span class="season-badge">
        <Em>✨</Em> Season 1 · Pehli Baat
      </span>
      <Brand />
      <p class="lead">A few small cards, just for the two of you. First names only, all inside a private room.</p>
      <div class="panel">
        <Field id="name" label="Your first name" value={name} onInput={setName} placeholder="Type your name" maxLength={20} />
        <div class="field-wrap">
          <label class="field-label" for="country">
            Where are you based? <span class="muted">(optional)</span>
          </label>
          <select id="country" class="field" value={country} onChange={(e) => setCountry((e.target as HTMLSelectElement).value)}>
            {COUNTRIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label" for="greet">
            How should we say hello?
          </label>
          <select id="greet" class="field" value={greeting} onChange={(e) => setGreeting((e.target as HTMLSelectElement).value)}>
            {GREETINGS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={() => void save()}>
          Start Pehli Baat
        </button>
        <p class="small muted">
          You can each save things you learn about each other. Saved notes stay private and never send a notice, so surprises
          stay surprises.
        </p>
        <p class="small muted">Your name is locked on this phone before it is sent. Only your person can read it.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The twelve words: mandatory, written down, checked
// ---------------------------------------------------------------------------
export function RecoveryWords() {
  const { room, setRoom } = useRoom();
  const [phrase, setPhrase] = useState<{ words: string[]; entropy: Bytes } | null>(null);
  const [step, setStep] = useState<'show' | 'check'>('show');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void controller().newPhrase().then(setPhrase);
  }, []);

  // Three random positions to type back.
  const checks = useMemo(() => {
    const idx = new Set<number>();
    const r = crypto.getRandomValues(new Uint8Array(12));
    for (const b of r) {
      idx.add(b % 12);
      if (idx.size === 3) break;
    }
    return [...idx].sort((a, b) => a - b);
  }, [phrase]);

  if (!room || !phrase) return null;

  async function confirm() {
    if (!room || !phrase) return;
    const wrong = checks.find((i) => (answers[i] ?? '').trim().toLowerCase() !== phrase.words[i]);
    if (wrong !== undefined) {
      setProblem(`Word ${wrong + 1} does not match. Check what you wrote down.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      setRoom(await controller().saveBackup(room, phrase.entropy));
      navigate(room.role === 'creator' && !room.partnerJoined ? PATHS.invite : PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'show') {
    return (
      <section>
        <ScreenTitle
          emoji="📝"
          lead="These twelve words are the only way back into your room if this phone or browser forgets it. Write them down on paper, in order. We never see them and cannot resend them."
        >
          Your twelve words
        </ScreenTitle>
        <ol class="words" aria-label="Your recovery words">
          {phrase.words.map((w, i) => (
            <li key={i}>
              <span class="word-n">{i + 1}</span> {w}
            </li>
          ))}
        </ol>
        <div class="panel panel-gold">
          <p class="small">
            Safari deletes a site's data after a week of not opening it. On iPhone, add Our Kahani to your Home Screen (Share,
            then Add to Home Screen) to make that far less likely. Do not screenshot these words into a shared album.
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-block seal" onClick={() => setStep('check')}>
          I have written them down
        </button>
      </section>
    );
  }

  return (
    <section>
      <ScreenTitle emoji="✅" lead="A quick check that the words are safely written down.">
        Check your words
      </ScreenTitle>
      <div class="panel">
        {checks.map((i) => (
          <Field
            key={i}
            id={`w${i}`}
            label={`Word ${i + 1}`}
            value={answers[i] ?? ''}
            onInput={(v) => setAnswers((prev) => ({ ...prev, [i]: v }))}
            maxLength={12}
          />
        ))}
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Saving the locked backup…' : 'Done'}
        </button>
        <button type="button" class="btn btn-secondary btn-block seal" onClick={() => setStep('show')}>
          Show the words again
        </button>
        <p class="small muted">
          Your room key is locked with these words before it is stored, so the server keeps a backup it cannot open.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coming back with the twelve words
// ---------------------------------------------------------------------------
export function Recover() {
  const { setRoom } = useRoom();
  const [words, setWords] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function recover() {
    setBusy(true);
    setProblem(null);
    try {
      setRoom(await controller().recover(words));
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <ScreenTitle emoji="🔑" lead="Type your twelve words in order. Everything is unlocked on this phone; the words never leave it.">
        Back into your room
      </ScreenTitle>
      <div class="panel">
        <label class="field-label" for="words">
          Your twelve words
        </label>
        <textarea
          id="words"
          class="field field-area"
          rows={4}
          value={words}
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          onInput={(e) => setWords((e.target as HTMLTextAreaElement).value)}
        />
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block" disabled={busy || !words.trim()} onClick={() => void recover()}>
          {busy ? 'Unlocking…' : 'Unlock my room'}
        </button>
      </div>
    </section>
  );
}
