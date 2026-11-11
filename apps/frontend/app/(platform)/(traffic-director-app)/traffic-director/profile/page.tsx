'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  User, ExternalLink, CreditCard, Mail, Building, 
  RefreshCw, BadgeCheck, LogOut
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken, clearAuthTokens } from '@/lib/api';

interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  isVerified: boolean;
  isOnboarded?: boolean;
  createdAt?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    clearAuthTokens();
    toast.success('Logged out successfully');
    window.location.href = '/';
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    setLoading(true);
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        
        // Also check localStorage user cache if available
        let cachedUser: any = {};
        try {
          const raw = localStorage.getItem('user');
          if (raw) cachedUser = JSON.parse(raw);
        } catch (_) {}

        setProfile({
          id: payload.id || payload.sub || payload.userId || cachedUser.id || 'usr_sovereign_anonymous',
          name: payload.name || cachedUser.name || payload.email?.split('@')[0] || '180 Advertiser',
          username: payload.username || cachedUser.username || (payload.email ? payload.email.split('@')[0] : 'advertiser'),
          email: payload.email || cachedUser.email || '',
          phone: payload.phone || cachedUser.phone || '',
          avatarUrl: payload.avatar || cachedUser.avatar || '',
          role: payload.role || cachedUser.role || 'OWNER',
          isVerified: payload.isVerified !== undefined ? payload.isVerified : true,
          createdAt: cachedUser.createdAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.error('Failed to parse profile token:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-zinc-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          User Profile
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your account credentials, workspace settings, and active session.
        </p>
      </div>

      {/* Primary Identity Hero Card */}
      <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-[2px] shadow-md shrink-0">
              <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-[14px] flex items-center justify-center font-bold text-xl text-blue-600 dark:text-blue-400">
                {profile?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  {profile?.name}
                </h2>
                {profile?.isVerified && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-mono">@{profile?.username}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-semibold text-[10px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Role: {profile?.role}
                </span>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                  Active Session
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start">
            <a
              href={process.env.NEXT_PUBLIC_180_AUTH_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              <span>Edit Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 transition-all cursor-pointer"
              title="Sign out of current session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Identity Detail Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact & SSO Information */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Credentials & Contact</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Primary Email</span>
              <span className="font-semibold text-zinc-900 dark:text-white">{profile?.email}</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Connected Phone</span>
              <span className="font-semibold text-zinc-900 dark:text-white">{profile?.phone}</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Auth Method</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">Single Sign-On (SSO)</span>
            </div>
          </div>
        </div>

        {/* Tenant & Permissions Context */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Workspace & Tenancy</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Account ID</span>
              <span className="font-mono text-zinc-900 dark:text-white truncate max-w-[200px]">
                {profile?.id}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Subscription Status</span>
              <Link
                href="/traffic-director/subscription"
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>View Plans & Billing</span>
                <CreditCard className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Traffic Director Role</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Full Edge Administrator</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Session & Sign Out Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Active Session</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Sign out of your 180 Traffic Director session on this device.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Traffic Director</span>
        </button>
      </div>
    </div>
  );
}
