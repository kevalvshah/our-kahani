import { useEffect, useState } from 'preact/hooks';

// A tiny path router. Cloudflare Pages serves index.html for every path, so these are real
// URLs that survive reloads and can be bookmarked.

export type Route =
  | 'today' | 'card' | 'packs' | 'movie' | 'photo' | 'gentle'
  | 'saved' | 'room' | 'invite' | 'look' | 'join';

export const PATHS: Record<Exclude<Route, 'join'>, string> = {
  today: '/',
  card: '/card',
  packs: '/packs',
  movie: '/movie',
  photo: '/right-now',
  gentle: '/gentle',
  saved: '/saved',
  room: '/room',
  invite: '/invite',
  look: '/look',
};

export function routeFromPath(pathname: string): Route {
  if (/^\/join\//.test(pathname)) return 'join';
  const clean = pathname.replace(/\/+$/, '') || '/';
  const hit = (Object.entries(PATHS) as [Route, string][]).find(([, p]) => p === clean);
  return hit ? hit[0] : 'today';
}

const listeners = new Set<() => void>();

export function navigate(to: string): void {
  if (to === location.pathname) return;
  history.pushState(null, '', to);
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
