'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type VoiceGender = 'male' | 'female';
export type VoiceTone = 'friendly' | 'professional' | 'energetic' | 'calm';
export type VoiceLanguagePreference = 'telugu_english' | 'english' | 'hindi';

interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: VoiceGender;
  kind?: 'system' | 'sample';
}

interface SpeakOptions {
  voiceGender?: VoiceGender;
  voiceTone?: VoiceTone;
  voiceLanguage?: VoiceLanguagePreference;
}
interface QueueSpeakOptions extends SpeakOptions {
  queue?: boolean;
}

interface QueuedSpeechItem {
  text: string;
  options?: SpeakOptions;
  preparedAudio?: Promise<Blob | null>;
}

type VoiceLanguageMode = 'english' | 'telugu' | 'mixed' | 'hindi';

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  finalTranscript: string;
  speakingVolume: number;
  viseme: number;
}

const TONE_CONFIG: Record<VoiceTone, { rate: number; pitch: number; volume: number }> = {
  friendly: { rate: 1, pitch: 1.05, volume: 0.95 },
  professional: { rate: 0.98, pitch: 0.96, volume: 0.92 },
  energetic: { rate: 1.08, pitch: 1.12, volume: 1 },
  calm: { rate: 0.9, pitch: 0.94, volume: 0.88 },
};

function inferGender(name: string): VoiceGender {
  const normalized = name.toLowerCase();
  if (
    [
      'female',
      'samantha',
      'victoria',
      'karen',
      'zira',
      'aria',
      'sara',
      'jenny',
      'ava',
      'nancy',
      'lisa',
      'hazel',
      'heera',
      'priya',
    ].some((token) => normalized.includes(token))
  ) {
    return 'female';
  }

  if (
    [
      'male',
      'david',
      'mark',
      'daniel',
      'alex',
      'george',
      'james',
      'guy',
      'ryan',
      'adam',
      'aaron',
      'leo',
      'rohan',
      'rahul',
    ].some((token) => normalized.includes(token))
  ) {
    return 'male';
  }

  return 'male';
}

const FEMALE_SAMPLE_VOICE_ID = 'sample-irina-energetic';
const FEMALE_SAMPLE_PATH = '/audio/irina-energetic.mp3';
const FEMALE_SAMPLE_OPTION: VoiceOption = {
  id: FEMALE_SAMPLE_VOICE_ID,
  name: 'Irina energetic e-commerce girl (sample)',
  lang: 'en-US',
  gender: 'female',
  kind: 'sample',
};

function detectVoiceLanguageMode(
  text: string,
  preference: VoiceLanguagePreference
): VoiceLanguageMode {
  if (preference === 'english') return 'english';
  if (preference === 'hindi') return 'hindi';

  const teluguChars = (text.match(/[\u0C00-\u0C7F]/g) ?? []).length;
  const hindiChars = (text.match(/[\u0900-\u097F]/g) ?? []).length;
  const latinChars = (text.match(/[A-Za-z]/g) ?? []).length;

  if (hindiChars > 0) {
    return 'hindi';
  }
  if (teluguChars > 0 && latinChars > 0) {
    return 'mixed';
  }
  if (teluguChars > 0) {
    return 'telugu';
  }
  return 'english';
}

function languageMatches(lang: string, mode: VoiceLanguageMode) {
  const normalized = lang.toLowerCase();
  if (mode === 'hindi') {
    return normalized.startsWith('hi');
  }
  if (mode === 'telugu') {
    return normalized.startsWith('te');
  }
  if (mode === 'mixed') {
    return normalized.startsWith('te') || normalized.startsWith('en-in') || normalized.includes('india');
  }
  return normalized.startsWith('en');
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    finalTranscript: '',
    speakingVolume: 0,
    viseme: 0,
  });
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [voiceTone, setVoiceTone] = useState<VoiceTone>('friendly');
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguagePreference>('telugu_english');
  const [backgroundListening, setBackgroundListening] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const manuallyStoppedRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const visemeIntervalRef = useRef<number | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const speechQueueRef = useRef<QueuedSpeechItem[]>([]);
  const processingQueueRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceElementRef = useRef<HTMLAudioElement | null>(null);
  const audioFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    sampleAudioRef.current = new Audio(FEMALE_SAMPLE_PATH);
    playbackAudioRef.current = new Audio();

    const hydrateVoices = () => {
      const synth = window.speechSynthesis;
      synthRef.current = synth;
      const voices = [
        FEMALE_SAMPLE_OPTION,
        ...synth
          .getVoices()
          .map((voice) => ({
            id: voice.voiceURI,
            name: voice.name,
            lang: voice.lang,
            gender: inferGender(voice.name),
            kind: 'system' as const,
          }))
          .filter((voice) => {
            const normalized = voice.lang.toLowerCase();
            return (
              normalized.startsWith('en') ||
              normalized.startsWith('te') ||
              normalized.startsWith('hi') ||
              normalized.includes('india')
            );
          }),
      ];

      setAvailableVoices(voices);
      if (!selectedVoiceId && voices.length) {
        const preferred = voices.find((voice) => voice.gender === voiceGender) ?? voices[0];
        setSelectedVoiceId(preferred.id);
      }
    };

    hydrateVoices();
    window.speechSynthesis.onvoiceschanged = hydrateVoices;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang =
        voiceLanguage === 'english'
          ? 'en-IN'
          : voiceLanguage === 'hindi'
            ? 'hi-IN'
            : 'te-IN';

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalResult = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const value = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) {
            finalResult += `${value} `;
          } else {
            interim += `${value} `;
          }
        }

        setState((previous) => ({
          ...previous,
          transcript: interim.trim(),
          finalTranscript: finalResult.trim() || previous.finalTranscript,
        }));
      };

      recognition.onstart = () => {
        manuallyStoppedRef.current = false;
        setState((previous) => ({ ...previous, isListening: true }));
      };

      recognition.onerror = () => {
        setState((previous) => ({ ...previous, isListening: false }));
      };

      recognition.onend = () => {
        setState((previous) => ({ ...previous, isListening: false }));
        if (backgroundListening && !manuallyStoppedRef.current) {
          window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // no-op; browser may reject overlapping starts
            }
          }, 250);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [backgroundListening, selectedVoiceId, voiceGender, voiceLanguage]);

  useEffect(() => {
    if (!availableVoices.length) return;

    const current = availableVoices.find((voice) => voice.id === selectedVoiceId);
    const genderMatched = availableVoices.find((voice) => voice.gender === voiceGender);
    const languageMatched = availableVoices.find(
      (voice) =>
        voice.gender === voiceGender &&
        languageMatches(
          voice.lang,
          voiceLanguage === 'english'
            ? 'english'
            : voiceLanguage === 'hindi'
              ? 'hindi'
              : 'mixed'
        )
    );
    const selected =
      current && current.gender === voiceGender
        ? current
        : (languageMatched ?? genderMatched ?? current ?? availableVoices[0]);

    if (selected.id !== selectedVoiceId) {
      setSelectedVoiceId(selected.id);
    }

    if (typeof window !== 'undefined') {
      voiceRef.current =
        window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === selected.id) ?? null;
    }
  }, [availableVoices, selectedVoiceId, voiceGender, voiceLanguage]);

  useEffect(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.lang =
      voiceLanguage === 'english'
        ? 'en-IN'
        : voiceLanguage === 'hindi'
          ? 'hi-IN'
          : 'te-IN';
  }, [voiceLanguage]);

  const voiceChoices = useMemo(
    () => {
      const filteredVoices = availableVoices.filter(
        (voice) =>
          voice.gender === voiceGender &&
          languageMatches(
            voice.lang,
            voiceLanguage === 'english'
              ? 'english'
              : voiceLanguage === 'hindi'
                ? 'hindi'
                : 'mixed'
          )
      );

      return filteredVoices.length
        ? filteredVoices
        : availableVoices.filter((voice) => voice.gender === voiceGender);
    },
    [availableVoices, voiceGender, voiceLanguage]
  );

  const startVisemeAnimation = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (visemeIntervalRef.current) {
      window.clearInterval(visemeIntervalRef.current);
    }

    visemeIntervalRef.current = window.setInterval(() => {
      setState((previous) => ({
        ...previous,
        speakingVolume: 0.35 + Math.random() * 0.65,
        viseme: (previous.viseme + 1) % 5,
      }));
    }, 110);
  }, []);

  const stopVisemeAnimation = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (visemeIntervalRef.current) {
      window.clearInterval(visemeIntervalRef.current);
      visemeIntervalRef.current = null;
    }
    setState((previous) => ({ ...previous, speakingVolume: 0, viseme: 0 }));
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (audioFrameRef.current) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }
  }, []);

  const startSampleAudioAnalysis = useCallback(() => {
    if (typeof window === 'undefined' || !sampleAudioRef.current) return;

    const sampleAudio = sampleAudioRef.current;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }

      const context = audioContextRef.current;

      if (context.state === 'suspended') {
        void context.resume();
      }

      if (!sourceNodeRef.current || sourceElementRef.current !== sampleAudio) {
        sourceNodeRef.current?.disconnect();
        sourceNodeRef.current = context.createMediaElementSource(sampleAudio);
        sourceElementRef.current = sampleAudio;
      }

      if (!analyserRef.current) {
        analyserRef.current = context.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.82;
      }

      sourceNodeRef.current.disconnect();
      analyserRef.current.disconnect();
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(context.destination);

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / Math.max(1, dataArray.length);
        const normalized = Math.min(1, average / 110);

        setState((previous) => ({
          ...previous,
          speakingVolume: normalized,
          viseme: Math.max(0, Math.min(5, Math.round(normalized * 5))),
        }));

        audioFrameRef.current = window.requestAnimationFrame(tick);
      };

      stopAudioAnalysis();
      tick();
    } catch {
      startVisemeAnimation();
    }
  }, [startVisemeAnimation, stopAudioAnalysis]);

  const startPlaybackAudioAnalysis = useCallback(() => {
    if (typeof window === 'undefined' || !playbackAudioRef.current) return;

    const playbackAudio = playbackAudioRef.current;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }

      const context = audioContextRef.current;

      if (context.state === 'suspended') {
        void context.resume();
      }

      if (!sourceNodeRef.current || sourceElementRef.current !== playbackAudio) {
        sourceNodeRef.current?.disconnect();
        sourceNodeRef.current = context.createMediaElementSource(playbackAudio);
        sourceElementRef.current = playbackAudio;
      }

      if (!analyserRef.current) {
        analyserRef.current = context.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.82;
      }

      sourceNodeRef.current.disconnect();
      analyserRef.current.disconnect();
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(context.destination);

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / Math.max(1, dataArray.length);
        const normalized = Math.min(1, average / 110);

        setState((previous) => ({
          ...previous,
          speakingVolume: normalized,
          viseme: Math.max(0, Math.min(5, Math.round(normalized * 5))),
        }));

        audioFrameRef.current = window.requestAnimationFrame(tick);
      };

      stopAudioAnalysis();
      tick();
    } catch {
      startVisemeAnimation();
    }
  }, [startVisemeAnimation, stopAudioAnalysis]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || state.isListening) return;
    if (state.isSpeaking) {
      synthRef.current?.cancel();
    }

    try {
      manuallyStoppedRef.current = false;
      recognitionRef.current.start();
    } catch {
      // Browsers throw if start is called twice in a row.
    }
  }, [state.isListening, state.isSpeaking]);

  const stopListening = useCallback(() => {
    manuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const clearTranscript = useCallback(() => {
    setState((previous) => ({ ...previous, transcript: '', finalTranscript: '' }));
  }, []);

  const fetchSpeechBlob = useCallback(
    async (text: string, options?: SpeakOptions) => {
      const resolvedGender = options?.voiceGender ?? voiceGender;
      const resolvedTone = options?.voiceTone ?? voiceTone;
      const resolvedLanguagePreference = options?.voiceLanguage ?? voiceLanguage;
      const languageMode = detectVoiceLanguageMode(text, resolvedLanguagePreference);

      try {
        const ttsResponse = await fetch('http://localhost:8000/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice_gender: resolvedGender,
            voice_tone: resolvedTone,
            language_mode: languageMode,
          }),
        });

        if (!ttsResponse.ok) {
          return null;
        }

        return await ttsResponse.blob();
      } catch {
        return null;
      }
    },
    [voiceGender, voiceLanguage, voiceTone]
  );

  const playSpeechChunk = useCallback(
    async (item: QueuedSpeechItem) => {
      if (typeof window === 'undefined' || !synthRef.current) return;
      const text = item.text;
      const options = item.options;

      const resolvedGender = options?.voiceGender ?? voiceGender;
      synthRef.current.cancel();
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current.currentTime = 0;
      }
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
        playbackAudioRef.current.currentTime = 0;
      }
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }

      const resolvedTone = options?.voiceTone ?? voiceTone;
      const resolvedLanguagePreference = options?.voiceLanguage ?? voiceLanguage;
      const languageMode = detectVoiceLanguageMode(text, resolvedLanguagePreference);

      try {
        const blob = item.preparedAudio ? await item.preparedAudio : await fetchSpeechBlob(text, options);
        if (blob && playbackAudioRef.current) {
          const playbackUrl = URL.createObjectURL(blob);
          playbackUrlRef.current = playbackUrl;

          const audio = playbackAudioRef.current;
          audio.src = playbackUrl;
          audio.currentTime = 0;

          audio.onplay = () => {
            setState((previous) => ({ ...previous, isSpeaking: true }));
            startPlaybackAudioAnalysis();
          };

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              stopAudioAnalysis();
              setState((previous) => ({
                ...previous,
                isSpeaking: false,
                speakingVolume: 0,
                viseme: 0,
              }));
              resolve();
            };

            audio.onerror = () => {
              stopAudioAnalysis();
              setState((previous) => ({
                ...previous,
                isSpeaking: false,
                speakingVolume: 0,
                viseme: 0,
              }));
              reject(new Error('Audio playback failed'));
            };

            void audio.play().catch(reject);
          });
          return;
        }
      } catch {
        // fall back to browser speech synthesis below
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang =
        languageMode === 'hindi' ? 'hi-IN' : languageMode === 'telugu' || languageMode === 'mixed' ? 'te-IN' : 'en-IN';
      const matchingVoice =
        (selectedVoiceId === FEMALE_SAMPLE_VOICE_ID
          ? null
          : window.speechSynthesis
              .getVoices()
              .find(
                (voice) =>
                  voice.voiceURI === selectedVoiceId && languageMatches(voice.lang, languageMode)
              )) ??
        window.speechSynthesis
          .getVoices()
          .find(
            (voice) =>
              inferGender(voice.name) === resolvedGender && languageMatches(voice.lang, languageMode)
          ) ??
        window.speechSynthesis
          .getVoices()
          .find((voice) => inferGender(voice.name) === resolvedGender) ??
        voiceRef.current;

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.rate = TONE_CONFIG[resolvedTone].rate;
      utterance.pitch = TONE_CONFIG[resolvedTone].pitch;
      utterance.volume = TONE_CONFIG[resolvedTone].volume;

      utterance.onstart = () => {
        setState((previous) => ({ ...previous, isSpeaking: true }));
        startVisemeAnimation();
      };

      await new Promise<void>((resolve, reject) => {
        utterance.onend = () => {
          setState((previous) => ({ ...previous, isSpeaking: false }));
          stopVisemeAnimation();
          resolve();
        };

        utterance.onerror = () => {
          setState((previous) => ({ ...previous, isSpeaking: false }));
          stopVisemeAnimation();
          reject(new Error('Speech synthesis failed'));
        };

        synthRef.current?.speak(utterance);
      });
    },
    [
      selectedVoiceId,
      fetchSpeechBlob,
      startVisemeAnimation,
      stopAudioAnalysis,
      stopVisemeAnimation,
      voiceGender,
      voiceLanguage,
      voiceTone,
    ]
  );

  const processSpeechQueue = useCallback(async () => {
    if (processingQueueRef.current) return;
    processingQueueRef.current = true;
    stopRequestedRef.current = false;

    while (!stopRequestedRef.current && speechQueueRef.current.length > 0) {
      const nextItem = speechQueueRef.current.shift();
      if (!nextItem?.text.trim()) continue;

      try {
        await playSpeechChunk(nextItem);
      } catch {
        // Skip failed chunks and keep the queue moving.
      }
    }

    processingQueueRef.current = false;
    if (!stopRequestedRef.current && backgroundListening) {
      startListening();
    }
  }, [backgroundListening, playSpeechChunk, startListening]);

  const speak = useCallback(
    async (text: string, options?: QueueSpeakOptions) => {
      if (!text.trim()) return;

      if (!options?.queue) {
        stopRequestedRef.current = true;
        speechQueueRef.current = [];
        synthRef.current?.cancel();
        if (sampleAudioRef.current) {
          sampleAudioRef.current.pause();
          sampleAudioRef.current.currentTime = 0;
        }
        if (playbackAudioRef.current) {
          playbackAudioRef.current.pause();
          playbackAudioRef.current.currentTime = 0;
        }
        if (playbackUrlRef.current) {
          URL.revokeObjectURL(playbackUrlRef.current);
          playbackUrlRef.current = null;
        }
        stopAudioAnalysis();
        stopVisemeAnimation();
      }

      stopRequestedRef.current = false;
      if (options?.queue && speechQueueRef.current.length > 0) {
        const lastIndex = speechQueueRef.current.length - 1;
        const lastQueuedItem = speechQueueRef.current[lastIndex];
        const currentGender = options.voiceGender ?? voiceGender;
        const currentTone = options.voiceTone ?? voiceTone;
        const currentLanguage = options.voiceLanguage ?? voiceLanguage;
        const lastGender = lastQueuedItem.options?.voiceGender ?? voiceGender;
        const lastTone = lastQueuedItem.options?.voiceTone ?? voiceTone;
        const lastLanguage = lastQueuedItem.options?.voiceLanguage ?? voiceLanguage;

        if (
          lastGender === currentGender &&
          lastTone === currentTone &&
          lastLanguage === currentLanguage
        ) {
          const mergedText = `${lastQueuedItem.text.trim()} ${text.trim()}`.trim();
          speechQueueRef.current[lastIndex] = {
            ...lastQueuedItem,
            text: mergedText,
            preparedAudio: fetchSpeechBlob(mergedText, lastQueuedItem.options),
          };
          void processSpeechQueue();
          return;
        }
      }

      speechQueueRef.current.push({
        text,
        options,
        preparedAudio: options?.queue ? fetchSpeechBlob(text, options) : undefined,
      });
      void processSpeechQueue();
    },
    [
      fetchSpeechBlob,
      processSpeechQueue,
      stopAudioAnalysis,
      stopVisemeAnimation,
      voiceGender,
      voiceLanguage,
      voiceTone,
    ]
  );

  const stopSpeaking = useCallback(() => {
    stopRequestedRef.current = true;
    speechQueueRef.current = [];
    synthRef.current?.cancel();
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current.currentTime = 0;
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    setState((previous) => ({ ...previous, isSpeaking: false }));
    stopVisemeAnimation();
    stopAudioAnalysis();
  }, [stopAudioAnalysis, stopVisemeAnimation]);

  const previewSelectedVoice = useCallback(() => {
    if (selectedVoiceId === FEMALE_SAMPLE_VOICE_ID && sampleAudioRef.current) {
      const sampleAudio = sampleAudioRef.current;
      sampleAudio.pause();
      sampleAudio.currentTime = 0;
      stopVisemeAnimation();
      stopAudioAnalysis();
      setState((previous) => ({ ...previous, isSpeaking: true, speakingVolume: 0, viseme: 0 }));
      startSampleAudioAnalysis();

      sampleAudio.onended = () => {
        stopAudioAnalysis();
        setState((previous) => ({ ...previous, isSpeaking: false, speakingVolume: 0, viseme: 0 }));
      };

      void sampleAudio.play().catch(() => {
        stopAudioAnalysis();
        setState((previous) => ({ ...previous, isSpeaking: false, speakingVolume: 0, viseme: 0 }));
      });
      return;
    }

    speak("Hi, I'm Akansha. I'm ready to talk with you naturally.", {
      voiceGender,
      voiceTone,
    });
  }, [selectedVoiceId, speak, startSampleAudioAnalysis, stopAudioAnalysis, stopVisemeAnimation, voiceGender, voiceTone]);

  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
      }
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
    };
  }, [stopAudioAnalysis]);

  return {
    ...state,
    availableVoices,
    voiceChoices,
    voiceGender,
    voiceTone,
    voiceLanguage,
    backgroundListening,
    selectedVoiceId,
    setVoiceGender,
    setVoiceTone,
    setVoiceLanguage,
    setBackgroundListening,
    setSelectedVoiceId,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    previewSelectedVoice,
    clearTranscript,
  };
}
