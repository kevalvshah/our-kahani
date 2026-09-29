import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

// Loads a screen's code only when it is first opened, so the first screen stays small on slow
// phones. Same origin only (CSP script-src 'self').
export function lazy<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  let cached: ComponentType<P> | null = null;
  return function Lazy(props: P) {
    const [C, setC] = useState<ComponentType<P> | null>(() => cached);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      if (cached) return;
      let live = true;
      load()
        .then((c) => {
          cached = c;
          if (live) setC(() => c);
        })
        .catch(() => live && setFailed(true));
      return () => {
        live = false;
      };
    }, []);
    if (failed) {
      return (
        <p class="caption error" role="alert">
          This part of the app did not load. Check your connection and reload.
        </p>
      );
    }
    return C ? <C {...props} /> : <p class="caption" role="status">Loading…</p>;
  };
}
