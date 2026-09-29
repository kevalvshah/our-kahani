import { SEASONS } from '../../content/seasons';
import { DREAM_TYPES } from '../../content/together';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { allOptions, answerText, entryFor, isAnswered, questionText, type Answer } from '../../features/cardLogic';
import { seasonOneRefs, seasonRefs } from '../../features/seasons';
import { Back, ScreenTitle } from '../components';
import { PATHS } from '../router';

// Our Kahani book: your story so far, put together on this device from what you have both
// opened. Print it, or save it as a PDF from the print dialog. Nothing is sent anywhere.

export function KahaniBook() {
  const d = useRoomData();
  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag;
  const chapters = [
    { name: 'Pehli Baat', refs: seasonOneRefs() },
    ...SEASONS.map((s) => ({ name: s.name, refs: seasonRefs(s) })),
  ].map((c) => ({
    name: c.name,
    lines: c.refs.flatMap((ref) => {
      const e = entryFor(ref);
      if (!e || e.card.type === 'noticed' || e.card.type === 'bug') return [];
      const mine = d.mine<Answer>(K.ANSWER, ref)?.data;
      const theirs = d.theirs<Answer>(K.ANSWER, ref)?.data;
      if (!isAnswered(e.card, mine) || !isAnswered(e.card, theirs)) return [];
      const opts = allOptions(e.card, mine, theirs);
      return [{ q: questionText(e), me: answerText(e.card, mine, opts), them: answerText(e.card, theirs, opts) }];
    }),
  }));
  const thanks = d.list<{ t: string }>(K.SHUKRIYA).filter((r) => r.data.t);
  const dreams = d.list<{ type: string; t: string }>(K.DREAM);
  const stories = d.list<{ start: string; lines: { by: string; t: string }[] }>(K.STORY_CHAPTER);

  return (
    <section class="book">
      <Back href={PATHS.seasons} label="← Seasons" />
      <ScreenTitle emoji="📖" lead="Your story so far, put together on this device. Print it, or choose “Save as PDF”.">
        {hashtag ? `${hashtag}: our kahani` : 'Our kahani'}
      </ScreenTitle>
      <button type="button" class="btn btn-primary btn-block no-print" onClick={() => print()}>
        🖨️ Print or save as PDF
      </button>
      <p class="book-names">
        {d.me === 'You' ? 'Us' : d.me} &amp; {d.partner}
      </p>
      {chapters.map(
        (c) =>
          c.lines.length > 0 && (
            <div key={c.name} class="book-chapter">
              <h2 class="sub-title">{c.name}</h2>
              {c.lines.map((l, i) => (
                <p key={i} class="small">
                  <b>{l.q}</b>
                  <br />
                  {d.me === 'You' ? 'Me' : d.me}: {l.me} · {d.partner}: {l.them}
                </p>
              ))}
            </div>
          ),
      )}
      {thanks.length > 0 && (
        <div class="book-chapter">
          <h2 class="sub-title">Shukriya</h2>
          {thanks.map((t) => (
            <p key={t.id} class="small">
              💛 {t.mine ? 'Me' : d.partner}: {t.data.t}
            </p>
          ))}
        </div>
      )}
      {dreams.length > 0 && (
        <div class="book-chapter">
          <h2 class="sub-title">Dreams</h2>
          {dreams.map((x) => (
            <p key={x.id} class="small">
              {DREAM_TYPES.find(([id]) => id === x.data.type)?.[1] ?? '🌠'} {x.data.t}
            </p>
          ))}
        </div>
      )}
      {stories.length > 0 && (
        <div class="book-chapter">
          <h2 class="sub-title">Our stories</h2>
          {stories.map((s) => (
            <p key={s.id} class="small">
              <i>{s.data.start}</i> {s.data.lines.map((l) => l.t).join(' ')}
            </p>
          ))}
        </div>
      )}
      <p class="small muted no-print">Photos and voice notes are in the zip on Room data while they are kept (28 days each).</p>
    </section>
  );
}
