import React from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import AuthScreen from './components/AuthScreen';
import { Toaster } from 'sonner';

export default function SignUpLoginPage() {
  return (
    <ThemeProvider>
      <AuthScreen />
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}