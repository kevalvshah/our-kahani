import { render } from 'preact';
import { App } from './ui/App';
import { captureInstallPrompt } from './ui/Install';
import { applyLook, loadLook } from './ui/look';
import './ui/tokens.css';
import './ui/app.css';

// Apply this device's look before the first render.
applyLook(loadLook());
captureInstallPrompt();

render(<App />, document.getElementById('app')!);

// Offline shell and Home Screen install. Production only, so development always sees fresh code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
