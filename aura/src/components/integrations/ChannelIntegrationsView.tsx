'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  Camera,
  CheckCheck,
  Clock3,
  Loader2,
  MessageCircleMore,
  MessageSquareReply,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface SocialInboxMessage {
  id: number;
  platform: 'whatsapp' | 'instagram' | 'twitter' | 'telegram' | 'discord';
  sender: string;
  content: string;
  intent: string;
  sentiment: string;
  is_read: boolean;
  timestamp: string;
  suggested_replies: string[];
}

interface SocialInboxResponse {
  platforms: Array<{
    key: 'whatsapp' | 'instagram' | 'twitter' | 'telegram' | 'discord';
    label: string;
    connected: boolean;
    accent: string;
    setup_required: boolean;
    required_fields: string[];
    configured_fields: string[];
    last_verified: string | null;
  }>;
  messages: SocialInboxMessage[];
}

const SOCIAL_INBOX_FALLBACK: SocialInboxResponse = {
  platforms: [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      connected: false,
      accent: '#25D366',
      setup_required: true,
      required_fields: ['phone_number_id', 'access_token', 'webhook_verify_token'],
      configured_fields: [],
      last_verified: null,
    },
    {
      key: 'instagram',
      label: 'Instagram',
      connected: false,
      accent: '#F43F5E',
      setup_required: true,
      required_fields: ['app_id', 'app_secret', 'access_token'],
      configured_fields: [],
      last_verified: null,
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      connected: false,
      accent: '#60A5FA',
      setup_required: true,
      required_fields: ['api_key', 'api_secret', 'bearer_token'],
      configured_fields: [],
      last_verified: null,
    },
    {
      key: 'telegram',
      label: 'Telegram',
      connected: false,
      accent: '#38BDF8',
      setup_required: true,
      required_fields: ['bot_token', 'chat_id'],
      configured_fields: [],
      last_verified: null,
    },
    {
      key: 'discord',
      label: 'Discord',
      connected: false,
      accent: '#818CF8',
      setup_required: true,
      required_fields: ['bot_token', 'guild_id', 'channel_id'],
      configured_fields: [],
      last_verified: null,
    },
  ],
  messages: [],
};

export function ChannelIntegrationsView() {
  const [socialInbox, setSocialInbox] = useState<SocialInboxResponse | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [selectedReply, setSelectedReply] = useState<Record<number, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null);
  const [setupPlatform, setSetupPlatform] = useState<string | null>(null);
  const [setupValues, setSetupValues] = useState<Record<string, Record<string, string>>>({});

  const socialPlatformMeta = useMemo(
    () => ({
      whatsapp: { label: 'WhatsApp', icon: MessageCircleMore },
      instagram: { label: 'Instagram', icon: Camera },
      twitter: { label: 'X / Twitter', icon: AtSign },
      telegram: { label: 'Telegram', icon: Send },
      discord: { label: 'Discord', icon: MessageCircleMore },
    }),
    []
  );

  const loadSocialInbox = useCallback(async () => {
    setSocialLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/social/inbox');
      if (!res.ok) {
        setSocialInbox(SOCIAL_INBOX_FALLBACK);
        return;
      }
      const data: SocialInboxResponse = await res.json();
      setSocialInbox(data);
    } catch (error) {
      console.error('Failed to load social inbox:', error);
      setSocialInbox(SOCIAL_INBOX_FALLBACK);
    } finally {
      setSocialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSocialInbox();
  }, [loadSocialInbox]);

  const saveSocialPlatformSetup = useCallback(
    async (platform: 'whatsapp' | 'instagram' | 'twitter' | 'telegram' | 'discord') => {
      setConnectingPlatform(platform);
      try {
        const response = await fetch(`http://localhost:8000/api/social/setup/${platform}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: setupValues[platform] ?? {},
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail ?? `Could not configure ${platform}`);
        }

        toast.success(`${platform} configuration saved`);
        setSetupPlatform(null);
        await loadSocialInbox();
      } catch (error) {
        console.error(`Failed to configure ${platform}:`, error);
        toast.error(error instanceof Error ? error.message : `Could not configure ${platform}`);
      } finally {
        setConnectingPlatform(null);
      }
    },
    [loadSocialInbox, setupValues]
  );

  const disconnectSocialPlatform = useCallback(async (platform: string) => {
    try {
      await fetch(`http://localhost:8000/api/social/disconnect/${platform}`, { method: 'POST' });
      toast.success(`${platform} disconnected`);
      await loadSocialInbox();
    } catch (error) {
      console.error(`Failed to disconnect ${platform}:`, error);
      toast.error(`Could not disconnect ${platform}`);
    }
  }, [loadSocialInbox]);

  const approveAndSendReply = useCallback(
    async (message: SocialInboxMessage) => {
      const reply = selectedReply[message.id] ?? message.suggested_replies[0] ?? '';
      if (!reply.trim()) {
        toast.info('Choose or write a reply first');
        return;
      }

      setSendingReplyId(message.id);
      try {
        const response = await fetch('http://localhost:8000/api/social/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message_id: message.id,
            platform: message.platform,
            sender: message.sender,
            reply,
            approved: true,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail ?? 'Reply could not be sent');
        }

        toast.success(`Reply approved for ${message.sender}`);
        await loadSocialInbox();
      } catch (error) {
        console.error('Failed to send approved reply:', error);
        toast.error('Reply could not be sent');
      } finally {
        setSendingReplyId(null);
      }
    },
    [loadSocialInbox, selectedReply]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/85 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Channel integrations</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            WhatsApp, Telegram, X, Instagram, Discord, and more
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Connect messaging APIs here in a separate communications page. Nothing should appear as
            connected unless you actually provide the required credentials for that platform.
          </p>
        </div>

        <button
          onClick={() => void loadSocialInbox()}
          className="rounded-full border border-white/10 bg-slate-950 p-2 text-slate-300 transition-colors hover:bg-slate-800"
        >
          {socialLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {socialInbox?.platforms.map((platform) => {
          const meta = socialPlatformMeta[platform.key];
          const Icon = meta.icon;

          return (
              <button
                key={platform.key}
                onClick={() => setSetupPlatform(platform.key)}
                className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] px-5 py-4 text-left transition-colors hover:bg-slate-800"
              >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-3">
                    <Icon size={17} style={{ color: platform.accent }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{platform.label}</p>
                    <p className="mt-1 text-xs text-slate-400">Connect API access and review messages here.</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] ${
                    platform.connected
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {connectingPlatform === platform.key
                    ? 'Saving...'
                    : platform.connected
                      ? 'Connected'
                      : 'Setup required'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {platform.required_fields.map((field) => (
                  <span
                    key={`${platform.key}-${field}`}
                    className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300"
                  >
                    {field}
                  </span>
                ))}
              </div>
              {platform.last_verified && (
                <p className="mt-3 text-xs text-slate-500">
                  Last saved: {new Date(platform.last_verified).toLocaleString()}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {setupPlatform && (() => {
        const platform = socialInbox?.platforms.find((item) => item.key === setupPlatform);
        if (!platform) return null;

        return (
          <div className="mt-6 rounded-[28px] border border-[#6c47ff]/20 bg-[#6c47ff]/8 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Integration setup</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{platform.label} credentials</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Add the relevant API credentials here. Without OTPs, bot tokens, webhook values,
                  or app secrets, this platform should stay disconnected.
                </p>
              </div>
              <button
                onClick={() => setSetupPlatform(null)}
                className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {platform.required_fields.map((field) => (
                <label key={`${platform.key}-${field}`} className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">
                    {field.replaceAll('_', ' ')}
                  </span>
                  <input
                    value={setupValues[platform.key]?.[field] ?? ''}
                    onChange={(event) =>
                      setSetupValues((previous) => ({
                        ...previous,
                        [platform.key]: {
                          ...(previous[platform.key] ?? {}),
                          [field]: event.target.value,
                        },
                      }))
                    }
                    placeholder={`Enter ${field}`}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-[#6c47ff]/60"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  void saveSocialPlatformSetup(
                    platform.key as 'whatsapp' | 'instagram' | 'twitter' | 'telegram' | 'discord'
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-[#6c47ff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5a35ee]"
              >
                {connectingPlatform === platform.key ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Save setup
              </button>
              <button
                onClick={() => void disconnectSocialPlatform(platform.key)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Disconnect
              </button>
            </div>
          </div>
        );
      })()}

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recent message feed</p>
          <div className="mt-4 space-y-3">
            {socialInbox?.messages
              .filter((message) =>
                socialInbox.platforms.find((platform) => platform.key === message.platform)?.connected
              )
              .slice(0, 4)
              .map((message) => {
              const meta = socialPlatformMeta[message.platform];
              const Icon = meta.icon;
              const accent =
                socialInbox.platforms.find((platform) => platform.key === message.platform)?.accent ??
                '#6c47ff';

              return (
                <article
                  key={message.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl border border-white/10 bg-slate-950/90 p-2">
                        <Icon size={15} style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{message.sender}</p>
                        <p className="text-xs text-slate-400">{meta.label}</p>
                      </div>
                    </div>
                    {!message.is_read && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{message.content}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 size={12} />
                    {new Date(message.timestamp).toLocaleString()}
                  </p>
                </article>
              );
            })}
            {!socialInbox?.messages.filter((message) =>
              socialInbox.platforms.find((platform) => platform.key === message.platform)?.connected
            ).length && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900 px-4 py-6 text-sm text-slate-400">
                No real channel feed yet. Add the required credentials above and then this area can
                show real messages for the connected services.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Reply approval desk</p>
          <div className="mt-4 space-y-4">
            {socialInbox?.messages
              .filter((message) =>
                socialInbox.platforms.find((platform) => platform.key === message.platform)?.connected
              )
              .slice(0, 2)
              .map((message) => {
              const replyValue = selectedReply[message.id] ?? message.suggested_replies[0] ?? '';

              return (
                <div key={message.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{message.sender}</p>
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                      Approval required
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.suggested_replies.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() =>
                          setSelectedReply((previous) => ({
                            ...previous,
                            [message.id]: suggestion,
                          }))
                        }
                        className={`rounded-full px-3 py-2 text-xs transition-colors ${
                          replyValue === suggestion
                            ? 'bg-[#6c47ff] text-white'
                            : 'border border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <MessageSquareReply size={12} className="mr-1 inline" />
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={replyValue}
                    onChange={(event) =>
                      setSelectedReply((previous) => ({
                        ...previous,
                        [message.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-[#6c47ff]/60"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void approveAndSendReply(message)}
                      disabled={sendingReplyId === message.id}
                      className="inline-flex items-center gap-2 rounded-full bg-[#6c47ff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5a35ee] disabled:opacity-60"
                    >
                      {sendingReplyId === message.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCheck size={14} />
                      )}
                      Approve and send
                    </button>
                    <button
                      onClick={() =>
                        setSelectedReply((previous) => ({ ...previous, [message.id]: '' }))
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      <Trash2 size={14} />
                      Clear draft
                    </button>
                  </div>
                </div>
              );
            })}
            {!socialInbox?.messages.filter((message) =>
              socialInbox.platforms.find((platform) => platform.key === message.platform)?.connected
            ).length && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900 px-4 py-6 text-sm text-slate-400">
                Reply suggestions will appear here after at least one channel is genuinely configured.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
