'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Check, AlertCircle, Key } from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';

interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  apiKeyMode: 'platform' | 'own';
  ownApiKey?: string;
  agreeToTerms: boolean;
}

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

const PASSWORD_REQUIREMENTS = [
  { key: 'req-length', label: 'At least 8 characters', check: (p: string) => p.length >= 8 },
  { key: 'req-upper', label: 'One uppercase letter', check: (p: string) => /[A-Z]/.test(p) },
  { key: 'req-number', label: 'One number', check: (p: string) => /\d/.test(p) },
];

export default function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      apiKeyMode: 'platform',
      agreeToTerms: false,
    },
  });

  const password = watch('password', '');
  const apiKeyMode = watch('apiKeyMode');

  // Backend integration point: replace with actual registration API call
  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setAuthError('');
    await new Promise((r) => setTimeout(r, 1400));
    toast.success(`Welcome to Akansha, ${data.fullName.split(' ')[0]}!`);
    router.push('/chat-interface');
    setIsLoading(false);
  };

  const handleGoogleSignup = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/google/auth-url');
      const data = await res.json();
      if (!data.auth_url) {
        toast.info(data.message ?? 'Google OAuth is not configured yet');
        return;
      }
      window.open(data.auth_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to start Google sign-up:', error);
      toast.error('Could not start Google sign-up');
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
        <h2 className="text-2xl font-bold text-foreground mb-1.5">Create your account</h2>
        <p className="text-sm text-muted-foreground">
          Start chatting with the most capable AI models
        </p>
      </div>

      {/* Google SSO */}
      <button
        type="button"
        onClick={handleGoogleSignup}
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
        Sign up with Google
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or sign up with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {authError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-5">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="signup-name">
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            {...register('fullName', {
              required: 'Full name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
            })}
            className={`w-full px-4 py-2.5 rounded-xl border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#6C47FF]/30 transition-all ${
              errors.fullName
                ? 'border-red-500/50 bg-red-500/3'
                : 'border-border focus:border-[#6C47FF]/50'
            }`}
            placeholder="Arjun Mehta"
          />
          {errors.fullName && (
            <p className="mt-1.5 text-xs text-red-500">{errors.fullName.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            className="block text-sm font-medium text-foreground mb-1.5"
            htmlFor="signup-email"
          >
            Email address
          </label>
          <input
            id="signup-email"
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
          <label
            className="block text-sm font-medium text-foreground mb-1.5"
            htmlFor="signup-password"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
                pattern: {
                  value: /(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must contain uppercase and a number',
                },
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

          {/* Password strength indicators */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              {PASSWORD_REQUIREMENTS.map(({ key, label, check }) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      check(password) ? 'bg-green-500' : 'bg-muted border border-border'
                    }`}
                  >
                    {check(password) && <Check size={9} className="text-white" />}
                  </div>
                  <span
                    className={`text-xs transition-colors ${check(password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Key mode */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">AI API Keys</label>
          <p className="text-xs text-muted-foreground mb-2.5">
            Choose how Akansha accesses AI models on your behalf
          </p>
          <div className="space-y-2">
            {[
              {
                value: 'platform',
                label: 'Use Akansha platform key',
                description: 'Managed for you — usage billed to your plan',
              },
              {
                value: 'own',
                label: 'Use my own API key',
                description: 'Bring your OpenAI / Anthropic / Google key — full control',
              },
            ].map((opt) => (
              <label
                key={`apimode-${opt.value}`}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  apiKeyMode === opt.value
                    ? 'border-[#6C47FF]/50 bg-[#6C47FF]/5'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  {...register('apiKeyMode')}
                  className="mt-0.5 text-[#6C47FF] focus:ring-[#6C47FF]/30"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Own API key input */}
          {apiKeyMode === 'own' && (
            <div className="mt-3">
              <label
                className="block text-xs font-medium text-muted-foreground mb-1.5"
                htmlFor="signup-apikey"
              >
                Your API Key
              </label>
              <div className="relative">
                <Key
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  id="signup-apikey"
                  type="password"
                  {...register('ownApiKey')}
                  placeholder="sk-..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#6C47FF]/30 focus:border-[#6C47FF]/50 transition-all"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Stored encrypted. You can update this anytime in settings.
              </p>
            </div>
          )}
        </div>

        {/* Terms */}
        <div>
          <div className="flex items-start gap-2.5">
            <input
              id="agree-terms"
              type="checkbox"
              {...register('agreeToTerms', { required: 'You must agree to the terms to continue' })}
              className="w-4 h-4 mt-0.5 rounded border-border text-[#6C47FF] focus:ring-[#6C47FF]/30 cursor-pointer shrink-0"
            />
            <label
              htmlFor="agree-terms"
              className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
            >
              I agree to the{' '}
              <span className="text-[#6C47FF] hover:text-[#5A35EE] cursor-pointer">
                Terms of Service
              </span>{' '}
              and{' '}
              <span className="text-[#6C47FF] hover:text-[#5A35EE] cursor-pointer">
                Privacy Policy
              </span>
            </label>
          </div>
          {errors.agreeToTerms && (
            <p className="mt-1.5 text-xs text-red-500">{errors.agreeToTerms.message}</p>
          )}
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
              Creating account...
            </>
          ) : (
            'Create free account'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <button
          onClick={onSwitchToLogin}
          className="text-[#6C47FF] hover:text-[#5A35EE] font-medium transition-colors"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
