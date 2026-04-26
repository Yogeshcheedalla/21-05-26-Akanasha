'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Cpu, Key, Eye, EyeOff, Shield, Plus, ExternalLink, Info, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function APIKeysPage() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleKey = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API Key copied to clipboard');
  };

  const models = [
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o)',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
      key: 'sk-proj-••••••••••••••••••••••••••••••••',
      status: 'Active',
      lastUsed: '2 mins ago',
      color: 'bg-green-500'
    },
    {
      id: 'anthropic',
      name: 'Anthropic (Claude 3.5)',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Anthropic_Logo.svg',
      key: 'sk-ant-••••••••••••••••••••••••••••••••',
      status: 'Active',
      lastUsed: '1 hour ago',
      color: 'bg-orange-500'
    },
    {
      id: 'google',
      name: 'Google (Gemini 1.5)',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg',
      key: 'AIzaSy••••••••••••••••••••••••••••••',
      status: 'Inactive',
      lastUsed: 'Never',
      color: 'bg-blue-500'
    }
  ];

  return (
    <AppLayout activePath="/api-keys">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 lg:p-10 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
              <p className="text-muted-foreground mt-2">Manage your authentication keys for various AI models and services.</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6C47FF] text-white text-sm font-medium hover:bg-[#5A35EE] transition-all shadow-lg shadow-[#6C47FF]/20">
              <Plus size={16} />
              Add Provider
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {models.map(model => (
              <div key={model.id} className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm group hover:border-[#6C47FF]/30 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${model.color}/10 flex items-center justify-center`}>
                      <Cpu size={24} className={model.color.replace('bg-', 'text-')} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                        {model.name}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${model.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                          {model.status}
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Last used: {model.lastUsed}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Documentation">
                      <ExternalLink size={16} />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted text-red-500 hover:bg-red-500/10 transition-colors" title="Delete Key">
                      <Key size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="relative group/key">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Shield size={14} className="text-muted-foreground" />
                    </div>
                    <input
                      type={showKeys[model.id] ? "text" : "password"}
                      value={model.key}
                      readOnly
                      className="w-full bg-muted/50 border-0 rounded-xl pl-10 pr-24 py-3 text-sm font-mono text-foreground focus:ring-1 focus:ring-[#6C47FF]/40 transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                      <button 
                        onClick={() => toggleKey(model.id)}
                        className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showKeys[model.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button 
                        onClick={() => copyKey(model.key)}
                        className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 rounded-2xl bg-[#6C47FF]/5 border border-[#6C47FF]/10 flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[#6C47FF]/10 flex items-center justify-center shrink-0">
              <Info size={18} className="text-[#6C47FF]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#6C47FF]">Security Information</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Your API keys are encrypted at rest and never shared with third parties. Akansha uses these keys to connect to the respective AI providers on your behalf.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
