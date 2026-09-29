import { useEffect, useRef, useState } from 'preact/hooks';
import { howToWatch, SERVICES, TITLES, type MovieSetup } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { Back, Chips, Done, Wait } from '../components';
import { PATHS } from '../router';

// Movie Night. Swipes are an answer (kind 2): the server withholds the partner's swipes until
// yours are in, then each phone works out the matches. Films are emoji plus title, never art.

interface Setup extends MovieSetup {
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

  const save = (over: Partial<Setup>) =>
    d.put(K.MOVIE_SETUP, 'movie', { ...(setup ?? { round: 0, started: false }), ...over, at: Date.now() } as Setup);

  if (!setup?.started) {
    const ready = mode && fmt && (mode === 'home' || dev);
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
          <Chips label="Mood" value={fmt} options={[['movie', '🎬 One movie'], ['series', '📺 A series episode'], ['binge', '🍿 Binge weekend']]} onPick={setFmt} />
          <button
            type="button"
            class="btn btn-primary btn-block seal"
            disabled={!ready}
            onClick={() => void save({ mode: mode!, dev: mode === 'apart' ? dev! : undefined, fmt: fmt!, round: (setup?.round ?? 0) + 1, started: true, pick: null, when: null, svc: null, eps: null })}
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
  const deck = TITLES.filter((t) => (setup.fmt === 'movie' ? t.type === 'movie' : t.type === 'series'));
  const mine = d.mine<{ votes: Record<string, boolean> }>(K.MOVIE_VOTES, ref)?.data.votes;
  const theirs = d.theirs<{ votes: Record<string, boolean> }>(K.MOVIE_VOTES, ref)?.data.votes;
  const partnerDone = d.partnerAnswered(K.MOVIE_VOTES, ref);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const idx = Object.keys(votes).length;
  const item = deck[idx];

  function swipe(yes: boolean) {
    if (!item) return;
    const next = { ...votes, [item.id]: yes };
    setVotes(next);
    setDrag(0);
    if (Object.keys(next).length === deck.length) void d.put(K.MOVIE_VOTES, ref, { votes: next });
  }

  useEffect(() => {
    if (mine) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') swipe(true);
      if (e.key === 'ArrowLeft') swipe(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const summary = (
    <div class="chip-row">
      <span class="pill tint-plain">{setup.mode === 'home' ? '🏠 Home' : '📱 Apart'}</span>
      {setup.mode === 'apart' && <span class="pill tint-plain">{{ ios: '🍎 iPhones', android: '🤖 Android', mixed: '🔀 Mixed' }[setup.dev ?? 'mixed']}</span>}
      <span class="pill tint-plain">{{ movie: '🎬 One movie', series: '📺 A series episode', binge: '🍿 Binge weekend' }[setup.fmt]}</span>
      <button type="button" class="btn-small" onClick={() => void save({ started: false })}>
        Change
      </button>
    </div>
  );

  let body;
  if (!mine) {
    body = item ? (
      <>
        <p class="small muted">
          {idx + 1} of {deck.length}. Swipe right for keen, left for pass (or use the arrow keys).
        </p>
        <div class="deck">
          <div
            class={`swipecard${drag > 40 ? ' is-yes' : drag < -40 ? ' is-no' : ''}`}
            role="group"
            aria-label={item.t}
            style={{ transform: drag ? `translateX(${drag}px) rotate(${drag / 18}deg)` : '' }}
            onPointerDown={(e) => {
              start.current = e.clientX;
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
            onPointerUp={() => {
              start.current = null;
              if (Math.abs(drag) > 90) swipe(drag > 0);
              else setDrag(0);
            }}
            onPointerCancel={() => {
              start.current = null;
              setDrag(0);
            }}
          >
            <div class="poster" aria-hidden="true">
              {item.e}
            </div>
            <h2 class="swipe-title">{item.t}</h2>
            <span class="pill tint-pink">{item.tag}</span>
            <p class="small">{item.hook}</p>
          </div>
        </div>
        <div class="btn-pair">
          <button type="button" class="btn btn-secondary" onClick={() => swipe(false)}>
            ✖ Pass
          </button>
          <button type="button" class="btn btn-primary" onClick={() => swipe(true)}>
            💚 Keen
          </button>
        </div>
        {idx > 0 && (
          <button
            type="button"
            class="btn btn-secondary btn-block seal"
            onClick={() => {
              const keys = Object.keys(votes);
              const next = { ...votes };
              delete next[keys[keys.length - 1]!];
              setVotes(next);
            }}
          >
            ↩ Undo last
          </button>
        )}
      </>
    ) : (
      <Wait>Saving your swipes…</Wait>
    );
  } else if (!theirs) {
    body = <Wait>Your swipes are sealed ✓ {partnerDone ? 'Opening…' : `Waiting for ${d.partner} 🍿`}</Wait>;
  } else {
    const matches = deck.filter((t) => mine[t.id] && theirs[t.id]);
    if (!matches.length) {
      body = (
        <>
          <p class="reveal-banner">No match this time 🙂</p>
          <p class="small muted">Only matches are shown. Try a different mood and swipe again.</p>
          <button type="button" class="btn btn-primary btn-block" onClick={() => void save({ started: false })}>
            Try another mood
          </button>
        </>
      );
    } else {
      const pick = matches.find((t) => t.id === setup.pick);
      const ok = pick && setup.when && (setup.mode === 'home' || setup.svc) && (setup.fmt === 'movie' || setup.eps);
      body = (
        <>
          <p class="reveal-banner">It is a match 🎉</p>
          <div class="options options-stack">
            {matches.map((t) => (
              <button key={t.id} type="button" class={setup.pick === t.id ? 'option option-row is-picked' : 'option option-row'} aria-pressed={setup.pick === t.id} onClick={() => void save({ pick: t.id })}>
                <span class="option-emoji" aria-hidden="true">
                  {t.e}
                </span>
                <span class="option-text">
                  <span class="option-label">{t.t}</span>
                  <span class="option-sub">{t.tag}</span>
                </span>
              </button>
            ))}
          </div>
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
              {setup.fmt !== 'movie' && (
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
                {setup.fmt !== 'movie' ? ` · ${setup.eps === '3' ? '3+ episodes' : setup.eps === '2' ? '2 episodes' : '1 episode'}` : ''}
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
          {!ok && pick && <Done>Match picked. Choose when{setup.mode === 'apart' ? ' and where' : ''} to see how to watch.</Done>}
        </>
      );
    }
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🍿 Movie Night</span>
        <h1 class="question" tabIndex={-1}>
          Swipe to pick
        </h1>
        {summary}
        {body}
      </div>
    </section>
  );
}
