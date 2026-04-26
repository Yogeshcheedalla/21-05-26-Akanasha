import React from 'react';
import AppLayout from '@/components/AppLayout';
import ChatWorkspace from './components/ChatWorkspace';

export default function ChatInterfacePage() {
  return (
    <AppLayout activePath="/chat-interface">
      <ChatWorkspace />
    </AppLayout>
  );
}