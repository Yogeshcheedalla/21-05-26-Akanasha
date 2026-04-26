'use client';

import React, { useState } from 'react';
import { ChevronDown, Zap, Brain, Eye, FileText, Check } from 'lucide-react';

const MODELS = [
  {
    id: 'model-gpt4o',
    name: 'Akansha',
    provider: 'OpenAI',
    color: 'bg-green-500',
    capabilities: ['Vision', 'Code', 'Reasoning'],
    contextWindow: '128K',
    speed: 'Fast',
    icon: Zap,
  },
  {
    id: 'model-gpt4t',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    color: 'bg-green-600',
    capabilities: ['Vision', 'Code', 'Long context'],
    contextWindow: '128K',
    speed: 'Medium',
    icon: Brain,
  },
  {
    id: 'model-claude35',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    color: 'bg-orange-400',
    capabilities: ['Code', 'Analysis', 'Writing'],
    contextWindow: '200K',
    speed: 'Fast',
    icon: Brain,
  },
  {
    id: 'model-claude3',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    color: 'bg-orange-500',
    capabilities: ['Reasoning', 'Analysis', 'Complex tasks'],
    contextWindow: '200K',
    speed: 'Slow',
    icon: Brain,
  },
  {
    id: 'model-gemini15',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    color: 'bg-blue-400',
    capabilities: ['Vision', 'Code', 'Multimodal'],
    contextWindow: '1M',
    speed: 'Medium',
    icon: Eye,
  },
  {
    id: 'model-gemini-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    color: 'bg-blue-500',
    capabilities: ['Speed', 'Multimodal', 'Efficient'],
    contextWindow: '1M',
    speed: 'Very Fast',
    icon: Zap,
  },
  {
    id: 'model-llama3',
    name: 'Llama 3 70B',
    provider: 'Meta',
    color: 'bg-purple-400',
    capabilities: ['Open source', 'Code', 'Instruction'],
    contextWindow: '8K',
    speed: 'Fast',
    icon: FileText,
  },
];

interface ModelSelectorProps {
  selected: string;
  onChange: (model: string) => void;
}

export default function ModelSelector({ selected, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find(m => m.name === selected) || MODELS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
      >
        <div className={`w-2 h-2 rounded-full ${current.color}`} />
        <span className="hidden sm:inline">{current.name}</span>
        <span className="sm:hidden text-xs text-muted-foreground">{current.provider}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl shadow-black/10 py-1 w-72 animate-fade-in">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Select Model</p>
            {MODELS.map(model => {
              const Icon = model.icon;
              const isSelected = model.name === selected;
              return (
                <button
                  key={model.id}
                  onClick={() => { onChange(model.name); setOpen(false); }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left ${
                    isSelected ? 'bg-[#6C47FF]/5' : 'hover:bg-muted'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${model.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${isSelected ? 'text-[#6C47FF]' : 'text-foreground'}`}>
                        {model.name}
                      </span>
                      {isSelected && <Check size={13} className="text-[#6C47FF] shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{model.provider}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs font-mono text-muted-foreground">{model.contextWindow}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{model.speed}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {model.capabilities.map(cap => (
                        <span key={`cap-${model.id}-${cap}`} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}