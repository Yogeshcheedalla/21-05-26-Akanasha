'use client';

declare global {
  interface Window {
    __akanshaStopAllAudio?: () => void;
    __akanshaAudioOwner?: string;
  }
}

export function hardCancelBrowserSpeech() {
  if (typeof window === 'undefined') return;

  window.speechSynthesis?.cancel();
  window.setTimeout(() => window.speechSynthesis?.cancel(), 0);
  window.setTimeout(() => window.speechSynthesis?.cancel(), 80);
}

export async function settleBrowserSpeechCancel(delayMs = 90) {
  hardCancelBrowserSpeech();
  await new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

export function claimAkanshaAudio(ownerId: string, stopCurrentOwner: () => void) {
  if (typeof window === 'undefined') return;

  if (
    window.__akanshaAudioOwner &&
    window.__akanshaAudioOwner !== ownerId &&
    window.__akanshaStopAllAudio
  ) {
    window.__akanshaStopAllAudio();
  }

  window.__akanshaAudioOwner = ownerId;
  window.__akanshaStopAllAudio = stopCurrentOwner;
  hardCancelBrowserSpeech();
}

export function releaseAkanshaAudio(ownerId: string) {
  if (typeof window === 'undefined') return;
  if (window.__akanshaAudioOwner !== ownerId) return;

  window.__akanshaStopAllAudio = undefined;
  window.__akanshaAudioOwner = undefined;
}
