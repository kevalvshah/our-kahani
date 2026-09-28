import { VOICE_SECONDS, voiceType } from '../platform/voice';

// Browser glue for recording a voice note (covered by e2e, not unit tests).

export function canRecordVoice(): boolean {
  return !!voiceType() && !!globalThis.navigator?.mediaDevices?.getUserMedia;
}

export interface Recording {
  stop(): void;
  cancel(): void;
  /** Resolves with the audio when recording stops (by stop() or the 30 second cap). */
  done: Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string; secs: number } | null>;
}

export async function startVoice(): Promise<Recording> {
  const type = voiceType();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const recorder = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32_000 });
  const chunks: Blob[] = [];
  const started = Date.now();
  let cancelled = false;
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const cap = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), VOICE_SECONDS * 1000);
  const done = new Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string; secs: number } | null>((resolve) => {
    recorder.onstop = async () => {
      clearTimeout(cap);
      stream.getTracks().forEach((t) => t.stop());
      if (cancelled || !chunks.length) return resolve(null);
      const blob = new Blob(chunks, { type: recorder.mimeType || type });
      const secs = Math.min(VOICE_SECONDS, Math.max(1, Math.round((Date.now() - started) / 1000)));
      resolve({ bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type, secs });
    };
  });
  recorder.start(1000);
  return {
    stop: () => recorder.state !== 'inactive' && recorder.stop(),
    cancel: () => {
      cancelled = true;
      if (recorder.state !== 'inactive') recorder.stop();
    },
    done,
  };
}
