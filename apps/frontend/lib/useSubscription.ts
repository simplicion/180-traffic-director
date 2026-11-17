'use client';

import { useState, useEffect, useCallback } from 'react';
import api from './api';

export interface SubscriptionData {
  id?: string;
  userId?: string;
  planTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  planName: string;
  price: number;
  currency: string;
  status: string; // 'ACTIVE' | 'TRIALING' | 'EXPIRED' | 'CANCELLED'
  oneEightySubId?: string | null;
  amountCharged: number;
  couponApplied?: string | null;
  discountAmount?: number;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  isTrialing: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  isSubscriptionActive: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string | null;
  nextBillingDate?: string | null;
  autoRenew: boolean;
  maxLinks: number;
  maxForms?: number;
  maxWebsites?: number;
  isUnlimited: boolean;
  currentLinksCount: number;
  activeLinksCount: number;
  currentFormsCount?: number;
  currentWebsitesCount?: number;
  quotaUsedPercent: number;
  formsQuotaUsedPercent?: number;
  websitesQuotaUsedPercent?: number;
  canCreateMoreLinks: boolean;
  canCreateMoreForms?: boolean;
  canCreateMoreWebsites?: boolean;
  hasAdvancedAnalytics: boolean;
  cloakingEnabled: boolean;
}

let cachedSub: SubscriptionData | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10000; // 10s client cache

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(cachedSub);
  const [loading, setLoading] = useState<boolean>(!cachedSub);

  const fetchStatus = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedSub && now - lastFetchTime < CACHE_TTL_MS) {
      setSubscription(cachedSub);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/api/v1/traffic-director/billing/status');
      if (res.data?.success && res.data?.subscription) {
        const subData = res.data.subscription as SubscriptionData;
        cachedSub = subData;
        lastFetchTime = Date.now();
        setSubscription(subData);
      }
    } catch (err) {
      console.warn('[useSubscription] Failed to load subscription status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const planTier = subscription?.planTier || 'FREE';
  const status = subscription?.status || 'TRIALING';
  const isTrialing = Boolean(subscription?.isTrialing);
  const isTrialExpired = Boolean(subscription?.isTrialExpired);
  const isSubscriptionActive = Boolean(subscription?.isSubscriptionActive);
  const canCreateMoreLinks = subscription !== null 
    ? Boolean(subscription?.canCreateMoreLinks) 
    : true; // Graceful optimistic default for new/loading accounts
  const maxLimit = subscription?.maxLinks ?? 1;
  const maxForms = subscription?.maxForms ?? maxLimit;
  const maxWebsites = subscription?.maxWebsites ?? maxLimit;
  const currentFormsCount = subscription?.currentFormsCount ?? 0;
  const currentWebsitesCount = subscription?.currentWebsitesCount ?? 0;
  const canCreateMoreForms = subscription !== null
    ? Boolean(subscription?.canCreateMoreForms ?? (isSubscriptionActive && (maxForms === -1 || currentFormsCount < maxForms)))
    : true;
  const canCreateMoreWebsites = subscription !== null
    ? Boolean(subscription?.canCreateMoreWebsites ?? (isSubscriptionActive && (maxWebsites === -1 || currentWebsitesCount < maxWebsites)))
    : true;
  const hasAdvancedAnalytics = Boolean(subscription?.hasAdvancedAnalytics);
  const trialDaysLeft = subscription?.trialDaysLeft ?? 0;

  return {
    subscription,
    currentSubscription: subscription,
    planTier,
    planName: subscription?.planName || '7-Day Free Trial',
    status,
    isSubscriptionActive,
    isTrialing,
    trialDaysLeft,
    isTrialExpired,
    canCreateMoreLinks,
    canCreateMoreForms,
    canCreateMoreWebsites,
    hasAdvancedAnalytics,
    cloakingEnabled: Boolean(subscription?.cloakingEnabled),
    maxLinks: maxLimit,
    maxForms,
    maxWebsites,
    isUnlimited: Boolean(subscription?.isUnlimited || maxLimit === -1),
    currentLinksCount: subscription?.currentLinksCount ?? 0,
    activeLinksCount: subscription?.activeLinksCount ?? 0,
    currentFormsCount,
    currentWebsitesCount,
    quotaUsedPercent: subscription?.quotaUsedPercent ?? 0,
    formsQuotaUsedPercent: subscription?.formsQuotaUsedPercent ?? 0,
    websitesQuotaUsedPercent: subscription?.websitesQuotaUsedPercent ?? 0,
    isPaidPlan: planTier === 'STARTER' || planTier === 'PRO' || planTier === 'ENTERPRISE',
    daysLeft: trialDaysLeft,
    isExpired: isTrialExpired || status === 'EXPIRED',
    loading,
    refresh: () => fetchStatus(true),
    // Platform compatibility
    hasApp: (appId?: string) => true,
    enabledApps: ['traffic-director', 'forms', 'advertising', 'website-builder']
  };
}
