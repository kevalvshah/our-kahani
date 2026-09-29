// Voice notes: 30 seconds at most, about 32 kbps, in whatever format this browser can record
// (Opus in WebM on Chrome and Firefox, AAC in MP4 on Safari). The audio is encrypted with the
// room key before it leaves the phone.

export const VOICE_SECONDS = 30;
const PREFERRED = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];

interface RecorderLike {
  isTypeSupported(type: string): boolean;
}

/** The first format this browser can record, or '' when it cannot record at all. */
export function voiceType(rec: RecorderLike | undefined = globalThis.MediaRecorder): string {
  if (!rec || typeof rec.isTypeSupported !== 'function') return '';
  return PREFERRED.find((t) => rec.isTypeSupported(t)) ?? '';
}
