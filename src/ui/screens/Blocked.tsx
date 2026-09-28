import { useState } from 'preact/hooks';

// Shown instead of the app inside Instagram or Facebook. The invite fragment is left untouched
// so "Open in browser" carries the whole link across.
export function Blocked() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main class="blocked">
      <div class="blocked-inner">
        <div class="blocked-door" aria-hidden="true">🚪</div>
        <h1 class="screen-title">Open this in Safari or Chrome</h1>
        <p class="lead">
          You opened the link inside Instagram's browser. It cannot keep your room's key safely, so we have
          not touched it yet. Tap the ••• menu, choose “Open in browser”, and carry on there.
        </p>
        <button type="button" class="btn btn-primary" onClick={copy}>
          {copied ? 'Copied. Now paste it in Safari or Chrome' : 'Copy the link instead'}
        </button>
      </div>
    </main>
  );
}
