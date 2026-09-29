import { useMemo, useState } from 'preact/hooks';
import { howToWatch, SERVICES, type MovieSetup } from '../../content/extras';
import type { Genre, TitleLang } from '../../content/titles';
import { buildDeck, comparePicks, GENRE_LABEL, PICKS, picksOf, poolSize, type DeckFilter } from '../../features/movieDeck';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { Back, Chips, Done, Problem, Wait } from '../components';
import { PATHS } from '../router';

// Movie Night. Swipes are an answer (kind 2): the server withholds the partner's swipes until
// yours are in, then each phone works out the matches. Films are emoji plus title, never art.

interface Setup extends Omit<MovieSetup, 'fmt'> {
  fmt: DeckFilter['fmt'];
  langs?: TitleLang[];
  genres?: Genre[];
  round: number;
  started: boolean;
  pick?: string | null;
  when?: string | null;
  svc?: string | null;
  eps?: string | null;
  at: number;
}

export function MovieNight() {
  const d = useRoomData();
  const mineS = d.mine<Setup>(K.MOVIE_SETUP, 'movie')?.data;
  const theirsS = d.theirs<Setup>(K.MOVIE_SETUP, 'movie')?.data;
  const setup = [mineS, theirsS].filter(Boolean).sort((a, b) => a!.at - b!.at).pop();
  const history = d.list<{ t: string; when: string }>(K.WATCHED);

  const [mode, setMode] = useState<Setup['mode'] | null>(setup?.mode ?? null);
  const [dev, setDev] = useState<Setup['dev'] | null>(setup?.dev ?? null);
  const [fmt, setFmt] = useState<Setup['fmt'] | null>(setup?.fmt ?? null);
  const [langs, setLangs] = useState<TitleLang[]>(setup?.langs ?? []);
  const [genres, setGenres] = useState<Genre[]>(setup?.genres ?? []);
  const pool = fmt ? poolSize({ fmt, langs, genres }) : 0;

  const save = (over: Partial<Setup>) =>
    d.put(K.MOVIE_SETUP, 'movie', { ...(setup ?? { round: 0, started: false }), ...over, at: Date.now() } as Setup);

  if (!setup?.started) {
    const ready = mode && fmt && (mode === 'home' || dev) && pool > 0;
    return (
      <section>
        <Back href={PATHS.today} label="← Today" />
        <div class="question-card">
          <span class="pack-tag">🍿 Movie Night</span>
          <h1 class="question" tabIndex={-1}>
            Movie night, your way 🍿
          </h1>
          <p class="field-label">Where are you watching?</p>
          <Chips label="Where" value={mode} options={[['home', '🏠 Together at home'], ['apart', '📱 Apart, same time']]} onPick={setMode} />
          {mode === 'apart' && (
            <>
              <p class="field-label">Which phones?</p>
              <Chips label="Phones" value={dev} options={[['ios', '🍎 Both iPhones'], ['android', '🤖 Both Android'], ['mixed', '🔀 One of each']]} onPick={setDev} />
            </>
          )}
          <p class="field-label">What are you in the mood for?</p>
          <Chips
            label="Mood"
            value={fmt}
            options={[['movie', '🎬 One movie'], ['series', '📺 A series episode'], ['binge', '🍿 Binge weekend'], ['special', '😂 A comedy special']]}
            onPick={setFmt}
          />
          <p class="field-label">
            Language <span class="muted">(any if none picked)</span>
          </p>
          <Multi label="Language" all={LANGS} value={langs} onChange={setLangs} />
          <p class="field-label">
            Genre <span class="muted">(any if none picked)</span>
          </p>
          <Multi label="Genre" all={(Object.keys(GENRE_LABEL) as Genre[]).map((g) => [g, GENRE_LABEL[g]] as [Genre, string])} value={genres} onChange={setGenres} />
          {fmt && <p class="small muted">{pool ? `${pool} titles to pick from. You each pick up to 5.` : 'Nothing matches: try fewer filters.'}</p>}
          <button
            type="button"
            class="btn btn-primary btn-block seal"
            disabled={!ready}
            onClick={() => void save({ mode: mode!, dev: mode === 'apart' ? dev! : undefined, fmt: fmt!, langs, genres, round: (setup?.round ?? 0) + 1, started: true, pick: null, when: null, svc: null, eps: null })}
          >
            Start swiping
          </button>
          {history.length > 0 && (
            <>
              <h2 class="sub-title">Watched together</h2>
              {history.map((h) => (
                <div key={h.id} class="bubble">
                  🎞️ {h.data.t}
                  <small>{h.data.when}</small>
                </div>
              ))}
            </>
          )}
          <p class="small muted">
            Watching apart? Screen sharing usually goes black on the big streaming apps. SharePlay works where it is supported,
            otherwise try a browser watch-party extension or count down 3-2-1 and press play together.
          </p>
        </div>
      </section>
    );
  }

  return <Swiping setup={setup} save={save} />;
}

function Swiping({ setup, save }: { setup: Setup; save: (over: Partial<Setup>) => Promise<boolean> }) {
  const d = useRoomData();
  const ref = `movie:${setup.round}`;
  const watched = d.list<{ t: string }>(K.WATCHED).map((w) => w.data.t);
  const pool = useMemo(
    () => buildDeck({ fmt: setup.fmt, langs: setup.langs, genres: setup.genres }, setup.round, watched, undefined, Infinity),
    [setup.round, setup.fmt, JSON.stringify(setup.langs), JSON.stringify(setup.genres), watched.length],
  );
  const byId = useMemo(() => new Map(pool.map((t) => [t.id, t])), [pool]);
  const mineRec = d.mine<{ picks?: string[]; votes?: Record<string, boolean> }>(K.MOVIE_VOTES, ref);
  const theirsRec = d.theirs<{ picks?: string[]; votes?: Record<string, boolean> }>(K.MOVIE_VOTES, ref);
  const mine = mineRec ? picksOf(mineRec.data) : null;
  const theirs = theirsRec ? picksOf(theirsRec.data) : null;
  const partnerDone = d.partnerAnswered(K.MOVIE_VOTES, ref);
  const [picks, setPicks] = useState<string[]>(() => mine ?? []);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(30);
  const [problem, setProblem] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const list = q ? pool.filter((t) => t.t.toLowerCase().includes(q) || t.lang.toLowerCase().includes(q)) : pool;
  const toggle = (id: string) => setPicks((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= PICKS ? cur : [...cur, id]));

  async function seal() {
    setProblem(null);
    const ok = await d.put(K.MOVIE_VOTES, ref, { picks });
    if (!ok) setProblem(`${d.partner} has already picked, so your five are locked in.`);
    setEditing(false);
  }

  const Title = ({ id, picked, onPick }: { id: string; picked?: boolean; onPick: () => void }) => {
    const t = byId.get(id);
    if (!t) return null;
    return (
      <button type="button" class={picked ? 'option option-row is-picked' : 'option option-row'} aria-pressed={!!picked} onClick={onPick}>
        <span class="option-emoji" aria-hidden="true">
          {t.e}
        </span>
        <span class="option-text">
          <span class="option-label">{t.t}</span>
          <span class="option-sub">
            {t.lang} · {t.genres.slice(0, 2).map((g) => GENRE_LABEL[g].split(' ').slice(1).join(' ')).join(', ')} · {t.year}
          </span>
          <span class="option-sub">{t.hook}</span>
        </span>
      </button>
    );
  };

  const summary = (
    <div class="chip-row">
      <span class="pill tint-plain">{setup.mode === 'home' ? '🏠 Home' : '📱 Apart'}</span>
      {setup.mode === 'apart' && <span class="pill tint-plain">{{ ios: '🍎 iPhones', android: '🤖 Android', mixed: '🔀 Mixed' }[setup.dev ?? 'mixed']}</span>}
      <span class="pill tint-plain">{{ movie: '🎬 One movie', series: '📺 A series episode', binge: '🍿 Binge weekend', special: '😂 Comedy special' }[setup.fmt]}</span>
      {(setup.langs ?? []).map((l) => (
        <span key={l} class="pill tint-plain">
          {l}
        </span>
      ))}
      <button type="button" class="btn-small" onClick={() => void save({ started: false })}>
        Change
      </button>
    </div>
  );

  let body;
  if (!mine || editing) {
    body = (
      <>
        <p class="small">
          <span class="pill tint-gold">Pick up to {PICKS}</span> Choose the ones you would happily watch. {d.partner} picks theirs too; then
          you see both lists and choose one together.
        </p>
        <label class="field-label" for="msearch">
          Search {pool.length} titles
        </label>
        <input
          id="msearch"
          class="field"
          value={query}
          placeholder="A title or a language"
          autocomplete="off"
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setShown(30);
          }}
        />
        <p class="small muted" aria-live="polite">
          {picks.length} of {PICKS} picked{picks.length >= PICKS ? ' · tap one to take it out' : ''}
        </p>
        <div class="options options-stack">
          {list.slice(0, shown).map((t) => (
            <Title key={t.id} id={t.id} picked={picks.includes(t.id)} onPick={() => toggle(t.id)} />
          ))}
        </div>
        {list.length > shown && (
          <button type="button" class="btn btn-secondary btn-block" onClick={() => setShown(shown + 30)}>
            Show more ({list.length - shown} left)
          </button>
        )}
        <Problem text={problem} />
        <button type="button" class="btn btn-primary btn-block seal" disabled={!picks.length} onClick={() => void seal()}>
          Seal my {picks.length === 1 ? 'pick' : `${picks.length} picks`} 🍿
        </button>
      </>
    );
  } else if (!theirs) {
    body = (
      <>
        <Wait>
          Your {mine.length === 1 ? 'pick is' : `${mine.length} picks are`} sealed ✓ {partnerDone ? 'Opening…' : `Waiting for ${d.partner} 🍿`}
        </Wait>
        {!partnerDone && (
          <button
            type="button"
            class="btn btn-secondary btn-block seal"
            onClick={() => {
              setPicks(mine);
              setEditing(true);
            }}
          >
            Change my picks
          </button>
        )}
      </>
    );
  } else {
    const { both, onlyMine, onlyTheirs } = comparePicks(mine, theirs);
    const pick = setup.pick ? byId.get(setup.pick) : undefined;
    const ok = pick && setup.when && (setup.mode === 'home' || setup.svc) && (setup.fmt === 'movie' || setup.eps);
    const group = (title: string, ids: string[]) =>
      ids.length > 0 && (
        <>
          <h2 class="sub-title">{title}</h2>
          <div class="options options-stack">
            {ids.map((id) => (
              <Title key={id} id={id} picked={setup.pick === id} onPick={() => void save({ pick: id })} />
            ))}
          </div>
        </>
      );
    body = (
      <>
        <p class="reveal-banner">{both.length ? `${both.length} in common 🎉` : 'Different picks: choose one together 🍿'}</p>
        {group('You both picked', both)}
        {group(`${d.partner}'s picks`, onlyTheirs)}
        {group('Your picks', onlyMine)}
        <p class="small muted">Tap the one you will watch. Either of you can choose, and change it.</p>
        {pick && (
          <>
            <p class="field-label">When?</p>
            <Chips label="When" value={setup.when ?? null} options={[['Tonight', '🗓️ Tonight'], ['Tomorrow', '🗓️ Tomorrow'], ['This weekend', '🗓️ This weekend']]} onPick={(when) => void save({ when })} />
            {setup.mode === 'apart' && (
              <>
                <p class="field-label">Where is it streaming?</p>
                <Chips label="Service" value={setup.svc ?? null} options={SERVICES.map(([id, e, l]) => [id, `${e} ${l}`] as [string, string])} onPick={(svc) => void save({ svc })} />
              </>
            )}
            {setup.fmt !== 'movie' && setup.fmt !== 'special' && (
              <>
                <p class="field-label">How many episodes?</p>
                <Chips label="Episodes" value={setup.eps ?? null} options={[['1', '▶️ Just one'], ['2', '⏩ Two'], ['3', '🍿 Three or more']]} onPick={(eps) => void save({ eps })} />
              </>
            )}
          </>
        )}
        {ok && (
          <div class="panel panel-accent">
            <div class="panel-title">
              {pick.e} {pick.t}
            </div>
            <p class="small">
              <b>{setup.when}</b>
              {setup.fmt === 'series' || setup.fmt === 'binge' ? ` · ${setup.eps === '3' ? '3+ episodes' : setup.eps === '2' ? '2 episodes' : '1 episode'}` : ''}
            </p>
            <ul class="tips">
              {howToWatch(setup.mode, setup.dev, setup.svc ?? null).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <button
              type="button"
              class="btn btn-primary btn-block"
              onClick={async () => {
                await d.add(K.WATCHED, `watched:${Date.now().toString(36)}`, { t: pick.t, when: setup.when });
                await save({ started: false, pick: null, when: null, svc: null, eps: null });
              }}
            >
              We watched it 🎉
            </button>
          </div>
        )}
        {!ok && pick && <Done>Picked. Choose when{setup.mode === 'apart' ? ' and where' : ''} to see how to watch.</Done>}
      </>
    );
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🍿 Movie Night</span>
        <h1 class="question" tabIndex={-1}>
          Pick your five
        </h1>
        {summary}
        {body}
      </div>
    </section>
  );
}

const LANGS: [TitleLang, string][] = [
  ['Hindi', 'Hindi'],
  ['English', 'English'],
  ['Gujarati', 'Gujarati'],
  ['Punjabi', 'Punjabi'],
  ['Tamil', 'Tamil'],
  ['Telugu', 'Telugu'],
  ['Malayalam', 'Malayalam'],
  ['Marathi', 'Marathi'],
  ['Bengali', 'Bengali'],
  ['Kannada', 'Kannada'],
  ['Korean', 'Korean'],
  ['Japanese', 'Japanese'],
  ['Spanish', 'Spanish'],
];

/** Pick any number; none picked means any. */
function Multi<T extends string>({ label, all, value, onChange }: { label: string; all: [T, string][]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div class="chip-row" role="group" aria-label={label}>
      {all.map(([id, text]) => {
        const on = value.includes(id);
        return (
          <button key={id} type="button" class={on ? 'chip is-on' : 'chip'} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== id) : [...value, id])}>
            {text}
          </button>
        );
      })}
    </div>
  );
}
