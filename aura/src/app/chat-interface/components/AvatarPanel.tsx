'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Minimize2, Maximize2 } from 'lucide-react';

export type Emotion = 'neutral' | 'happy' | 'thinking' | 'surprised' | 'sad' | 'speaking';

interface AvatarPanelProps {
  emotion: Emotion;
  isSpeaking: boolean;
  isListening: boolean;
  onToggleMic: () => void;
  onToggleVoice: () => void;
  voiceEnabled: boolean;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

const EMOTION_COLORS: Record<Emotion, string> = {
  neutral: '#6C47FF',
  happy: '#00C9A7',
  thinking: '#F59E0B',
  surprised: '#EF4444',
  sad: '#6B7280',
  speaking: '#6C47FF',
};

const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: 'Ready',
  happy: 'Happy',
  thinking: 'Thinking...',
  surprised: 'Surprised!',
  sad: 'Empathetic',
  speaking: 'Speaking',
};

export default function AvatarPanel({
  emotion,
  isSpeaking,
  isListening,
  onToggleMic,
  onToggleVoice,
  voiceEnabled,
  minimized = false,
  onToggleMinimize,
}: AvatarPanelProps) {
  const [blinkState, setBlinkState] = useState(false);
  const [headTilt, setHeadTilt] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [eyeX, setEyeX] = useState(0);
  const [eyeY, setEyeY] = useState(0);
  const blinkRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Blinking animation
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      blinkRef.current = setTimeout(() => {
        setBlinkState(true);
        setTimeout(() => setBlinkState(false), 150);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => { if (blinkRef.current) clearTimeout(blinkRef.current); };
  }, []);

  // Lip-sync / mouth animation when speaking
  useEffect(() => {
    if (isSpeaking) {
      speakRef.current = setInterval(() => {
        setMouthOpen(Math.random() * 8 + 2);
      }, 120);
    } else {
      if (speakRef.current) clearInterval(speakRef.current);
      setMouthOpen(0);
    }
    return () => { if (speakRef.current) clearInterval(speakRef.current); };
  }, [isSpeaking]);

  // Head nodding when thinking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (emotion === 'thinking') {
      let t = 0;
      interval = setInterval(() => {
        t += 0.1;
        setHeadTilt(Math.sin(t) * 4);
      }, 50);
    } else if (emotion === 'happy') {
      let t = 0;
      interval = setInterval(() => {
        t += 0.15;
        setHeadTilt(Math.sin(t) * 2);
      }, 50);
    } else {
      setHeadTilt(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [emotion]);

  // Eye movement
  useEffect(() => {
    const moveEyes = () => {
      setEyeX((Math.random() - 0.5) * 4);
      setEyeY((Math.random() - 0.5) * 2);
    };
    let interval = setInterval(moveEyes, 2500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const accentColor = EMOTION_COLORS[emotion];

  // Emotion-based face features
  const getBrowStyle = () => {
    switch (emotion) {
      case 'thinking': return { transform: 'rotate(-8deg) translateY(-2px)', left: '28%' };
      case 'surprised': return { transform: 'rotate(0deg) translateY(-5px)', left: '28%' };
      case 'sad': return { transform: 'rotate(8deg) translateY(-1px)', left: '28%' };
      case 'happy': return { transform: 'rotate(-3deg) translateY(-1px)', left: '28%' };
      default: return { transform: 'rotate(0deg)', left: '28%' };
    }
  };

  const getRightBrowStyle = () => {
    switch (emotion) {
      case 'thinking': return { transform: 'rotate(8deg) translateY(-2px)', right: '28%' };
      case 'surprised': return { transform: 'rotate(0deg) translateY(-5px)', right: '28%' };
      case 'sad': return { transform: 'rotate(-8deg) translateY(-1px)', right: '28%' };
      case 'happy': return { transform: 'rotate(3deg) translateY(-1px)', right: '28%' };
      default: return { transform: 'rotate(0deg)', right: '28%' };
    }
  };

  const getMouthPath = () => {
    if (isSpeaking && mouthOpen > 0) {
      return `M 30 50 Q 50 ${50 + mouthOpen} 70 50`;
    }
    switch (emotion) {
      case 'happy': return 'M 30 48 Q 50 62 70 48';
      case 'sad': return 'M 30 56 Q 50 44 70 56';
      case 'surprised': return 'M 38 48 Q 50 60 62 48';
      case 'thinking': return 'M 35 52 Q 50 50 65 48';
      default: return 'M 32 52 Q 50 56 68 52';
    }
  };

  if (minimized) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor}, #00C9A7)` }}
        >
          <span>A</span>
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full border-2 animate-ping"
              style={{ borderColor: accentColor, opacity: 0.4 }} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-foreground">Akansha</span>
          <span className="text-xs text-muted-foreground">{EMOTION_LABELS[emotion]}</span>
        </div>
        <button
          onClick={onToggleMinimize}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          <Maximize2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
      {/* Avatar head */}
      <div className="relative" style={{ transform: `rotate(${headTilt}deg)`, transition: 'transform 0.3s ease' }}>
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-30 scale-110"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)` }}
        />
        {/* Speaking pulse ring */}
        {isSpeaking && (
          <div
            className="absolute inset-0 rounded-full border-2 animate-ping"
            style={{ borderColor: accentColor, opacity: 0.5 }}
          />
        )}
        {/* Listening pulse */}
        {isListening && (
          <div
            className="absolute -inset-2 rounded-full border-2 animate-pulse"
            style={{ borderColor: '#EF4444', opacity: 0.6 }}
          />
        )}

        {/* Face SVG */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          className="relative z-10"
        >
          {/* Head shape */}
          <defs>
            <radialGradient id="faceGrad" cx="45%" cy="40%">
              <stop offset="0%" stopColor="#f5e6d3" />
              <stop offset="100%" stopColor="#e8c9a8" />
            </radialGradient>
            <radialGradient id="hairGrad" cx="50%" cy="30%">
              <stop offset="0%" stopColor="#2d1b69" />
              <stop offset="100%" stopColor="#1a0f3c" />
            </radialGradient>
          </defs>

          {/* Hair */}
          <ellipse cx="50" cy="22" rx="32" ry="20" fill="url(#hairGrad)" />
          <ellipse cx="50" cy="30" rx="30" ry="28" fill="url(#faceGrad)" />

          {/* Neck */}
          <rect x="42" y="76" width="16" height="14" rx="4" fill="#e8c9a8" />

          {/* Shoulders */}
          <ellipse cx="50" cy="95" rx="35" ry="12" fill={`${accentColor}33`} />
          <ellipse cx="50" cy="95" rx="28" ry="9" fill={`${accentColor}55`} />

          {/* Left eyebrow */}
          <path
            d="M 28 32 Q 38 28 44 31"
            stroke="#5a3a1a"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            style={{ ...getBrowStyle(), position: 'absolute' }}
          />

          {/* Right eyebrow */}
          <path
            d="M 56 31 Q 62 28 72 32"
            stroke="#5a3a1a"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            style={{ ...getRightBrowStyle(), position: 'absolute' }}
          />

          {/* Left eye white */}
          <ellipse cx="35" cy="42" rx="8" ry={blinkState ? 1 : 6} fill="white" style={{ transition: 'ry 0.08s' }} />
          {/* Left iris */}
          {!blinkState && (
            <ellipse
              cx={35 + eyeX}
              cy={42 + eyeY}
              rx="4"
              ry="4"
              fill={accentColor}
              style={{ transition: 'cx 0.4s ease, cy 0.4s ease' }}
            />
          )}
          {/* Left pupil */}
          {!blinkState && (
            <ellipse cx={35 + eyeX} cy={42 + eyeY} rx="2" ry="2" fill="#1a0f3c" />
          )}
          {/* Left eye shine */}
          {!blinkState && (
            <ellipse cx={36 + eyeX} cy={40 + eyeY} rx="1" ry="1" fill="white" opacity="0.8" />
          )}

          {/* Right eye white */}
          <ellipse cx="65" cy="42" rx="8" ry={blinkState ? 1 : 6} fill="white" style={{ transition: 'ry 0.08s' }} />
          {/* Right iris */}
          {!blinkState && (
            <ellipse
              cx={65 + eyeX}
              cy={42 + eyeY}
              rx="4"
              ry="4"
              fill={accentColor}
              style={{ transition: 'cx 0.4s ease, cy 0.4s ease' }}
            />
          )}
          {/* Right pupil */}
          {!blinkState && (
            <ellipse cx={65 + eyeX} cy={42 + eyeY} rx="2" ry="2" fill="#1a0f3c" />
          )}
          {/* Right eye shine */}
          {!blinkState && (
            <ellipse cx={66 + eyeX} cy={40 + eyeY} rx="1" ry="1" fill="white" opacity="0.8" />
          )}

          {/* Nose */}
          <path d="M 48 52 Q 46 58 50 60 Q 54 58 52 52" stroke="#c9956a" strokeWidth="1.2" fill="none" strokeLinecap="round" />

          {/* Mouth */}
          <path
            d={getMouthPath()}
            stroke="#c0725a"
            strokeWidth="2.5"
            fill={isSpeaking && mouthOpen > 3 ? '#8B2252' : 'none'}
            strokeLinecap="round"
            style={{ transition: 'd 0.1s ease' }}
          />

          {/* Cheek blush (happy) */}
          {(emotion === 'happy' || emotion === 'speaking') && (
            <>
              <ellipse cx="24" cy="52" rx="7" ry="4" fill="#FFB3B3" opacity="0.4" />
              <ellipse cx="76" cy="52" rx="7" ry="4" fill="#FFB3B3" opacity="0.4" />
            </>
          )}

          {/* Thinking dots */}
          {emotion === 'thinking' && (
            <>
              <circle cx="78" cy="30" r="2" fill={accentColor} opacity="0.8" />
              <circle cx="84" cy="24" r="3" fill={accentColor} opacity="0.6" />
              <circle cx="91" cy="16" r="4" fill={accentColor} opacity="0.4" />
            </>
          )}
        </svg>
      </div>

      {/* Name + emotion badge */}
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Akansha</p>
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-0.5"
          style={{ background: `${accentColor}20`, color: accentColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accentColor, animation: isSpeaking ? 'pulse 0.8s infinite' : 'none' }}
          />
          {EMOTION_LABELS[emotion]}
        </div>
      </div>

      {/* Voice waveform when speaking */}
      {isSpeaking && (
        <div className="flex items-center gap-0.5 h-6">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={`wave-${i}`}
              className="w-1 rounded-full"
              style={{
                background: accentColor,
                height: `${8 + Math.sin(Date.now() / 200 + i) * 8}px`,
                animation: `waveform ${0.4 + i * 0.05}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.07}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMic}
          className={`p-2 rounded-xl transition-all ${
            isListening
              ? 'bg-red-500/15 text-red-500 border border-red-500/30' :'bg-muted text-muted-foreground hover:text-foreground border border-border'
          }`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
        <button
          onClick={onToggleVoice}
          className={`p-2 rounded-xl transition-all ${
            voiceEnabled
              ? 'text-foreground border border-border bg-muted'
              : 'text-muted-foreground border border-border bg-muted opacity-50'
          }`}
          title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
        >
          {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        {onToggleMinimize && (
          <button
            onClick={onToggleMinimize}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground border border-border transition-all"
            title="Minimize avatar"
          >
            <Minimize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
