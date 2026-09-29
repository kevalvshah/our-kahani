import { HARD_SIGNS, HARMFUL_SIGNS } from '../../content/together';
import { useMaybeRoomData } from '../../data/RoomData';
import { FIND_A_HELPLINE, safetyFooterFor } from '../../features/safetyFooter';
import { SAFETY_NOTE } from '../../features/together';
import { Back, Link, ScreenTitle } from '../components';
import { PATHS } from '../router';

// "Is this hard, or is this harmful?" A private page for one person: nothing here is sent or
// saved, and it never tells anyone what to do. Only verified numbers are shown (CLAUDE.md rule 9).

export function HardOrHarmful() {
  const d = useMaybeRoomData();
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const footer = safetyFooterFor(d?.myProfile?.country, langs);
  return (
    <section>
      <Back href={d ? PATHS.talk : PATHS.today} label={d ? '← Dil ki Baat' : '← Home'} />
      <ScreenTitle emoji="🧭" lead="Just for you. Nothing on this page is sent to anyone or saved.">
        Is this hard, or is this harmful?
      </ScreenTitle>
      <div class="panel">
        <div class="panel-title">Hard, and very normal 💛</div>
        <ul class="tips">
          {HARD_SIGNS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p class="small">
          This is what most couples go through. Our Kahani can help: {d ? <Link href={PATHS.talk}>say it softly</Link> : 'say it softly'}, take a
          20-minute pause, or just play something silly together.
        </p>
      </div>
      <div class="panel panel-pink">
        <div class="panel-title">Harmful, and not your fault</div>
        <ul class="tips">
          {HARMFUL_SIGNS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p class="small">
          <b>{SAFETY_NOTE}</b> Talking to someone you trust, or a helpline, can help you work out what you want.
        </p>
        <p class="small">
          {footer.country && (
            <>
              {footer.country}: {footer.lines.join(', ')}.
              <br />
            </>
          )}
          {footer.country ? 'Elsewhere' : 'Wherever you are'}: call your local emergency number, or find a free, confidential line at{' '}
          <a href={FIND_A_HELPLINE} rel="noopener noreferrer" target="_blank">
            findahelpline.com
          </a>
          .
        </p>
        <p class="small muted">
          If someone checks your phone, you can close this page at any time. Our Kahani never shows when you last opened it or
          what you read.
        </p>
      </div>
    </section>
  );
}
