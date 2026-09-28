import type { ComponentChildren, JSX } from 'preact';
import type { Tint } from '../packs/official';
import { navigate } from './router';

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

export function Row({
  emoji,
  tint,
  title,
  sub,
  pill,
  href,
}: {
  emoji: string;
  tint: Tint;
  title: string;
  sub: string;
  pill: string;
  href?: string;
}) {
  const inner = (
    <>
      <Em tile tint={tint}>{emoji}</Em>
      <span class="row-text">
        <span class="row-title">{title}</span>
        <span class="row-sub">{sub}</span>
      </span>
      <span class={`pill tint-${tint}`}>{pill}</span>
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

export function Soon() {
  return <span class="soon">Soon</span>;
}
