import { useState } from 'preact/hooks';
import { LANGS } from '../content/extras';

// The name and tagline, with the name in ten Indic scripts (to be reviewed by native speakers).
export function Brand() {
  const [lang, setLang] = useState('hi');
  const L = LANGS.find((x) => x[0] === lang) ?? LANGS[0]!;
  return (
    <div class="brand">
      <h1 class="hero" tabIndex={-1}>
        From pehli baat <em>to our kahani.</em> <span aria-hidden="true">💛</span>
      </h1>
      <p class="small muted">Pehli baat means “first conversation”.</p>
      <p class="indic" lang={L[0]} dir={L[0] === 'ur' ? 'rtl' : 'ltr'}>
        <b>{L[2]}</b> · {L[3]}
      </p>
      <div class="chip-row" role="group" aria-label="See the name in another language">
        {LANGS.map((x) => (
          <button key={x[0]} type="button" lang={x[0]} class={lang === x[0] ? 'chip chip-small is-on' : 'chip chip-small'} aria-pressed={lang === x[0]} onClick={() => setLang(x[0])}>
            {x[1]}
          </button>
        ))}
      </div>
    </div>
  );
}
