import { SEASON, TYPE_LABEL } from '../../content/cards';
import { SEASONS } from '../../content/seasons';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { allOptions, answerText, entryFor, isAnswered, questionText, type Answer } from '../../features/cardLogic';
import { doneByMe, seasonProgress } from '../../features/progress';
import { findSeason, seasonOneRefs, seasonRefs } from '../../features/seasons';
import { Back, Done, Link, Row, ScreenTitle } from '../components';
import { cardPath, PATHS, seasonPath } from '../router';

// Five seasons, one for each stage of a relationship. All open from the start: couples go at
// their own pace, and the stage is never shown as a label.

const S1 = { id: 's1', e: '✨', name: 'Pehli Baat', theme: 'Getting to know the real you', blurb: 'Small cards to start your story, and a few must-talks asked with curiosity.' };

export function Seasons() {
  const d = useRoomData();
  const all = [S1, ...SEASONS];
  return (
    <section>
      <ScreenTitle emoji="📚" lead="Five seasons of your story. Play in any order, at your own pace. What you learn in one flows into the next.">
        Your seasons
      </ScreenTitle>
      <div class="rows">
        {all.map((s, i) => {
          const pr = seasonProgress(d, s.id);
          return (
            <Row
              key={s.id}
              emoji={s.e}
              tint={pr.done === pr.total ? 'plain' : 'gold'}
              title={`Season ${i + 1} · ${s.name}`}
              sub={s.theme}
              pill={`${pr.done}/${pr.total}`}
              href={seasonPath(s.id)}
            />
          );
        })}
      </div>
      <Link class="btn btn-secondary btn-block seal" href={PATHS.recap}>
        🔖 What I learned about {d.partner}
      </Link>
    </section>
  );
}

export function SeasonScreen({ id }: { id: string }) {
  const d = useRoomData();
  const s = id === 's1' ? S1 : findSeason(id);
  if (!s) {
    return (
      <section>
        <Back href={PATHS.seasons} label="← Seasons" />
        <h1 class="screen-title" tabIndex={-1}>
          This season is not here
        </h1>
      </section>
    );
  }
  const refs = id === 's1' ? seasonOneRefs() : seasonRefs(findSeason(id)!);
  const next = refs.find((r) => !doneByMe(d, r));
  return (
    <section>
      <Back href={PATHS.seasons} label="← Seasons" />
      <ScreenTitle emoji={s.e} lead={s.blurb}>
        {s.name}
      </ScreenTitle>
      {next ? (
        <Link class="btn btn-cta" href={cardPath(next)}>
          <span>Play the next card</span>
          <span class="cta-meta">→</span>
        </Link>
      ) : (
        <Done>Season finished 🎉 Try the next one, whenever you like.</Done>
      )}
      <div class="rows pack-rows">
        {refs.map((ref, i) => {
          const entry = entryFor(ref);
          if (!entry) return null;
          const c = entry.card;
          const mine = doneByMe(d, ref);
          const theirs = d.partnerAnswered(K.ANSWER, ref);
          return (
            <Row
              key={ref}
              emoji={mine ? '✅' : c.type === 'then' ? '🔁' : '🃏'}
              tint={mine ? 'plain' : 'gold'}
              title={questionText(entry) || `Card ${i + 1}`}
              sub={id === 's1' ? SEASON[i + 1]?.tag : TYPE_LABEL[c.type]}
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

/** Season 1, read back: the partner's answers you have both opened, decrypted on this device. */
export function Recap() {
  const d = useRoomData();
  const rows = seasonOneRefs().flatMap((ref) => {
    const entry = entryFor(ref);
    if (!entry || entry.card.type === 'noticed' || entry.card.type === 'bug') return [];
    const mine = d.mine<Answer>(K.ANSWER, ref)?.data;
    const theirs = d.theirs<Answer>(K.ANSWER, ref)?.data;
    if (!isAnswered(entry.card, mine) || !isAnswered(entry.card, theirs)) return [];
    const opts = allOptions(entry.card, mine, theirs);
    return [{ ref, q: questionText(entry), theirs: answerText(entry.card, theirs, opts), why: theirs!.why, same: answerText(entry.card, mine, opts) === answerText(entry.card, theirs, opts) }];
  });
  return (
    <section>
      <Back href={PATHS.seasons} label="← Seasons" />
      <ScreenTitle emoji="🔖" lead={`Everything ${d.partner} told you in Pehli Baat, put together on this device. Nobody else can see it.`}>
        What I learned about {d.partner}
      </ScreenTitle>
      {rows.length ? (
        <div class="rows">
          {rows.map((r) => (
            <Link key={r.ref} class="row" href={cardPath(r.ref)}>
              <span class="row-emoji" aria-hidden="true">
                {r.same ? '🤝' : '💡'}
              </span>
              <span class="row-text">
                <span class="row-title">{r.q}</span>
                <span class="row-sub">
                  {d.partner}: {r.theirs}
                  {r.why ? ` · “${r.why}”` : ''}
                  {r.same ? ' · you both said this' : ''}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Done>Once you have both opened a few Pehli Baat cards, what you learned shows up here.</Done>
      )}
    </section>
  );
}
