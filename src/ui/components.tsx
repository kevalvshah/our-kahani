import type { ComponentChildren, JSX } from 'preact';
import type { Opt } from '../content/cards';
import { navigate } from './router';

export type Tint = 'gold' | 'pink' | 'accent' | 'plain';

/** An in-app link: a real <a href> (works without JS, middle-click, copy link) routed client-side. */
export function Link({ href, children, ...rest }: JSX.HTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...rest}
      href={href}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

/** Decorative emoji: hidden from screen readers, hidden entirely when emoji icons are off. */
export function Em({ children, tile, tint }: { children: ComponentChildren; tile?: boolean; tint?: Tint }) {
  return (
    <span data-k-em="" aria-hidden="true" class={tile ? `em-tile tint-${tint ?? 'plain'}` : 'em'}>
      {children}
    </span>
  );
}

export function ScreenTitle({ children, emoji, lead }: { children: ComponentChildren; emoji?: string; lead?: ComponentChildren }) {
  return (
    <>
      <h1 class="screen-title" tabIndex={-1}>
        {children}
        {emoji && (
          <>
            {' '}
            <Em>{emoji}</Em>
          </>
        )}
      </h1>
      {lead && <p class="lead">{lead}</p>}
    </>
  );
}

export function Back({ href, label = '← Back' }: { href: string; label?: string }) {
  return (
    <Link class="back" href={href}>
      {label}
    </Link>
  );
}

export function Row({
  emoji,
  tint,
  title,
  sub,
  pill,
  pillTint,
  href,
}: {
  emoji: string;
  tint: Tint;
  title: ComponentChildren;
  sub?: ComponentChildren;
  pill?: ComponentChildren;
  pillTint?: Tint;
  href?: string;
}) {
  const inner = (
    <>
      <Em tile tint={tint}>
        {emoji}
      </Em>
      <span class="row-text">
        <span class="row-title">{title}</span>
        {sub && <span class="row-sub">{sub}</span>}
      </span>
      {pill !== undefined && <span class={`pill tint-${pillTint ?? tint}`}>{pill}</span>}
    </>
  );
  return href ? (
    <Link class="row row-link" href={href}>
      {inner}
    </Link>
  ) : (
    <div class="row">{inner}</div>
  );
}

export function Note({ children, dashed }: { children: ComponentChildren; dashed?: boolean }) {
  return <p class={dashed ? 'note note-dashed' : 'note'}>{children}</p>;
}

export function Wait({ children }: { children: ComponentChildren }) {
  return (
    <div class="wait" role="status">
      {children}
    </div>
  );
}

export function Done({ children }: { children: ComponentChildren }) {
  return (
    <div class="done-msg" role="status">
      {children}
    </div>
  );
}

export function Soon() {
  return <span class="soon">Soon</span>;
}

export function Problem({ text }: { text: string | null }) {
  return text ? (
    <p class="caption error" role="alert">
      {text}
    </p>
  ) : null;
}

/** A big option tile (this-or-that, guess, pick). */
export function OptTile({
  opt,
  picked,
  stack,
  disabled,
  onPick,
  extra,
}: {
  opt: Opt;
  picked: boolean;
  stack?: boolean;
  disabled?: boolean;
  onPick: () => void;
  extra?: string;
}) {
  return (
    <button
      type="button"
      class={`option${stack ? ' option-row' : ''}${picked ? ' is-picked' : ''}`}
      aria-pressed={picked}
      disabled={disabled}
      onClick={onPick}
    >
      <span class="option-emoji" aria-hidden="true">
        {opt.e}
      </span>
      <span class="option-text">
        <span class="option-label">{opt.l}</span>
        {(opt.sub || extra) && <span class="option-sub">{extra ?? opt.sub}</span>}
      </span>
    </button>
  );
}

/** A tick-box row (tick-any cards, Gentle Corner). */
export function Check({ on, disabled, onToggle, children }: { on: boolean; disabled?: boolean; onToggle: () => void; children: ComponentChildren }) {
  return (
    <button type="button" class={on ? 'check is-on' : 'check'} aria-pressed={on} disabled={disabled} onClick={onToggle}>
      <span class="check-box" aria-hidden="true">
        {on ? '☑' : '☐'}
      </span>
      <span>{children}</span>
    </button>
  );
}

/** A row of pill choices (when, where, mood...). */
export function Chips<T extends string>({
  options,
  value,
  onPick,
  label,
}: {
  options: [T, string][];
  value: T | null | undefined;
  onPick: (v: T) => void;
  label: string;
}) {
  return (
    <div class="chip-row" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" class={value === v ? 'chip is-on' : 'chip'} aria-pressed={value === v} onClick={() => onPick(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** One person's line in a reveal. */
export function RevealRow({ who, tone, children }: { who: string; tone: 'mine' | 'theirs' | 'both'; children: ComponentChildren }) {
  return (
    <div class={`reveal-row reveal-${tone}`}>
      <span class="reveal-who">{who}</span>
      <span class="reveal-answer">{children}</span>
    </div>
  );
}

export function Field({
  label,
  value,
  onInput,
  placeholder,
  maxLength,
  id,
  type = 'text',
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  id: string;
  type?: string;
}) {
  return (
    <div class="field-wrap">
      <label class="field-label" for={id}>
        {label}
      </label>
      <input
        id={id}
        class="field"
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autocomplete="off"
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      />
    </div>
  );
}
