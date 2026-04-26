'use client';

import React, { useState } from 'react';
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Brain, Check, Code2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Message } from './ChatThread';

interface MessageBubbleProps {
  message: Message;
}

const MODEL_BADGES: Record<string, { label: string; color: string }> = {
  'GPT-4o': { label: 'Akansha', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  'Claude 3.5': { label: 'Claude 3.5', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  'Gemini 1.5': { label: 'Gemini 1.5', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
};

function formatContent(content: string): React.ReactNode[] {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.split('\n');
      const lang = lines[0].replace('```', '').trim() || 'code';
      const code = lines.slice(1, -1).join('\n');
      return (
        <div key={`code-block-${i}`} className="my-3 rounded-xl overflow-hidden border border-border bg-zinc-950 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-800 border-b border-border">
            <div className="flex items-center gap-2">
              <Code2 size={13} className="text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">{lang}</span>
            </div>
            <CopyCodeButton code={code} />
          </div>
          <pre className="p-4 overflow-x-auto scrollbar-thin text-xs font-mono text-zinc-200 leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    const lines = part.split('\n');
    return (
      <span key={`text-${i}`}>
        {lines.map((line, li) => {
          // Bold
          const formatted = line.split(/(\*\*.*?\*\*)/g).map((seg, si) => {
            if (seg.startsWith('**') && seg.endsWith('**')) {
              return <strong key={`bold-${li}-${si}`} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>;
            }
            // Inline code
            const codeFormatted = seg.split(/(`[^`]+`)/g).map((s, ci) => {
              if (s.startsWith('`') && s.endsWith('`')) {
                return <code key={`inline-code-${li}-${si}-${ci}`} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-[#6C47FF] dark:text-[#9B7FFF]">{s.slice(1, -1)}</code>;
              }
              return s;
            });
            return <span key={`seg-${li}-${si}`}>{codeFormatted}</span>;
          });
          return (
            <span key={`line-${li}`}>
              {formatted}
              {li < lines.length - 1 && <br />}
            </span>
          );
        })}
      </span>
    );
  });
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const isUser = message.role === 'user';
  const badge = message.model ? MODEL_BADGES[message.model] : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message copied to clipboard');
  };

  return (
    <div className={`flex gap-3 py-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5 ${
        isUser
          ? 'bg-gradient-to-br from-[#6C47FF] to-[#00C9A7] text-white'
          : 'bg-gradient-to-br from-zinc-700 to-zinc-600 text-zinc-200 border border-border'
      }`}>
        {isUser ? 'A' : 'AI'}
      </div>

      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Header row */}
        <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className={`text-xs font-medium ${isUser ? 'text-foreground' : 'text-green-600 dark:text-green-400'}`}>
            {isUser ? 'You' : 'Akansha'}
          </span>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.color}`}>
              {badge.label}
            </span>
          )}
          {message.memoryRefs && message.memoryRefs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#00C9A7] px-2 py-0.5 rounded-full bg-[#00C9A7]/10 border border-[#00C9A7]/20">
              <Brain size={10} />
              Memory
            </span>
          )}
          <span className="text-xs text-muted-foreground/60">{formatTime(message.timestamp)}</span>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {message.attachments.map(att => (
              <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#6C47FF]/10 border border-[#6C47FF]/20 text-xs">
                <Code2 size={12} className="text-[#6C47FF]" />
                <span className="font-mono text-[#6C47FF] dark:text-[#9B7FFF]">{att.name}</span>
                <span className="text-muted-foreground">{att.size}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content bubble */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#6C47FF] text-white rounded-tr-sm'
            : 'bg-card border border-border text-foreground rounded-tl-sm'
        }`}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose-sm">
              {formatContent(message.content)}
              {message.isStreaming && <span className="streaming-cursor" />}
            </div>
          )}
        </div>

        {/* Token count */}
        {message.tokenCount && !isUser && (
          <span className="text-xs text-muted-foreground/50 font-mono tabular-nums px-1">
            {message.tokenCount} tokens
          </span>
        )}

        {/* Actions (AI messages only) */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Copy message">
              <Copy size={13} />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Regenerate">
              <RotateCcw size={13} />
            </button>
            <button
              onClick={() => setLiked(true)}
              className={`p-1.5 rounded-lg transition-colors ${liked === true ? 'text-green-500 bg-green-500/10' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Good response"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => setLiked(false)}
              className={`p-1.5 rounded-lg transition-colors ${liked === false ? 'text-red-500 bg-red-500/10' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Bad response"
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}