import { useEffect, useState } from 'preact/hooks';

// A tiny path router. Cloudflare Pages serves index.html for every path, so these are real
// URLs that survive reloads and can be bookmarked. Paths hold only ids that are already opaque
// to the server (card refs, pack ids), never anything a person wrote.

export type Route =
  | { name: 'today' }
  | { name: 'card'; ref: string }
  | { name: 'next' }
  | { name: 'packs' }
  | { name: 'pack'; id: string }
  | { name: 'add' }
  | { name: 'micro' }
  | { name: 'antakshari' }
  | { name: 'story' }
  | { name: 'capsule' }
  | { name: 'movie' }
  | { name: 'photo' }
  | { name: 'gentle' }
  | { name: 'saved' }
  | { name: 'room' }
  | { name: 'invite' }
  | { name: 'look' }
  | { name: 'privacy' }
  | { name: 'recover' }
  | { name: 'join' };

export type RouteName = Route['name'];

export const PATHS = {
  today: '/',
  next: '/card',
  packs: '/packs',
  add: '/add-a-card',
  micro: '/micro-dates',
  antakshari: '/antakshari',
  story: '/story-relay',
  capsule: '/time-capsule',
  movie: '/movie',
  photo: '/right-now',
  gentle: '/gentle',
  saved: '/saved',
  room: '/room',
  invite: '/invite',
  look: '/look',
  privacy: '/privacy',
  recover: '/recover',
} as const;

/** "day:3" -> "/card/day/3"; "pack:warm:2" -> "/card/pack/warm/2"; "bonus:<id>" -> "/card/bonus/<id>" */
export function cardPath(ref: string): string {
  return `/card/${ref.split(':').map(encodeURIComponent).join('/')}`;
}

export function packPath(id: string): string {
  return `/packs/${encodeURIComponent(id)}`;
}

export function routeFromPath(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (/^\/join\//.test(clean)) return { name: 'join' };
  const card = /^\/card\/(.+)$/.exec(clean);
  if (card) {
    const ref = card[1]!.split('/').map(decodeURIComponent).join(':');
    return /^[A-Za-z0-9._:-]{1,64}$/.test(ref) ? { name: 'card', ref } : { name: 'today' };
  }
  const pack = /^\/packs\/([a-z]+)$/.exec(clean);
  if (pack) return { name: 'pack', id: pack[1]! };
  const hit = (Object.entries(PATHS) as [RouteName, string][]).find(([, p]) => p === clean);
  return hit ? ({ name: hit[0] } as Route) : { name: 'today' };
}

const listeners = new Set<() => void>();

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (to === location.pathname) return;
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => routeFromPath(location.pathname));
  useEffect(() => {
    const update = () => setRoute(routeFromPath(location.pathname));
    listeners.add(update);
    addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      removeEventListener('popstate', update);
    };
  }, []);
  return route;
}
