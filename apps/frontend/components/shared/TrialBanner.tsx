'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useSubscription } from '@/lib/useSubscription';
import { EASE_FLUID } from '@/components/ui/MotionPrimitives';

export function TrialBanner() {
  const pathname = usePathname();
  const { 
    isTrialing, 
    trialDaysLeft, 
    isTrialExpired, 
    isSubscriptionActive, 
    planTier,
    loading 
  } = useSubscription();

  // Don't show banner on subscription or profile page
  if (loading || pathname === '/traffic-director/subscription' || pathname === '/traffic-director/profile') {
    return null;
  }

  // If user has paid active plan (STARTER, PRO, ENTERPRISE), don't show trial/expired banner
  if (isSubscriptionActive && (planTier === 'STARTER' || planTier === 'PRO' || planTier === 'ENTERPRISE')) {
    return null;
  }

  // Trial Expired or Inactive Subscription
  if (isTrialExpired || !isSubscriptionActive) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_FLUID }}
        className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white px-4 py-2.5 text-xs font-medium shadow-sm"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-td-shimmer"
        />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-white/20">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </span>
            <span>
              <strong>Free Trial Expired:</strong> Creating new Smart Links, Forms, and Websites plus live edge cloaking are paused. Select a plan to restore full access.
            </span>
          </div>
          <Link
            href="/traffic-director/subscription"
            className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs shadow-xs active:scale-95 transition shrink-0"
          >
            <span>Upgrade Subscription</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </motion.div>
    );
  }

  // Active 7-Day Free Trial
  if (isTrialing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_FLUID }}
        className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-2 text-xs font-medium shadow-sm"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-td-shimmer"
        />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </span>
            <span>
              <strong>7-Day Free Trial Active:</strong> You have <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}</strong> remaining — includes <strong>1 Smart Link, 1 Form, and 1 Website</strong> free for 7 days.
            </span>
          </div>
          <Link
            href="/traffic-director/subscription"
            className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold text-xs active:scale-95 transition shrink-0"
          >
            <span>View Plans ($30, $80, $120)</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </motion.div>
    );
  }

  return null;
}
