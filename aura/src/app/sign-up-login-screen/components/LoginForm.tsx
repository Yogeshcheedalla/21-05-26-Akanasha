'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const DEMO_CREDENTIALS = {
  email: 'arjun.mehta@devcraft.io',
  password: 'Akansha@2026',
};

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  );
}

export default function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  // Backend integration point: replace with actual auth API call
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setAuthError('');
    await new Promise((r) => setTimeout(r, 1200));

    if (data.email === DEMO_CREDENTIALS.email && data.password === DEMO_CREDENTIALS.password) {
      toast.success('Welcome back, Arjun!');
      router.push('/chat-interface');
    } else {
      setAuthError('Invalid credentials — use the demo accounts below to sign in');
    }
    setIsLoading(false);
  };

  const fillDemo = () => {
    setValue('email', DEMO_CREDENTIALS.email);
    setValue('password', DEMO_CREDENTIALS.password);
  };

  const handleGoogleSignin = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/google/auth-url');
      const data = await res.json();
      if (!data.auth_url) {
        toast.info(data.message ?? 'Google OAuth is not configured yet');
        return;
      }
      window.open(data.auth_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to start Google sign-in:', error);
      toast.error('Could not start Google sign-in');
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 mb-8 lg:hidden">
        <AppLogo size={32} />
        <span className="font-semibold text-lg text-foreground">Akansha</span>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-1.5">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to your Akansha workspace</p>
      </div>

      {/* Google SSO */}
      {/* Backend integration point: connect Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleSignin}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground mb-6"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or continue with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Auth error */}
      {authError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-5">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
            className={`w-full px-4 py-2.5 rounded-xl border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#6C47FF]/30 transition-all ${
              errors.email
                ? 'border-red-500/50 bg-red-500/3'
                : 'border-border focus:border-[#6C47FF]/50'
            }`}
            placeholder="you@company.com"
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="login-password">
              Password
            </label>
            <button
              type="button"
              className="text-xs text-[#6C47FF] hover:text-[#5A35EE] transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
              className={`w-full px-4 py-2.5 pr-11 rounded-xl border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#6C47FF]/30 transition-all ${
                errors.password
                  ? 'border-red-500/50 bg-red-500/3'
                  : 'border-border focus:border-[#6C47FF]/50'
              }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2">
          <input
            id="remember-me"
            type="checkbox"
            {...register('rememberMe')}
            className="w-4 h-4 rounded border-border text-[#6C47FF] focus:ring-[#6C47FF]/30 cursor-pointer"
          />
          <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
            Remember me for 30 days
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6C47FF] hover:bg-[#5A35EE] text-white font-medium text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-[#6C47FF]/20"
          style={{ minHeight: '44px' }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Switch to signup */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{' '}
        <button
          onClick={onSwitchToSignup}
          className="text-[#6C47FF] hover:text-[#5A35EE] font-medium transition-colors"
        >
          Sign up free
        </button>
      </p>

      {/* Demo credentials */}
      <div className="mt-6 p-4 rounded-xl bg-muted/60 border border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Demo Credentials
        </p>
        <div className="space-y-2">
          {[
            { label: 'Email', value: DEMO_CREDENTIALS.email },
            { label: 'Password', value: DEMO_CREDENTIALS.password },
          ].map(({ label, value }) => (
            <div key={`demo-${label}`} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground w-16">{label}</span>
              <code className="flex-1 text-xs font-mono text-foreground bg-background px-2 py-1 rounded border border-border truncate">
                {value}
              </code>
              <CopyButton value={value} />
            </div>
          ))}
        </div>
        <button
          onClick={fillDemo}
          className="mt-3 w-full text-xs text-[#6C47FF] hover:text-[#5A35EE] transition-colors text-center"
        >
          Click to autofill credentials
        </button>
      </div>
    </div>
  );
}
