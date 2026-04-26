'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { User, Shield, Bell, Moon, Sun, Globe, Save, Trash2, LogOut, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Moon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'language', label: 'Language', icon: Globe },
  ];

  return (
    <AppLayout activePath="/settings">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 lg:p-10 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your account preferences and application settings.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 shrink-0 space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all
                      ${activeTab === tab.id 
                        ? 'bg-[#6C47FF] text-white shadow-lg shadow-[#6C47FF]/20' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                    `}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
              <div className="pt-4 mt-4 border-t border-border">
                <button 
                  onClick={() => toast.error('Logged out')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/5 transition-all"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 space-y-6">
              {activeTab === 'profile' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <User size={18} className="text-[#6C47FF]" />
                      Profile Information
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</label>
                          <input 
                            type="text" 
                            defaultValue="Arjun Mehta" 
                            className="w-full bg-muted border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#6C47FF]/40 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                          <input 
                            type="email" 
                            defaultValue="arjun@example.com" 
                            className="w-full bg-muted border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#6C47FF]/40 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio</label>
                        <textarea 
                          rows={3}
                          defaultValue="B.Tech student and AI enthusiast. Building the future with Akansha."
                          className="w-full bg-muted border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#6C47FF]/40 transition-all resize-none"
                        />
                      </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={() => toast.success('Profile updated')}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C47FF] text-white text-sm font-medium hover:bg-[#5A35EE] transition-all shadow-lg shadow-[#6C47FF]/20"
                      >
                        <Save size={16} />
                        Save Changes
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold mb-6 text-red-500 flex items-center gap-2">
                      <Trash2 size={18} />
                      Danger Zone
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                    <button className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/5 transition-all">
                      Delete My Account
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Moon size={18} className="text-[#6C47FF]" />
                      Theme Preferences
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { id: 'light', icon: Sun, label: 'Light' },
                        { id: 'dark', icon: Moon, label: 'Dark' },
                        { id: 'system', icon: Globe, label: 'System' },
                      ].map(theme => (
                        <button 
                          key={theme.id}
                          className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-border hover:border-[#6C47FF]/40 bg-muted/30 transition-all group"
                        >
                          <theme.icon size={24} className="text-muted-foreground group-hover:text-[#6C47FF]" />
                          <span className="text-sm font-medium">{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab !== 'profile' && activeTab !== 'appearance' && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                  <Globe size={48} className="text-muted-foreground/20 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">More Settings Coming Soon</h3>
                  <p className="text-sm text-muted-foreground/60 mt-1">We're working hard to bring you more customization options.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
