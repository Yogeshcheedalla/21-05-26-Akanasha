import React from 'react';
import AppLayout from '@/components/AppLayout';
import { AkanshaAssistant } from '@/components/assistant/AkanshaAssistant';

export default function VoiceAssistantPage() {
  return (
    <AppLayout activePath="/voice-assistant">
      <div className="min-h-full scroll-smooth bg-[radial-gradient(circle_at_top,_rgba(108,71,255,0.22),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-6 pb-16 lg:px-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="relative">
            <div className="pointer-events-none absolute -top-8 left-1/4 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 right-0 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" />
            <AkanshaAssistant />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
