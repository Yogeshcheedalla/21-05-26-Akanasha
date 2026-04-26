'use client';

import React from 'react';
import AppLogo from '@/components/ui/AppLogo';
import { Brain, Zap, FileText, Mic, Share2, BookMarked } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const FEATURES = [
  { key: 'feat-models', icon: Zap, text: 'GPT-4o, Claude 3.5, Gemini 1.5 & more' },
  { key: 'feat-memory', icon: Brain, text: 'Persistent memory across all sessions' },
  { key: 'feat-rag', icon: FileText, text: 'RAG — upload docs and query them' },
  { key: 'feat-voice', icon: Mic, text: 'Voice input & text-to-speech output' },
  { key: 'feat-share', icon: Share2, text: 'Shareable conversation links' },
  { key: 'feat-prompts', icon: BookMarked, text: 'Prompt library with 50+ templates' },
];

export default function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex w-[480px] xl:w-[540px] shrink-0 flex-col gradient-brand relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#6C47FF]/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-[#00C9A7]/8 blur-3xl translate-y-1/2 -translate-x-1/2" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-[#6C47FF]/5 blur-2xl -translate-x-1/2 -translate-y-1/2" />
      <div className="relative z-10 flex flex-col h-full px-10 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-16">
          <AppLogo size={36} />
          <span className="text-xl font-semibold text-white tracking-tight">Akansha</span>
        </div>

        {/* Hero */}
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your AI workspace,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9B7FFF] to-[#00C9A7]">
              built to remember.
            </span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed mb-10">
            Multi-model AI chat with persistent memory, document intelligence, and a prompt library — all in one workspace.
          </p>

          {/* Features */}
          <div className="space-y-3.5">
            {FEATURES?.map(({ key, icon: Icon, text }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[#9B7FFF]" />
                </div>
                <span className="text-sm text-zinc-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-10 pt-8 border-t border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['bg-violet-500', 'bg-teal-500', 'bg-orange-400', 'bg-blue-500']?.map((color, i) => (
                <div key={`avatar-${i}`} className={`w-8 h-8 rounded-full ${color} border-2 border-zinc-900 flex items-center justify-center text-white text-xs font-semibold`}>
                  {['S', 'K', 'R', 'M']?.[i]}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm text-white font-medium">Trusted by 12,000+ developers</p>
              <p className="text-xs text-zinc-500">Join the waitlist or sign up free today</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}