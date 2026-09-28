import { render } from 'preact';
import { App } from './ui/App';
import { applyLook, loadLook } from './ui/look';
import './ui/tokens.css';
import './ui/app.css';

// Apply this device's look before the first render.
applyLook(loadLook());

render(<App />, document.getElementById('app')!);
