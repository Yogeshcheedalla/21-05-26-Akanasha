'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ModelSelector from './ModelSelector';
import MessageBubble from './MessageBubble';
import ChatComposer from './ChatComposer';
import PromptTemplateModal from './PromptTemplateModal';
import AvatarPanel, { type Emotion } from './AvatarPanel';
import {
  Brain,
  Share2,
  MoreHorizontal,
  Star,
  Trash2,
  Mic,
  MicOff,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sessionId?: string;
  model?: string;
  timestamp: Date;
  attachments?: Array<{ id: string; name: string; type: string; size: string }>;
  memoryRefs?: string[];
  isStreaming?: boolean;
  tokenCount?: number;
  emotion?: Emotion;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-001',
    role: 'user',
    content:
      'Can you help me refactor this Express.js auth middleware to use async/await properly and add proper error handling?',
    timestamp: new Date(Date.now() - 8 * 60000),
    attachments: [
      { id: 'att-001', name: 'auth.middleware.ts', type: 'typescript', size: '3.2 KB' },
    ],
  },
  {
    id: 'msg-002',
    role: 'assistant',
    content: `Absolutely! Here's a refactored version of your auth middleware with proper async/await and error handling:\n\n\`\`\`typescript\nimport { Request, Response, NextFunction } from 'express'
;\nimport jwt from 'jsonwebtoken'
;\nimport { UserService } from '../services/user.service'
;\n\nexport const authMiddleware = async (\n  req: Request,\n  res: Response,\n  next: NextFunction\n): Promise<void> => {\n  try {\n    const authHeader = req.headers.authorization;\n    \n    if (!authHeader?.startsWith('Bearer ')) {\n      res.status(401).json({ \n        error: 'Missing or invalid authorization header' \n      });\n      return;\n    }\n\n    const token = authHeader.split(' ')[1];\n    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;\n    \n    const user = await UserService.findById(decoded.userId);\n    if (!user || !user.isActive) {\n      res.status(401).json({ error: 'User not found or inactive' });\n      return;\n    }\n\n    req.user = user;\n    next();\n  } catch (error) {\n    if (error instanceof jwt.TokenExpiredError) {\n      res.status(401).json({ error: 'Token has expired' });\n    } else if (error instanceof jwt.JsonWebTokenError) {\n      res.status(401).json({ error: 'Invalid token' });\n    } else {\n      next(error);\n    }\n  }\n};\n\`\`\`\n\nKey improvements:\n\n1. **Proper async/await** — removed callback-style patterns entirely\n2. **Granular JWT error handling** — distinguishes expired vs. invalid tokens\n3. **Explicit void return type** — prevents accidental response-after-send bugs`,
    model: 'Akansha',
    timestamp: new Date(Date.now() - 7 * 60000),
    tokenCount: 412,
    memoryRefs: ['Node.js expertise', 'TypeScript preference'],
    emotion: 'happy',
  },
  {
    id: 'msg-003',
    role: 'user',
    content: 'This is great! Can you also add rate limiting to this middleware?',
    timestamp: new Date(Date.now() - 4 * 60000),
  },
  {
    id: 'msg-004',
    role: 'assistant',
    content: `Here's how to add rate limiting using \`express-rate-limit\`:\n\n\`\`\`typescript\nimport rateLimit from 'express-rate-limit'\n;\n\nexport const rateLimiter = rateLimit({\n  windowMs: 15 * 60 * 1000,\n  max: 100,\n  standardHeaders: 'draft-7',\n  legacyHeaders: false,\n  handler: (req, res) => {\n    res.status(429).json({\n      error: 'Too many requests',\n      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000),\n    });\n  },\n});\n\`\`\`\n\nApply it in your router:\n\n\`\`\`typescript\nrouter.use('/api/auth', rateLimiter, authMiddleware);\n\`\`\`\n\n**Production tip:** Use Redis store for multi-instance deployments.`,
    model: 'Akansha',
    timestamp: new Date(Date.now() - 2 * 60000),
    tokenCount: 389,
    memoryRefs: ['Node.js expertise'],
    emotion: 'neutral',
  },
];

const EMOTION_RESPONSES: Record<string, Emotion> = {
  sad: 'sad',
  happy: 'happy',
  excited: 'happy',
  confused: 'thinking',
  help: 'thinking',
  wow: 'surprised',
  amazing: 'surprised',
  thanks: 'happy',
  error: 'thinking',
  default: 'neutral',
};

function detectEmotion(text: string): Emotion {
  const lower = text.toLowerCase();
  for (const [keyword, emotion] of Object.entries(EMOTION_RESPONSES)) {
    if (lower.includes(keyword)) return emotion;
  }
  return 'neutral';
}

export default function ChatThread({
  sessionId,
  onStatsChange,
}: {
  sessionId: string;
  onStatsChange?: (messages: number, tokens: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState('Akansha');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    setMessages([]);
    fetch(`http://localhost:8000/api/chat?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id.toString(),
              sessionId: m.session_id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            }))
          );
        }
      })
      .catch((err) => console.error('Failed to load chat history:', err));
  }, [sessionId]);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [avatarMinimized, setAvatarMinimized] = useState(false);
  const [showAvatarBar, setShowAvatarBar] = useState(true);
  const activeSessionIdRef = useRef(sessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const micStoppedManuallyRef = useRef(false);
  const pendingTranscriptRef = useRef('');

  useEffect(() => {
    activeSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const totalTokens = Math.floor(messages.reduce((acc, msg) => acc + msg.content.length, 0) / 4);
    onStatsChange?.(messages.length, totalTokens);
  }, [messages, onStatsChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Text-to-speech
  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === 'undefined') return;
      window.speechSynthesis?.cancel();
      const plainText = text
        .replace(/```[\s\S]*?```/g, 'code block')
        .replace(/\*\*/g, '')
        .replace(/`/g, '');
      const utterance = new SpeechSynthesisUtterance(plainText.slice(0, 500));
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes('female') ||
          v.name.includes('Samantha') ||
          v.name.includes('Victoria') ||
          v.name.includes('Karen')
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentEmotion('speaking');
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentEmotion('neutral');
      };
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

  // Speech-to-text
  const toggleListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      micStoppedManuallyRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const startRecognition = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error('Microphone permission denied:', error);
        toast.error('Microphone permission is blocked. Allow mic access in your browser.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      pendingTranscriptRef.current = '';
      micStoppedManuallyRef.current = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Listening... speak now');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) {
            finalTranscript += `${chunk} `;
          }
        }

        if (finalTranscript.trim()) {
          pendingTranscriptRef.current =
            `${pendingTranscriptRef.current} ${finalTranscript}`.trim();
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const errorCode = event?.error;

        if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
          toast.error('Browser blocked voice input. Allow microphone and speech access.');
          return;
        }

        if (errorCode === 'no-speech') {
          toast.error('No speech detected. Try again and speak a little closer to the mic.');
          return;
        }

        toast.error('Voice input failed. Try Chrome or Brave with mic permission enabled.');
      };

      recognition.onend = () => {
        setIsListening(false);
        const spokenText = pendingTranscriptRef.current.trim();
        if (!micStoppedManuallyRef.current && spokenText) {
          handleSend(spokenText);
        } else if (!micStoppedManuallyRef.current && !spokenText) {
          toast.error('I did not catch anything from the microphone.');
        }
        pendingTranscriptRef.current = '';
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch (error) {
        console.error('Speech recognition start failed:', error);
        toast.error('Could not start voice input. Refresh once and try again.');
      }
    };

    void startRecognition();
  }, [isListening]);

  const simulateStreaming = useCallback(
    (content: string, emotion: Emotion = 'neutral') => {
      setIsStreaming(true);
      setStreamingContent('');
      setCurrentEmotion('thinking');
      let index = 0;
      const words = content.split(' ');
      const interval = setInterval(() => {
        if (index < words.length) {
          setStreamingContent((prev) => prev + (prev ? ' ' : '') + words[index]);
          index++;
        } else {
          clearInterval(interval);
          const newMsg: Message = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content,
            model: selectedModel,
            timestamp: new Date(),
            tokenCount: Math.floor(content.length / 4),
            memoryRefs: Math.random() > 0.5 ? ['Previous context'] : undefined,
            emotion,
          };
          setMessages((prev) => [...prev, newMsg]);
          setIsStreaming(false);
          setStreamingContent('');
          setCurrentEmotion(emotion);
          speak(content);
        }
      }, 35);
    },
    [selectedModel, speak]
  );

  const handleSend = useCallback(
    (content: string, attachments?: File[]) => {
      if (!content.trim()) return;
      const detectedEmotion = detectEmotion(content);
      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
        attachments: attachments?.map((f, i) => ({
          id: `att-${i}`,
          name: f.name,
          type: f.type,
          size: `${(f.size / 1024).toFixed(1)} KB`,
        })),
      };
      setMessages((prev) => [...prev, userMsg]);
      setCurrentEmotion('thinking');

      fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, session_id: activeSessionIdRef.current }),
      })
        .then((res) => res.json())
        .then((data) => {
          window.dispatchEvent(new CustomEvent('akansha-history-updated'));
          const responseText = data.response;
          const responseEmotion: Emotion = detectedEmotion === 'sad' ? 'sad' : 'happy';
          simulateStreaming(responseText, responseEmotion);
        })
        .catch((err) => {
          console.error(err);
          simulateStreaming(
            "I'm sorry, I couldn't connect to my brain. Please make sure the FastAPI backend is running on port 8000.",
            'sad'
          );
        });
    },
    [simulateStreaming]
  );

  const handleShare = () => {
    navigator.clipboard.writeText('https://akansha.ai/share/conv-abc123');
    toast.success('Shareable link copied to clipboard');
  };

  const totalTokens = Math.floor(messages.reduce((acc, msg) => acc + msg.content.length, 0) / 4);

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">Akansha Chat</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{messages.length} messages</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-[#00C9A7] flex items-center gap-1">
              <Brain size={10} />
              Memory active
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {totalTokens.toLocaleString()} tokens
            </span>
          </div>
        </div>

        <ModelSelector selected={selectedModel} onChange={setSelectedModel} />

        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Share conversation"
          >
            <Share2 size={15} />
          </button>

          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="More options"
            >
              <MoreHorizontal size={15} />
            </button>
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] animate-fade-in">
                  {[
                    { key: 'menu-star', icon: Star, label: 'Star conversation' },
                    { key: 'menu-share', icon: Share2, label: 'Share publicly' },
                    {
                      key: 'menu-delete',
                      icon: Trash2,
                      label: 'Delete conversation',
                      danger: true,
                    },
                  ].map(({ key, icon: Icon, label, danger }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        toast.success(`${label} action triggered`);
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                        danger
                          ? 'text-red-500 hover:bg-red-500/5'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Avatar bar (minimized or full) */}
      {showAvatarBar && (
        <div className="px-4 py-2 border-b border-border bg-card/30 flex items-center gap-3 shrink-0">
          {avatarMinimized ? (
            <AvatarPanel
              emotion={currentEmotion}
              isSpeaking={isSpeaking}
              isListening={isListening}
              onToggleMic={toggleListening}
              onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
              voiceEnabled={voiceEnabled}
              minimized={true}
              onToggleMinimize={() => setAvatarMinimized(false)}
            />
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2">
                {/* Compact inline avatar */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg, #6C47FF, #00C9A7)' }}
                  >
                    A
                  </div>
                  {isSpeaking && (
                    <div className="absolute inset-0 rounded-full border-2 border-[#6C47FF] animate-ping opacity-50" />
                  )}
                  {isListening && (
                    <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-pulse opacity-70" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Akansha</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {currentEmotion === 'speaking'
                      ? 'Speaking...'
                      : currentEmotion === 'thinking'
                        ? 'Thinking...'
                        : isListening
                          ? 'Listening...'
                          : 'Ready'}
                  </p>
                </div>
              </div>

              {/* Voice waveform */}
              {(isSpeaking || isListening) && (
                <div className="flex items-center gap-0.5 h-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={`wave-${i}`}
                      className="w-1 rounded-full"
                      style={{
                        background: isListening ? '#EF4444' : '#6C47FF',
                        animation: `waveform ${0.4 + i * 0.06}s ease-in-out infinite alternate`,
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={toggleListening}
                  className={`p-1.5 rounded-lg transition-all text-xs ${
                    isListening
                      ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                      : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
                <button
                  onClick={() => setAvatarMinimized(true)}
                  className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground border border-border transition-all"
                  title="Minimize"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="message-enter">
            <MessageBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent,
                model: selectedModel,
                timestamp: new Date(),
                isStreaming: true,
              }}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Prompt suggestions */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-thin shrink-0">
        {[
          'Add unit tests',
          'Explain the JWT flow',
          'Add TypeScript generics',
          'How to handle refresh tokens?',
        ].map((suggestion) => (
          <button
            key={`suggestion-${suggestion}`}
            onClick={() => handleSend(suggestion)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Composer */}
      <ChatComposer
        onSend={handleSend}
        onOpenPromptLibrary={() => setPromptModalOpen(true)}
        isStreaming={isStreaming}
        selectedModel={selectedModel}
        onToggleMic={toggleListening}
        isListening={isListening}
      />

      <PromptTemplateModal
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        onSelect={(p) => {
          handleSend(p);
          setPromptModalOpen(false);
        }}
      />
    </div>
  );
}
