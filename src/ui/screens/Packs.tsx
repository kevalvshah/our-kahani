import { useState } from 'preact/hooks';
import { PACKS, packRef, TYPE_LABEL } from '../../content/cards';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { doneByMe, packProgress } from '../../features/progress';
import { newId } from '../../crypto/ids';
import { Back, Done, Link, Problem, Row, ScreenTitle } from '../components';
import { problemText } from '../problems';
import { cardPath, navigate, packPath, PATHS } from '../router';

export function Packs() {
  const d = useRoomData();
  return (
    <section>
      <ScreenTitle emoji="🃏" lead="Play in any order, skip freely. Sensitive packs are opt-in for both of you.">
        Card packs
      </ScreenTitle>
      <div class="rows">
        {PACKS.map((p) => {
          const pr = packProgress(d, p.id);
          return <Row key={p.id} emoji={p.e} tint={pr.done === pr.total ? 'plain' : 'gold'} title={p.name} sub={p.blurb} pill={`${pr.done}/${pr.total}`} href={packPath(p.id)} />;
        })}
      </div>
    </section>
  );
}

export function PackScreen({ id }: { id: string }) {
  const d = useRoomData();
  const pack = PACKS.find((p) => p.id === id);
  if (!pack) {
    return (
      <section>
        <Back href={PATHS.packs} label="← Packs" />
        <h1 class="screen-title" tabIndex={-1}>
          This pack is not here
        </h1>
      </section>
    );
  }
  const next = pack.cards.findIndex((_, i) => !doneByMe(d, packRef(pack.id, i)));
  return (
    <section>
      <Back href={PATHS.packs} label="← Packs" />
      <ScreenTitle emoji={pack.e} lead={pack.blurb}>
        {pack.name}
      </ScreenTitle>
      {next >= 0 ? (
        <Link class="btn btn-cta" href={cardPath(packRef(pack.id, next))}>
          <span>Play the next card</span>
          <span class="cta-meta">→</span>
        </Link>
      ) : (
        <Done>Pack finished 🎉 Try another pack.</Done>
      )}
      <div class="rows pack-rows">
        {pack.cards.map((c, i) => {
          const ref = packRef(pack.id, i);
          const mine = doneByMe(d, ref);
          const theirs = d.partnerAnswered(K.ANSWER, ref);
          const q = c.type === 'nhie' ? `Never have I ever… ${c.q}` : c.type === 'guess' ? `Guess: ${c.q}` : 'q' in c ? c.q : '';
          return (
            <Row
              key={ref}
              emoji={mine ? '✅' : '🃏'}
              tint={mine ? 'plain' : 'gold'}
              title={q}
              sub={TYPE_LABEL[c.type]}
              pill={mine ? (theirs ? 'Open both' : 'Done ✓') : theirs ? `${d.partner} is in` : 'Your turn'}
              pillTint={mine ? 'plain' : 'gold'}
              href={cardPath(ref)}
            />
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add our own card: a this-or-that or a never-have-I-ever, with your own answer sealed
// ---------------------------------------------------------------------------
export function AddCard() {
  const d = useRoomData();
  const [kind, setKind] = useState<'choice' | 'nhie'>('choice');
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [mine, setMine] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const question = q.trim();
    if (!question) return setProblem(kind === 'choice' ? 'Add a question first.' : 'Finish the sentence first.');
    if (kind === 'choice' && (!a.trim() || !b.trim())) return setProblem('Add both options.');
    if (!mine) return setProblem('Pick your own answer, so it is ready when they reply.');
    setBusy(true);
    setProblem(null);
    try {
      const ref = `bonus:${newId()}`;
      await d.add(K.BONUS_CARD, ref, kind === 'choice' ? { kind, q: question, a: a.trim(), b: b.trim() } : { kind, q: question });
      await d.put(K.ANSWER, ref, { pick: mine });
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="✍️" lead={`It lands on ${d.partner}'s phone as a card. Your own answer stays sealed until they answer too.`}>
        Make a card for {d.partner}
      </ScreenTitle>
      <div class="panel">
        <div class="segmented" role="group" aria-label="Card type">
          <button type="button" class={kind === 'choice' ? 'is-on' : ''} aria-pressed={kind === 'choice'} onClick={() => { setKind('choice'); setMine(null); }}>
            This or that
          </button>
          <button type="button" class={kind === 'nhie' ? 'is-on' : ''} aria-pressed={kind === 'nhie'} onClick={() => { setKind('nhie'); setMine(null); }}>
            Never have I ever
          </button>
        </div>
        {kind === 'choice' ? (
          <>
            <label class="field-label" for="q">
              Your question
            </label>
            <input id="q" class="field" maxLength={70} value={q} placeholder="e.g. Rooftop dinner or picnic in the park?" autocomplete="off" onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
            <label class="field-label" for="a">
              Option 1
            </label>
            <input id="a" class="field" maxLength={30} value={a} autocomplete="off" onInput={(e) => setA((e.target as HTMLInputElement).value)} />
            <label class="field-label" for="b">
              Option 2
            </label>
            <input id="b" class="field" maxLength={30} value={b} autocomplete="off" onInput={(e) => setB((e.target as HTMLInputElement).value)} />
          </>
        ) : (
          <>
            <label class="field-label" for="q">
              Never have I ever…
            </label>
            <input id="q" class="field" maxLength={70} value={q} placeholder="e.g. sung in the car so loud the windows shook" autocomplete="off" onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          </>
        )}
        <p class="field-label">
          Your own answer <span class="muted">({d.partner} sees it once you both answer)</span>
        </p>
        <div class="btn-pair">
          {(kind === 'choice'
            ? [
                ['a', a.trim() || 'Option 1'],
                ['b', b.trim() || 'Option 2'],
              ]
            : [
                ['have', 'I have 🙋'],
                ['never', 'Never 🙅'],
              ]
          ).map(([id, label]) => (
            <button key={id} type="button" class={mine === id ? 'chip is-on chip-wide' : 'chip chip-wide'} aria-pressed={mine === id} onClick={() => setMine(id!)}>
              {label}
            </button>
          ))}
        </div>
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block seal" disabled={busy} onClick={() => void send()}>
          Send it over 💌
        </button>
      </div>
    </section>
  );
}
