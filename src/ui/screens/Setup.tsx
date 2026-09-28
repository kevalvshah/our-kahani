import { useState } from 'preact/hooks';
import { normalisePhrase, phraseProblem } from '../../crypto/recovery';
import { COUNTRIES, GREETINGS, normaliseHashtag } from '../../content/extras';
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
      navigate(d.room.role === 'creator' && !d.room.partnerJoined ? PATHS.invite : PATHS.today);
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
// The room phrase: once the hashtag is locked, each person picks their own phrase
// ---------------------------------------------------------------------------
export function RoomPhrase() {
  const d = useRoomData();
  const { room, setRoom } = useRoom();
  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag ?? '';
  const [phrase, setPhrase] = useState('');
  const [again, setAgain] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!room) return null;

  async function save() {
    if (!room) return;
    const weak = phraseProblem(phrase, [d.me, d.partner, hashtag]);
    if (weak) return setProblem(weak);
    if (normalisePhrase(phrase) !== normalisePhrase(again)) return setProblem('The two phrases are not the same. Type it again.');
    setBusy(true);
    setProblem(null);
    try {
      setRoom(await controller().saveBackup(room, hashtag, phrase));
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <ScreenTitle
        emoji="🔑"
        lead={`${hashtag} is your room now. Pick a phrase only you know: with the hashtag, it opens your room on any phone or laptop.`}
      >
        Your room phrase
      </ScreenTitle>
      <div class="panel">
        <p class="small">
          <b>{hashtag}</b> + your phrase = your way back in. {d.partner} picks their own.
        </p>
        <Field
          id="phrase"
          label="Your phrase (four or more words)"
          value={phrase}
          onInput={setPhrase}
          placeholder="e.g. mango lassi on sunday mornings"
          maxLength={120}
        />
        <Field id="phrase2" label="Type it again" value={again} onInput={setAgain} maxLength={120} />
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={() => void save()}>
          {busy ? 'Locking your key…' : 'Save my phrase'}
        </button>
        <p class="small muted">
          Pick something you will remember but others would not guess: not your names, not a film line everyone knows. We
          never see it and cannot reset it. Spaces between words matter; capitals do not.
        </p>
      </div>
      <div class="panel panel-gold">
        <p class="small">
          Your room key is locked with the hashtag and this phrase before it is stored, so the server keeps a backup it cannot
          open. Safari clears a site's data after a week without a visit: on iPhone, add Our Kahani to your Home Screen.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coming back: hashtag + phrase
// ---------------------------------------------------------------------------
export function Recover() {
  const { setRoom } = useRoom();
  const [hashtag, setHashtag] = useState('');
  const [phrase, setPhrase] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function recover() {
    setBusy(true);
    setProblem(null);
    try {
      setRoom(await controller().recover(hashtag, phrase));
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <ScreenTitle emoji="🔑" lead="Your room's hashtag and your own phrase. Everything is unlocked on this device; the phrase never leaves it.">
        Enter your room
      </ScreenTitle>
      <div class="panel">
        <Field id="rtag" label="Your room's hashtag" value={hashtag} onInput={(v) => setHashtag(normaliseHashtag(v))} placeholder="#ChaiAurCoffee" maxLength={25} />
        <Field id="rphrase" label="Your phrase" value={phrase} onInput={setPhrase} maxLength={120} />
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block" disabled={busy || !hashtag || !phrase.trim()} onClick={() => void recover()}>
          {busy ? 'Unlocking…' : 'Enter the room'}
        </button>
        <p class="small muted">
          Opening it here moves your place in the room to this device. Your person's phone is not affected.
        </p>
      </div>
    </section>
  );
}
